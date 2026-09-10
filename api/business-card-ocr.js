// api/business-card-ocr.js
// 名片管理 — 名片 OCR 辨識代理
// 前端把拍到/上傳的名片照片(base64)傳來，這裡呼叫 DeepInfra 的視覺模型辨識文字，
// 整理成跟 business_cards 資料庫欄位一致的 JSON 回傳給前端，
// 前端只會把結果「帶入表單」讓使用者確認/修改後才存檔，這支API本身不會寫入資料庫，也不會保存照片。
//
// 機型欄位會額外做一次「跟資料庫既有機型清單比對校正」，因為名片上就算有印機型代碼，
// OCR辨識常常會抓錯字或漏字（例如「RU6HM」誤判成「RU6HW」），拿已知的正確清單去比對修正，
// 比對邏輯沿用 api/wechat-ask.js 已經在用、驗證過的 stopword排除+片段比對方式。

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvuygyajzupeqpqfwmgi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2dXlneWFqenVwZXFwcWZ3bWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjA5MjQsImV4cCI6MjA5NzczNjkyNH0.zvP-JWgHRWiCKZbqSSU6-uGgx3WHwG0nFxfG8xDhEH8';

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepinfra.com/v1/openai/chat/completions';
const AI_MODEL_OCR = process.env.AI_MODEL_OCR || 'Qwen/Qwen2.5-VL-32B-Instruct';
const AI_API_KEY = process.env.DEEPINFRA_API_KEY_SALES;

// ---- AI用量統計：推播設定（跟 api/wechat-ask.js 用同一支中央統計函式，用ai_model欄位區分是問答還是名片辨識）----
const STATS_PUSH_SECRET = process.env.STATS_PUSH_SECRET;

async function pushUsageStats({ promptTokens, completionTokens, askerEmail }) {
  if (!STATS_PUSH_SECRET) return; // 尚未設定推播密鑰時直接跳過，不報錯
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/stats-ai-usage-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-push-secret': STATS_PUSH_SECRET,
      },
      body: JSON.stringify({
        system_name: 'wechat',
        api_key_name: 'DEEPINFRA_API_KEY_SALES',
        ai_provider: 'deepinfra',
        ai_model: AI_MODEL_OCR,
        asker_email: askerEmail || null,
        prompt_tokens: promptTokens || 0,
        completion_tokens: completionTokens || 0,
        total_tokens: (promptTokens || 0) + (completionTokens || 0),
        cache_hit: false,
      }),
    });
  } catch (e) {
    // 推播失敗不影響本次辨識結果
  }
}

function buildSystemPrompt(currentYear) {
  return '你是專業的名片辨識助理。使用者會傳一張名片照片，文字可能是繁體中文、簡體中文或英文。'
    + '請仔細判讀圖片中的文字，並把結果整理成以下欄位，只能回傳一個JSON物件本身，不要有任何其他文字、不要用markdown的```包住、不要加任何說明：\n'
    + '{"record_date":"","company":"","contact":"","model":"","content":"","note":""}\n'
    + '欄位規則：\n'
    + '- record_date：如果名片上有「手寫或印刷出一組實際日期數字」，判斷規則如下，並轉成YYYY-MM-DD格式填在這裡：\n'
    + '  規則1：三組數字中，只要有一組是4位數（例如2026），那一組就是年份，且順序固定是「年.月.日」。範例："2026.9.6"→年=2026,月=9,日=6→"2026-09-06"；"2026/9/26"→"2026-09-26"；不可以理解成月/日在前。\n'
    + '  規則2：三組數字都是1~2位數、且最後一組是2位數（沒有4位數年份出現）時，順序視為「月/日/年」，年份不足4位要換算成西元年（例如26→2026，用20開頭；99以上這種舊寫法才用19開頭）。範例："9/6/26"→月=9,日=6,年=2026→"2026-09-06"。\n'
    + `  規則3：只寫了「月.日」或「月/日」兩組數字、沒有年份，用今年(西元${currentYear}年)當年份。範例："9/26"→"${currentYear}-09-26"。\n`
    + '  規則4：民國年（例如113、115開頭的年份）要換算成西元年（民國年+1911）再轉成YYYY-MM-DD格式。範例："113.5.10"→西元2024年→"2024-05-10"。\n'
    + '  分隔符號可能是點「.」、斜線「/」或減號「-」，效果一樣，都要能辨識。字跡潦草、無法確定是幾號的話才留空字串，不可以自己編造或推測一個日期去填。\n'
    + '- company：名片上的公司/單位名稱。\n'
    + '- contact：名片上的人名（聯絡人姓名），只填姓名本身，職稱不要放這裡。\n'
    + '- model：如果名片上有印出看起來像產品型號/機型代碼的文字（例如一串英數字組合），填在這裡；名片上通常沒有這個資訊，看不出來就留空字串，絕對不要瞎猜。\n'
    + '- content：名片上「手寫」加註的文字（已經被辨識成record_date的日期，這裡不用重複寫一次），例如手寫的產品代號、備註小字等；沒有其他手寫內容就留空字串。\n'
    + '- note：名片上「印刷體」的其他資訊，例如職稱、電話、email、地址(換行分隔每一項)。\n'
    + '看不清楚、模糊、或無法判斷的欄位，一律留空字串，絕對不要瞎猜或編造內容，尤其是日期欄位，寧可留空也不要猜。';
}

// 模糊比對：跟 api/wechat-ask.js 的 matchFuzzy 邏輯一致，排除常見中文商業用詞當比對片段，
// 避免OCR辨識出的雜訊文字剛好跟某個不相關的機型代碼撞在一起
const FUZZY_STOPWORDS = new Set([
  '股份', '有限', '公司', '集團', '電子', '科技', '工業', '企業', '國際', '實業',
  '控股', '材料', '機械', '精密', '工程', '設備', '技術', '產品', '管理', '系統',
]);

function correctModelAgainstKnownList(rawModel, knownModels) {
  const raw = (rawModel || '').trim();
  if (!raw || !knownModels.length) return raw;

  // 完全一致，不用校正
  if (knownModels.includes(raw)) return raw;

  // 找出「raw包含candidate」或「candidate包含raw」的候選，取重疊長度最長的那個當作校正結果
  let best = null;
  let bestLen = 0;
  for (const candidate of knownModels) {
    if (!candidate) continue;
    let overlapLen = 0;
    if (raw.includes(candidate)) overlapLen = candidate.length;
    else if (candidate.includes(raw)) overlapLen = raw.length;
    else {
      // 再放寬一點：找raw跟candidate之間最長的共同片段（至少3個字，且不是常見商業用詞）
      for (let len = Math.min(raw.length, candidate.length); len >= 3; len--) {
        let found = false;
        for (let i = 0; i + len <= raw.length; i++) {
          const frag = raw.slice(i, i + len);
          if (FUZZY_STOPWORDS.has(frag)) continue;
          if (candidate.includes(frag)) { found = true; break; }
        }
        if (found) { overlapLen = len; break; }
      }
    }
    if (overlapLen > bestLen) { bestLen = overlapLen; best = candidate; }
  }
  // 重疊長度太短（例如只有3個字但candidate本身很長）就不強制替換，避免誤改
  if (best && bestLen >= 3) return best;
  return raw;
}

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

  const { image, mime_type } = req.body || {};
  if (!image || typeof image !== 'string') {
    res.status(400).json({ error: '缺少 image' });
    return;
  }

  if (!AI_API_KEY) {
    res.status(500).json({ error: '伺服器未設定 DEEPINFRA_API_KEY_SALES' });
    return;
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(accessToken);
  if (userErr || !userData || !userData.user) {
    res.status(401).json({ error: '登入狀態已失效，請重新登入' });
    return;
  }

  const dataUrl = image.startsWith('data:') ? image : `data:${mime_type || 'image/jpeg'};base64,${image}`;
  const currentYear = new Date().getFullYear();

  const messages = [
    { role: 'system', content: buildSystemPrompt(currentYear) },
    {
      role: 'user',
      content: [
        { type: 'text', text: '請辨識這張名片，回傳指定格式的JSON，不要有其他文字。' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];

  try {
    const aiRes = await fetch(AI_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({ model: AI_MODEL_OCR, messages, temperature: 0.1 }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('名片OCR AI服務錯誤:', aiRes.status, errText);
      res.status(502).json({ error: 'AI 辨識服務呼叫失敗' });
      return;
    }

    const data = await aiRes.json();
    let raw = (data?.choices?.[0]?.message?.content || '').trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    let fields;
    try {
      fields = JSON.parse(raw);
    } catch (e) {
      console.error('名片OCR結果不是合法JSON:', raw);
      res.status(502).json({ error: 'AI辨識結果格式異常，請重新拍照或直接手動輸入' });
      return;
    }

    // 拿資料庫既有機型清單，校正OCR猜出來的機型文字
    let correctedModel = fields.model || '';
    try {
      const { data: modelRows } = await userClient.rpc('wechat_ai_qa_candidate_models');
      const knownModels = [...new Set((modelRows || []).map((r) => (r.model || '').trim()).filter((v) => v.length >= 2))];
      correctedModel = correctModelAgainstKnownList(fields.model, knownModels);
    } catch (e) {
      // 校正失敗就用原始OCR結果，不擋整個流程
    }

    const usage = data?.usage || {};
    await pushUsageStats({ promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, askerEmail: userData.user.email });

    // 格式防呆：只有真的是YYYY-MM-DD才回傳，避免AI偶爾格式跑掉，前端<input type="date">吃到怪格式會直接顯示空白
    var recordDate = fields.record_date || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) recordDate = '';

    res.status(200).json({
      record_date: recordDate,
      company: fields.company || '',
      contact: fields.contact || '',
      model: correctedModel,
      content: fields.content || '',
      note: fields.note || '',
    });
  } catch (err) {
    console.error('名片OCR辨識發生例外:', err);
    res.status(500).json({ error: 'AI辨識服務發生錯誤' });
  }
};
