const { createClient } = require('@supabase/supabase-js');

// ---- AI 供應商設定（可抽換）：預設 DeepInfra，未來要換供應商只需在 Vercel 環境變數覆蓋這兩個值 ----
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepinfra.com/v1/openai/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-oss-120b';
const AI_API_KEY = process.env.DEEPINFRA_API_KEY_SALES;

const SUPABASE_URL = 'https://bvuygyajzupeqpqfwmgi.supabase.co';
// 這把是前端本來就在用的 anon key（公開金鑰，不是機密，RLS會保護資料，這裡沿用同一把）
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2dXlneWFqenVwZXFwcWZ3bWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjA5MjQsImV4cCI6MjA5NzczNjkyNH0.zvP-JWgHRWiCKZbqSSU6-uGgx3WHwG0nFxfG8xDhEH8';

const MAX_RECORDS_PER_TABLE = 40; // 資料庫查詢階段先抓，實際餵給AI的量由下面的字數預算再收斂
// 餵給AI的資料總字數預算。原本 3200 是配合 Groq 免費版「每分鐘8000 token」限制設的保守值；
// 換成 DeepInfra 付費版後沒有這個免費額度限制，放寬到 13000（約可容納更完整的比對紀錄）。
const MAX_PROMPT_CHARS = 13000;

// AI 服務定價（每百萬 token 美元），這是預留位置數字，請上供應商官網核對目前實際費率後再更新這兩個數字，
// 否則統計出來的 estimated_cost_usd 只是概估，不是真實帳單金額
const PRICE_PER_M_PROMPT_TOKENS = 0.15;
const PRICE_PER_M_COMPLETION_TOKENS = 0.6;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const authHeader = req.headers['authorization'] || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    res.status(401).json({ error: '未登入' });
    return;
  }

  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: '請輸入問題' });
    return;
  }

  // 用登入者自己的身份查詢，RLS自動限縮成他原本看得到的範圍
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(accessToken);
  if (userErr || !userData || !userData.user) {
    res.status(401).json({ error: '登入狀態已失效，請重新登入' });
    return;
  }
  const userEmail = userData.user.email;

  // 不管最後是成功、查無資料、還是失敗，都寫進歷史紀錄，讓使用者自己問過什麼都查得到
  async function logAttempt(answer, matchedCount, cost) {
    try {
      await userClient.from('wechat_ai_qa_usage_log').insert({
        user_id: userData.user.id,
        user_email: userEmail,
        question,
        answer,
        matched_records_count: matchedCount || 0,
        estimated_cost_usd: cost || 0,
      });
    } catch (e) {
      // 寫歷史紀錄失敗不影響本次回答，只是記錄不到而已
    }
  }

  try {
    // ── 每日費用上限檢查：要看全站總和，只能用service role繞過RLS查 ──
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY_WECHAT);

    const { data: settingsRow } = await serviceClient
      .from('wechat_ai_qa_settings')
      .select('daily_cost_limit_usd')
      .eq('id', 1)
      .single();
    const dailyLimit = settingsRow ? Number(settingsRow.daily_cost_limit_usd) : 5;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todayLogs } = await serviceClient
      .from('wechat_ai_qa_usage_log')
      .select('estimated_cost_usd')
      .gte('created_at', todayStart.toISOString());
    const todaySpent = (todayLogs || []).reduce(
      (sum, r) => sum + Number(r.estimated_cost_usd || 0),
      0
    );

    if (todaySpent >= dailyLimit) {
      const answer = '今日 AI 問答用量已達全站上限，請明天再試，或聯絡管理員調整上限。';
      await logAttempt(answer, 0, 0);
      res.status(200).json({ answer, matched_records_count: 0 });
      return;
    }

    // ── 第一段：抓RLS範圍內的候選客戶/機型/業務名稱，跟問題文字做子字串比對 ──
    const [wmC, wmM, wmS, crC, crM, crS, vrC] = await Promise.all([
      userClient.from('wechat_messages').select('company').not('company', 'is', null),
      userClient.from('wechat_messages').select('model').not('model', 'is', null),
      userClient.from('wechat_messages').select('sales').not('sales', 'is', null),
      userClient.from('crm_records').select('customer').not('customer', 'is', null),
      userClient.from('crm_records').select('model').not('model', 'is', null),
      userClient.from('crm_records').select('sales').not('sales', 'is', null),
      userClient.from('visit_records').select('customer').not('customer', 'is', null),
    ]);

    const uniq = (rows, key) => [
      ...new Set((rows || []).map((r) => (r[key] || '').trim()).filter((v) => v.length >= 2)),
    ];

    const customerSet = new Set([
      ...uniq(wmC.data, 'company'),
      ...uniq(crC.data, 'customer'),
      ...uniq(vrC.data, 'customer'),
    ]);
    const modelSet = new Set([...uniq(wmM.data, 'model'), ...uniq(crM.data, 'model')]);
    const salesSet = new Set([...uniq(wmS.data, 'sales'), ...uniq(crS.data, 'sales')]);

    // 嚴格比對：問題要完整包含資料庫值（用於機型代碼，差一碼就是不同機器，不能放寬）
    const matchStrict = (set) => [...set].filter((v) => question.includes(v));

    // 模糊比對：資料庫值本身可能有地區/廠別等前後綴變體（如「無錫健鼎」「健鼎(越南)」），
    // 只要值裡有一段2~4字的片段出現在問題裡就算比對到，這樣打「健鼎」能同時抓到全部變體
    const matchFuzzy = (set) => {
      const matched = [];
      for (const candidate of set) {
        if (question.includes(candidate)) {
          matched.push(candidate);
          continue;
        }
        let found = false;
        for (let len = Math.min(4, candidate.length); len >= 2 && !found; len--) {
          for (let i = 0; i + len <= candidate.length; i++) {
            if (question.includes(candidate.slice(i, i + len))) {
              found = true;
              break;
            }
          }
        }
        if (found) matched.push(candidate);
      }
      return matched;
    };

    const matchedCustomers = matchFuzzy(customerSet);
    const matchedModels = matchStrict(modelSet);
    const matchedSales = matchFuzzy(salesSet);

    if (!matchedCustomers.length && !matchedModels.length && !matchedSales.length) {
      const answer =
        '在你看得到的資料範圍內，沒有找到符合的客戶名稱／機型／業務姓名關鍵字，麻煩換個問法（例如加上完整客戶名稱或機型代碼）再試一次。';
      await logAttempt(answer, 0, 0);
      res.status(200).json({ answer, matched_records_count: 0 });
      return;
    }

    // ── 第二段：依比對到的關鍵字查三張表（RLS自動限縮，不用另外寫權限判斷）──
    const applyFilters = (query, customerCol, modelCol, salesCol) => {
      let q = query;
      if (matchedCustomers.length) q = q.in(customerCol, matchedCustomers);
      if (matchedModels.length && modelCol) q = q.in(modelCol, matchedModels);
      if (matchedSales.length && salesCol) q = q.in(salesCol, matchedSales);
      return q;
    };

    const [wmRes, crRes, vrRes] = await Promise.all([
      applyFilters(
        userClient
          .from('wechat_messages')
          .select('date,company,model,qty,price,delivery,status,sales,raw,note,other'),
        'company',
        'model',
        'sales'
      )
        .order('date', { ascending: false })
        .limit(MAX_RECORDS_PER_TABLE),
      applyFilters(
        userClient
          .from('crm_records')
          .select('import_date,customer,model,qty,delivery,status_w1,status_w2,sales'),
        'customer',
        'model',
        'sales'
      )
        .order('import_date', { ascending: false })
        .limit(MAX_RECORDS_PER_TABLE),
      applyFilters(
        userClient
          .from('visit_records')
          .select('report_date,customer,model,customer_info,market_info,other,sales'),
        'customer',
        'model',
        'sales'
      )
        .order('report_date', { ascending: false })
        .limit(MAX_RECORDS_PER_TABLE),
    ]);

    // 截斷長度：優先保留報價/日期/客戶/機型這些關鍵欄位，長文字欄位只留摘要
    const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

    const records = [];
    (wmRes.data || []).forEach((r) =>
      records.push(
        `[商務訊息] 日期:${r.date} 客戶:${r.company} 機型:${r.model} 數量:${r.qty} 報價:${r.price} 交期:${r.delivery} 狀態:${r.status} 業務:${r.sales} 內容:${truncate(r.raw, 80)} 備註:${truncate(r.note, 40)} 其他:${truncate(r.other, 40)}`
      )
    );
    (crRes.data || []).forEach((r) =>
      records.push(
        `[CRM需求] 日期:${r.import_date} 客戶:${r.customer} 機型:${r.model} 數量:${r.qty} 交期:${r.delivery} 上週狀態:${truncate(r.status_w1, 40)} 本週狀態:${truncate(r.status_w2, 40)} 業務:${r.sales}`
      )
    );
    (vrRes.data || []).forEach((r) =>
      records.push(
        `[拜訪紀錄] 日期:${r.report_date} 客戶:${r.customer} 機型:${r.model} 客戶資訊:${truncate(r.customer_info, 80)} 市場訊息:${truncate(r.market_info, 40)} 其他:${truncate(r.other, 40)} 業務:${r.sales}`
      )
    );

    if (!records.length) {
      const answer = '有比對到關鍵字，但你看得到的範圍內沒有相關紀錄。';
      await logAttempt(answer, 0, 0);
      res.status(200).json({ answer, matched_records_count: 0 });
      return;
    }

    // 依「最新的優先」用字數預算收斂到安全範圍內
    const limitedRecords = [];
    let charBudget = MAX_PROMPT_CHARS;
    for (const rec of records) {
      if (charBudget - rec.length <= 0) break;
      limitedRecords.push(rec);
      charBudget -= rec.length;
    }
    const omittedCount = records.length - limitedRecords.length;

    // ── 呼叫 AI，讓AI只根據撈到的紀錄回答，不臆測 ──
    let aiRes, aiData;
    try {
      aiRes = await fetch(AI_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            {
              role: 'system',
              content:
                '你是公司內部營業商務資料查詢助理，只能根據使用者提供的資料紀錄回答問題，不可捏造資料裡沒有的內容。一律用繁體中文回答，用自然口語的段落把重點彙整說清楚，就像同事跟你口頭報告一樣；可以用條列式列重點，但絕對不要輸出markdown表格語法（不要用|和---組成的表格），也不要把每一筆原始紀錄的所有欄位都逐條列出——先講結論、再視需要補充關鍵細節（日期、金額、狀態），無關緊要的欄位不用提。如果資料不足以回答，要明確告知使用者資料不足，不要臆測。',
            },
            {
              role: 'user',
              content: `問題：${question}\n\n以下是相關資料紀錄（依最新優先，若有省略會另外註明）：\n${limitedRecords.join('\n')}${omittedCount > 0 ? `\n（還有 ${omittedCount} 筆較舊的紀錄因篇幅限制未列出）` : ''}`,
            },
          ],
          temperature: 0.2,
        }),
      });
      aiData = await aiRes.json();
    } catch (fetchErr) {
      const answer = '查詢失敗（無法連線到AI服務）：' + String(fetchErr.message || fetchErr);
      await logAttempt(answer, limitedRecords.length, 0);
      res.status(200).json({ answer, matched_records_count: limitedRecords.length });
      return;
    }

    if (!aiRes.ok) {
      const errMsg = (aiData && aiData.error && aiData.error.message) || 'AI 服務呼叫失敗';
      const answer = '查詢失敗：' + errMsg;
      await logAttempt(answer, limitedRecords.length, 0);
      res.status(200).json({ answer, matched_records_count: limitedRecords.length });
      return;
    }

    const answer =
      (aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content) ||
      '（AI 沒有回傳內容）';
    const promptTokens = (aiData.usage && aiData.usage.prompt_tokens) || 0;
    const completionTokens = (aiData.usage && aiData.usage.completion_tokens) || 0;
    const estimatedCost =
      (promptTokens / 1000000) * PRICE_PER_M_PROMPT_TOKENS +
      (completionTokens / 1000000) * PRICE_PER_M_COMPLETION_TOKENS;

    await logAttempt(answer, limitedRecords.length, estimatedCost);

    // ── 推播到中央用量統計（總經理需求），失敗也不擋這次回答 ──
    fetch(`${SUPABASE_URL}/functions/v1/stats-ai-usage-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-stats-secret': process.env.STATS_PUSH_SECRET,
      },
      body: JSON.stringify({
        system_name: 'wechat-manager',
        ai_provider: 'deepinfra',
        query_count_increment: 1,
        estimated_cost_increment: estimatedCost,
      }),
    }).catch(() => {});

    res.status(200).json({
      answer,
      matched_records_count: limitedRecords.length,
      estimated_cost_usd: estimatedCost,
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
