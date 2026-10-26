const { createClient } = require('@supabase/supabase-js');
const { matchQ } = require('./_t2s'); // 跟網頁搜尋框同一套比對（繁簡互通、不分大小寫的包含比對）

const SUPABASE_URL = 'https://bvuygyajzupeqpqfwmgi.supabase.co';
// 這把是前端本來就在用的 anon key（公開金鑰，不是機密，RLS會保護資料，這裡沿用同一把）
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2dXlneWFqenVwZXFwcWZ3bWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjA5MjQsImV4cCI6MjA5NzczNjkyNH0.zvP-JWgHRWiCKZbqSSU6-uGgx3WHwG0nFxfG8xDhEH8';

const STATS_PUSH_URL = process.env.STATS_PUSH_URL || 'https://bvuygyajzupeqpqfwmgi.supabase.co/functions/v1/stats-ai-usage-push';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepinfra.com/v1/openai/chat/completions';
const AI_MODEL = process.env.AI_MODEL_WECHAT || 'openai/gpt-oss-120b';
const AI_API_KEY = process.env.DEEPINFRA_API_KEY_SALES;
const MAX_RECORDS_PER_TABLE = 30; // 資料庫查詢階段先抓，實際餵給AI的量由下面的字數預算再收斂
// 餵給AI的資料總字數預算（粗抓，避免單次請求過大；中文一個字通常不只1個token，這裡故意抓得保守一點，
// 含系統提示與問題本身的空間）
const MAX_PROMPT_CHARS = 3200;

// DeepInfra 定價（每百萬 token 美元），這是預留位置數字，請上 DeepInfra 官網
// https://deepinfra.com/pricing 核對 openai/gpt-oss-120b 目前實際費率後再更新這兩個數字，
// 否則統計出來的 estimated_cost_usd 只是概估，不是真實帳單金額
const PRICE_PER_M_PROMPT_TOKENS = 0.15;
const PRICE_PER_M_COMPLETION_TOKENS = 0.75;

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

  if (!AI_API_KEY) {
    res.status(500).json({ error: '伺服器未設定 DEEPINFRA_API_KEY_SALES' });
    return;
  }

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

    // 改用資料庫端的RPC函式直接拿「不重複」的客戶/機型/業務清單（RLS依舊套用在呼叫者身上），
    // 不用再把visit_records這種上萬筆的表整批分頁撈到JS裡自己去重，效能好很多，
    // 也不會因為表持續變大而重新踩到查詢筆數上限的問題
    // ──但注意：Supabase不管是一般查詢還是RPC，單次回應預設都還是有1000筆上限，
    // 資料庫幫忙去重後的結果如果本身還是超過1000筆，一樣會被砍掉，所以RPC呼叫也要分頁撈到底
    async function fetchAllRpc(fnName) {
      const PAGE_SIZE = 1000;
      let all = [];
      let from = 0;
      while (true) {
        const { data, error } = await userClient.rpc(fnName).range(from, from + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    }

    const [custData, modelData, salesData] = await Promise.all([
      fetchAllRpc('wechat_ai_qa_candidate_customers'),
      fetchAllRpc('wechat_ai_qa_candidate_models'),
      fetchAllRpc('wechat_ai_qa_candidate_sales'),
    ]);

    // （名片管理 2026-10-16 已移到行動秘書，AI 問答不再查 business_cards）

    const uniqFromRpc = (data, key) => [
      ...new Set((data || []).map((r) => (r[key] || '').trim()).filter((v) => v.length >= 2)),
    ];

    const customerSet = new Set(uniqFromRpc(custData, 'customer'));
    const modelSet = new Set(uniqFromRpc(modelData, 'model'));
    const salesSet = new Set(uniqFromRpc(salesData, 'sales'));

    // 嚴格比對：問題要完整包含資料庫值（用於機型代碼，差一碼就是不同機器，不能放寬）
    const matchStrict = (set) => [...set].filter((v) => question.includes(v));

    // 這些是很常見的中文商業用詞／使用者問句常見詞，如果拿它們去比對，
    // 幾乎任何問句都會「巧合」命中一堆不相關的客戶，所以明確排除，不當作有效比對片段
    const FUZZY_STOPWORDS = new Set([
      '股份','有限','公司','集團','電子','科技','工業','企業','國際','實業',
      '控股','材料','機械','精密','工程','需求','訊息','資訊','報價','資料',
      '進度','狀態','客戶','業務','時間','數量','機型','設備','技術','產品',
      '管理','系統','廠商','廠房','製造','製程','生產','設計','服務','出貨',
    ]);
    // 模糊比對：資料庫值本身可能有地區/廠別等前後綴變體（如「無錫健鼎」「健鼎(越南)」），
    // 只要值裡有一段2~4字的片段出現在問題裡就算比對到，這樣打「健鼎」能同時抓到全部變體
    // （片段本身如果剛好是「需求」「訊息」「科技」這類常見詞，會排除不算，
    // 避免使用者問句的普通用字剛好跟某個不相關客戶名稱的一部分撞在一起，誤判成有比對到）
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
            const frag = candidate.slice(i, i + len);
            if (FUZZY_STOPWORDS.has(frag)) continue;
            if (question.includes(frag)) {
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

    // ══ 「先用檢索」鐵則（2026-10-24 Michelle：「用檢索用檢索」）══════════════════════════
    // 網頁搜尋框查得到的，AI 一定要查得到。做法：
    //  ① 欄位查詢：問題裡比對到的「資料庫裡真的存在的」客戶/機型/業務名稱，各自用跟網頁同一套查詢查（客戶↔客戶框、機型↔機型框、業務↔業務框）
    //  ② 全文查詢（＝網頁「全文關鍵字」搜尋框同款）：從問題拆出搜尋詞，不猜它屬於哪個欄位，直接用全文查。
    //     什麼時候跑：①查到 0 筆、或①根本沒比對到名稱、或問題裡有英數代碼（例 TM、RU6H）沒被①的機型名稱涵蓋時。
    //  ③ ①②都 0 筆，才回「查無資料」。同一個詞不會同時塞進兩個欄位做 AND（每路分開查、結果用「或」合併）。
    // 搜尋詞拆法：英數代碼（TM、RU6HM-125…）原樣保留；中文以標點、連接詞切開，再去掉問句常用詞（最近、需求、多少…）。
    const QUESTION_FILLERS = ['請問', '幫我', '查一下', '查詢', '列出', '告訴我', '最近', '目前', '現在', '之前', '以前', '今年', '去年', '本月', '上個月',
      '的', '是', '有', '嗎', '呢', '吧', '了', '多少', '幾台', '幾個', '什麼', '哪些', '哪個', '哪裡', '如何', '怎麼', '狀況', '情況', '資訊', '資料',
      '需求', '進度', '紀錄', '記錄', '訊息', '機型', '客戶', '業務', '台數', '數量', '交期', '報價', '一下', '所有', '全部', '相關', '關於', '有關',
      '誰', '提到', '提過', '問題', '我們', '你們', '我司', '比較', '拜訪', '一些', '怎樣', '為何', '為什麼'];
    function extractSearchTerms(q) {
      const terms = new Set();
      (q.match(/[A-Za-z][A-Za-z0-9\-]*/g) || []).forEach((t) => { if (t.length >= 2) terms.add(t.toUpperCase()); });
      q.replace(/[A-Za-z0-9\-]+/g, ' ')
        .split(/[\s,，。、？?！!：:；;（）()「」『』"'\/和跟與及或]+/)
        .forEach((seg) => {
          let s = seg;
          QUESTION_FILLERS.forEach((w) => { s = s.split(w).join(' '); });
          s.split(/\s+/).forEach((piece) => { if (piece.length >= 2 && !FUZZY_STOPWORDS.has(piece)) terms.add(piece); });
        });
      return [...terms];
    }
    const searchTerms = extractSearchTerms(question);
    const codeTerms = searchTerms.filter((t) => /^[A-Z]/.test(t));
    const codesNotCoveredByModels = codeTerms.filter((t) => !matchedModels.some((m) => m.toUpperCase().includes(t)));

    if (!matchedCustomers.length && !matchedModels.length && !matchedSales.length && !searchTerms.length) {
      const answer =
        '查無資料：問題裡沒有可以拿來搜尋的客戶名稱／機型／業務姓名或關鍵字，麻煩加上客戶名稱、機型代碼或關鍵字再問一次。';
      await logAttempt(answer, 0, 0);
      res.status(200).json({ answer, matched_records_count: 0 });
      return;
    }

    // 微信訊息、拜訪紀錄：跟網頁「客戶商務」頁籤呼叫同一支後台函式 wechat_customer_feed（2026-10-16），
    // 比對規則（各條件比對哪些欄位、繁簡互通、包含比對、排序）三處一致：網頁 / SQL 函式 / AI 問答。
    // ⚠ 要改篩選規則時，同步改 sql/2026-10-16d_wechat_customer_feed_fast.sql 與 index.html 的 renderUnified
    async function feedCall(kind, params, limit) {
      const r = await userClient.rpc('wechat_customer_feed', { p_kind: kind, p_offset: 0, p_limit: limit || MAX_RECORDS_PER_TABLE, p_include_src: true, ...params });
      return (r.data && r.data.rows) || [];
    }
    function mergeFeedRows(lists) {
      const byId = new Map();
      lists.forEach((rows) => rows.forEach((row) => { if (!byId.has(row.id)) byId.set(row.id, row); }));
      return [...byId.values()]
        .sort((a, b) => (a.date_key < b.date_key ? 1 : a.date_key > b.date_key ? -1 : 0))
        .slice(0, MAX_RECORDS_PER_TABLE);
    }
    // 「答案正確為主」（2026-10-24）：英數代碼（TM、DG6Z…）前後不能緊接英文字母，避免 FTM、TTM（公司名）、SmartMapping 這類誤抓。
    // 2026-10-24 實測：全文查 TM 共 858 筆，其中 7 筆是這種誤抓，其餘都是真的在講 TM 機台。
    const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 防誤抓規則（跟 SQL 函式 wechat_q_pattern 的 p_code 規則「完全相同」，網頁機型框/全文框與 AI 一致；2026-10-25）：
    //  - 只看「純英數（可含 -）」的搜尋字；含中文的詞照一般包含比對
    //  - 含數字（TM4、DG6Z、RU6H）：前面不能緊接英文字母（擋 XRU6H）；後面可以接字母，系列代碼才找得到 DG6ZM、RU6HM
    //  - 純字母且 3 碼以內（TM、GEP）：前後都不能緊接英文字母（擋 FTM、TTM、SmartMapping、JTMD、TTTMESSAGE）
    //  - 純字母 4 碼以上（SAMSUNG…）：一般包含比對
    const codeRe = (c) => {
      if (!/^[A-Za-z0-9-]+$/.test(c)) return null;
      if (/[0-9]/.test(c)) return new RegExp('(^|[^A-Za-z])' + escRe(c), 'i');
      if (c.length <= 3) return new RegExp('(^|[^A-Za-z])' + escRe(c) + '(?![A-Za-z])', 'i');
      return new RegExp(escRe(c), 'i');
    };
    const codeHit = (text, codes) => codes.some((c) => { const re = codeRe(c); return re ? re.test(String(text || '')) : matchQ(text, c); });
    const feedHay = (row, stage) => {
      const s = row.src || {};
      if (stage === 'model') return row.kind === 'wechat' ? [s.model, s.raw].join(' ') : String(s.model || '');
      return (row.kind === 'wechat'
        ? [s.company, s.contact, s.model, s.price, s.delivery, s.status, s.note, s.raw]
        : [s.customer, s.sales, s.model, s.customer_info, s.competitor, s.market_info, s.other, s.work, s.work_purpose, s.next_action]).join(' ');
    };
    // 英數代碼：「機型」欄位（＝網頁機型框）＋全文（＝網頁全文框）兩路都查，用「或」合併去重（2026-10-25 小科組長：
    // 只查機型欄會漏掉約 730 筆拜訪紀錄內文真的在講 TM 機台的紀錄，比誤抓 7 筆更嚴重）。兩路都套上方防誤抓規則。
    async function codeSearch(kind, codes) {
      const [byModel, byText] = await Promise.all([
        feedCall(kind, { p_model: codes }, 200),
        feedCall(kind, { p_keyword: codes }, 200),
      ]);
      return [...byModel.filter((r) => codeHit(feedHay(r, 'model'), codes)), ...byText.filter((r) => codeHit(feedHay(r, 'all'), codes))];
    }
    async function fetchFeedByAnyDimension(kind) {
      const fieldCalls = [];
      if (matchedCustomers.length) fieldCalls.push(feedCall(kind, { p_company: matchedCustomers }));
      if (matchedModels.length) fieldCalls.push(feedCall(kind, { p_model: matchedModels }));
      if (matchedSales.length) fieldCalls.push(feedCall(kind, { p_person: matchedSales }));
      const fieldLists = await Promise.all(fieldCalls);
      const fieldTotal = fieldLists.reduce((a, l) => a + l.length, 0);
      const lists = [...fieldLists];
      if (fieldTotal === 0) {
        const words = searchTerms.filter((t) => !codeTerms.includes(t));
        if (words.length) lists.push(await feedCall(kind, { p_keyword: words }));   // ② 中文搜尋詞：全文（搜尋框同款）
        if (codeTerms.length) lists.push(await codeSearch(kind, codeTerms));        // ② 英數代碼：機型欄優先，再全文
      } else if (codesNotCoveredByModels.length) {
        lists.push(await codeSearch(kind, codesNotCoveredByModels));               // 沒被①機型名稱涵蓋的英數代碼（例 TM）
      }
      return mergeFeedRows(lists).map((row) => row.src || {});
    }

    // CRM 需求：跟網頁「CRM需求統計」頁籤的客戶／機型／業務三個框同一套比對（包含比對、繁簡互通，matchQ），
    // 以前 AI 用「完全相同」比對，網頁打一部分就查得到的，AI 反而查不到（2026-10-24 修正）。
    // CRM 每次匯入整批取代，只有一份約幾百筆，在伺服器端讀進來比對即可（不會送到手機）。
    async function fetchCrm() {
      const all = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await userClient.from('crm_records')
          .select('import_date,customer,model,qty,delivery,status_w1,status_w2,sales,end_product,created_at')
          .order('created_at', { ascending: false }).range(from, from + 999);
        if (error || !data || !data.length) break;
        all.push(...data);
        if (data.length < 1000) break;
      }
      const anyMatch = (hay, qs) => qs.some((q) => matchQ(hay, q));
      // 英數代碼一樣不可緊接英文字母（避免 FTM、TTM 誤抓）；中文詞用網頁同款 matchQ
      const termMatch = (hay, qs) => qs.some((q) => (/^[A-Z]/.test(q) ? codeHit(hay, [q]) : matchQ(hay, q)));
      let rows = all.filter((r) =>
        (matchedCustomers.length && anyMatch(r.customer, matchedCustomers)) ||
        (matchedModels.length && anyMatch(r.model, matchedModels)) ||
        (matchedSales.length && anyMatch(r.sales, matchedSales)));
      const extra = rows.length === 0 ? searchTerms : codesNotCoveredByModels;
      if (extra.length) {
        // ② 網頁 CRM 頁籤沒有全文框，所以搜尋詞依序套用到客戶／機型／業務三個框（任一框符合就算）＋終端產品
        const more = all.filter((r) => [r.customer, r.model, r.sales, r.end_product].some((f) => termMatch(f, extra)));
        rows = [...new Set([...rows, ...more])];
      }
      return rows.slice(0, MAX_RECORDS_PER_TABLE);
    }

    const [wmData, crData, vrData] = await Promise.all([
      fetchFeedByAnyDimension('wechat'),
      fetchCrm(),
      fetchFeedByAnyDimension('visit'),
    ]);

    // 之前這裡有針對每個欄位個別截斷字數，現在已升級付費方案不用再省，
    // 拿掉單欄位截斷，改成完全依賴下面的MAX_PROMPT_CHARS整體字數預算去收斂要放幾筆記錄，
    // 避免像客戶資訊裡的報價金額出現在文字後段卻被單獨截斷掉、AI看不到的問題
    //
    // 重要：三種資料來源要先「混在一起依日期全部重新排序」，不能照商務訊息／CRM／拜訪紀錄
    // 的順序依序塞入陣列——不然字數預算被前面類型用光時，後面類型（例如拜訪紀錄）會直接
    // 完全擠不進去，不管它日期多新、多相關，這就是華通那筆報價一直被漏掉的真正原因。
    // 日期排序鍵：跟網頁 dateSortKey() 及 SQL wechat_date_key() 同一規則（「2026/9/3」「2026-09-03」都轉成 20260903），
    // 避免直接比字串時「2026/9/3」被排在「2026/10/1」後面這類錯亂
    const dateKey = (s) => {
      const m = String(s || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      return m ? m[1] + ('0' + m[2]).slice(-2) + ('0' + m[3]).slice(-2) : '00000000';
    };
    const recordItems = [];
    (wmData || []).forEach((r) =>
      recordItems.push({
        type: '商務訊息', sales: r.sales, customer: r.company,
        date: dateKey(r.date),
        text: `[商務訊息] 日期:${r.date} 客戶:${r.company} 機型:${r.model} 數量:${r.qty} 報價:${r.price} 交期:${r.delivery} 狀態:${r.status} 業務:${r.sales} 內容:${r.raw || ''} 備註:${r.note || ''} 其他:${r.other || ''}`,
      })
    );
    (crData || []).forEach((r) =>
      recordItems.push({
        type: 'CRM需求', sales: r.sales, customer: r.customer,
        date: dateKey(r.import_date),
        text: `[CRM需求] 日期:${r.import_date} 客戶:${r.customer} 機型:${r.model} 數量:${r.qty} 交期:${r.delivery} 上週狀態:${r.status_w1 || ''} 本週狀態:${r.status_w2 || ''} 業務:${r.sales} 終端產品(客戶的板子用在哪些終端應用):${r.end_product || '未填'}`,
      })
    );
    (vrData || []).forEach((r) =>
      recordItems.push({
        type: '拜訪紀錄', sales: r.sales, customer: r.customer,
        date: dateKey(r.report_date),
        text: `[拜訪紀錄] 日期:${r.report_date} 客戶:${r.customer} 機型:${r.model} 客戶資訊:${r.customer_info || ''} 市場訊息:${r.market_info || ''} 其他:${r.other || ''} 業務:${r.sales}`,
      })
    );
    recordItems.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const records = recordItems.map((it) => it.text);

    if (!records.length) {
      const answer = '有比對到關鍵字，但你看得到的範圍內沒有相關紀錄。';
      await logAttempt(answer, 0, 0);
      res.status(200).json({ answer, matched_records_count: 0 });
      return;
    }

    // 依「最新的優先」用字數預算收斂到安全範圍內，避免單次請求過大
    const limitedItems = [];
    let charBudget = MAX_PROMPT_CHARS;
    for (const it of recordItems) {
      if (charBudget - it.text.length <= 0) break;
      limitedItems.push(it);
      charBudget -= it.text.length;
    }
    const limitedRecords = limitedItems.map((it) => it.text);
    const omittedCount = records.length - limitedRecords.length;

    // 【數字正確】2026-10-25 小科組長：AI 曾寫「以上六位」實際只列 5 位 → 人數、筆數一律由程式算好，AI 照抄、不可自己數
    const countBy = (key) => {
      const m = new Map();
      limitedItems.forEach((it) => { const v = String(it[key] || '').trim(); if (v) m.set(v, (m.get(v) || 0) + 1); });
      return [...m.entries()];
    };
    const byType = countBy('type'), bySales = countBy('sales'), byCustomer = countBy('customer');
    // 2026-10-26 小科組長：「TM 一共幾家」要能直接照程式數字回答；「誰提到良率」不可漏列 →
    // 針對問題裡的每個搜尋詞，程式算出「內容含這個詞」的紀錄筆數、業務名單、客戶名單，AI 照名單完整列出
    // （比對規則同搜尋：英數代碼用 codeHit 防誤抓，中文用網頁同款 matchQ）
    const statTerms = [...new Set([...searchTerms, ...matchedModels])];
    const termStats = statTerms.map((term) => {
      const hits = limitedItems.filter((it) => (/^[A-Za-z0-9-]+$/.test(term) ? codeHit(it.text, [term]) : matchQ(it.text, term)));
      if (!hits.length) return '';
      const uniq = (key) => [...new Set(hits.map((it) => String(it[key] || '').trim()).filter(Boolean))];
      const salesList = uniq('sales'), custList = uniq('customer');
      return `\n內容含「${term}」的紀錄共 ${hits.length} 筆；業務共 ${salesList.length} 位：${salesList.join('、') || '無'}；客戶共 ${custList.length} 家：${custList.join('、') || '無'}`;
    }).join('');
    const programStats = '【程式統計（以下數字由系統計算，回答提到人數、筆數時只能照抄這裡，不可以自己數或估算）】\n'
      + `提供給你的紀錄共 ${limitedItems.length} 筆（${byType.map(([k, n]) => k + ' ' + n + ' 筆').join('、')}）`
      + (omittedCount > 0 ? `；另有 ${omittedCount} 筆較舊紀錄未列出` : '') + '\n'
      + `紀錄中出現的業務共 ${bySales.length} 位：${bySales.map(([k, n]) => k + '（' + n + ' 筆）').join('、') || '無'}\n`
      + `紀錄中出現的客戶共 ${byCustomer.length} 家：${byCustomer.map(([k, n]) => k + '（' + n + ' 筆）').join('、') || '無'}`
      + termStats;

    // ── 呼叫 AI，讓它只根據撈到的紀錄回答，不臆測 ──
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
                // 【禁止編造鐵則】2026-10-23 Michelle：「嚴格禁止 AI 自己編，所有回答只能從資料裡面找出來!!!」
                // 程式端：沒比對到關鍵字、或比對到但查無紀錄時，不呼叫 AI，直接回固定的「查無資料」訊息（見上方兩個 return）
                '你是公司內部營業商務資料查詢助理。【最重要規則】嚴格禁止自己編造：所有回答只能來自下面提供的資料紀錄。'
                + '資料紀錄裡沒有出現的客戶、機型、日期、數量、金額、狀態、終端產品，一律回答「查無資料」，或請使用者補充條件（例如完整客戶名稱、機型代碼），'
                + '不可以推測、不可以補完、不可以用常識或一般產業知識填。問題問了好幾個對象、只有部分查得到時，查得到的照資料回答，其餘明確寫「查無資料」。'
                + '如果資料最後註明有省略的紀錄，要提醒使用者還有較舊的資料沒列出，不可以說「沒有」。'
                // 【數字正確】2026-10-25：人數、筆數、台數只能照程式統計或資料原文，不可自己估算
                + '【數字規則】人數、家數、筆數、台數只能照抄「程式統計」或資料紀錄原文的數字，不可以自己數、估算或加總；'
                + '問題問「誰」「哪些客戶」「幾家」「幾位」時，以程式統計裡「內容含某詞」那一行的名單為準：名單上每一位／每一家都要列出，不可以漏，總數照抄那一行的數字；'
                + '若有較舊紀錄未列出，要說明這個名單只涵蓋目前列出的紀錄。'
                + '列出名單時，若要寫「共幾位／幾家」，數字必須等於你實際列出的項目數，不確定就不要寫總數；需要台數總和而資料沒有現成總數時，逐筆列出、不要自己加總。'
                + '一律用繁體中文回答，用自然口語的段落把重點彙整說清楚，就像同事跟你口頭報告一樣；可以用條列式列重點，但絕對不要輸出markdown表格語法（不要用|和---組成的表格），也不要把每一筆原始紀錄的所有欄位都逐條列出——先講結論、再視需要補充關鍵細節（日期、金額、狀態），無關緊要的欄位不用提。如果資料不足以回答，要明確告知使用者資料不足，不要臆測。[CRM需求]紀錄裡的「終端產品」是業務填寫的「客戶的PCB板用在哪些終端應用」（例如AI伺服器、車載、光模組），被問到客戶的終端應用或用途時以這個欄位為準。',
            },
            {
              role: 'user',
              content: `問題：${question}\n\n${programStats}\n\n以下是相關資料紀錄（依最新優先，若有省略會另外註明）：\n${limitedRecords.join('\n')}${omittedCount > 0 ? `\n（還有 ${omittedCount} 筆較舊的紀錄因篇幅限制未列出）` : ''}`,
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
      const errMsg = (aiData && aiData.error && aiData.error.message) || 'AI服務呼叫失敗';
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
    // 這段原本一直沒有成功推播過：少帶Authorization標頭(Supabase Edge Function平台本身就先擋掉)，
    // 且自訂驗證標頭名稱打成x-stats-secret，實際上函式認的是x-push-secret，
    // 照目前運作正常的董事長訪談系統(ocr.js)那套寫法修正
    try {
      const pushRes = await fetch(STATS_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-push-secret': process.env.STATS_PUSH_SECRET,
        },
        body: JSON.stringify({
          system_name: 'wechat',
          api_key_name: 'DEEPINFRA_API_KEY_SALES',
          ai_provider: 'deepinfra',
          ai_model: AI_MODEL,
          asker_email: userEmail || null,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          cache_hit: false,
        }),
      });
      if (!pushRes.ok) {
        const body = await pushRes.text().catch(() => '');
        console.error('[stats-push] 失敗 status=' + pushRes.status + ' body=' + body);
      }
    } catch (e) {
      console.error('[stats-push] 例外:', e && e.message);
    }

    res.status(200).json({
      answer,
      matched_records_count: limitedRecords.length,
      estimated_cost_usd: estimatedCost,
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
