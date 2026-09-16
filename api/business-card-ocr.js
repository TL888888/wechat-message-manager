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
  return '你是專業的名片辨識助理。使用者會傳一張名片照片（可能是正面或背面），文字可能是繁體中文、簡體中文或英文。'
    + '請仔細判讀圖片中的文字，並把結果整理成以下欄位，只能回傳一個JSON物件本身，不要有任何其他文字、不要用markdown的```包住、不要加任何說明：\n'
    + '{"record_date":"","company":"","contact":"","phone":"","mobile":"","email":"","address":"","note":""}\n'
    + '欄位規則：\n'
    + '- record_date：如果名片上有「手寫或印刷出一組實際日期數字」，判斷規則如下，並轉成YYYY-MM-DD格式填在這裡：\n'
    + '  規則1：三組數字中，只要有一組是4位數（例如2026），那一組就是年份，且順序固定是「年.月.日」。範例："2026.9.6"→年=2026,月=9,日=6→"2026-09-06"；"2026/9/26"→"2026-09-26"；不可以理解成月/日在前。\n'
    + '  規則2：三組數字都是1~2位數、且最後一組是2位數（沒有4位數年份出現）時，順序視為「月/日/年」，年份不足4位要換算成西元年（例如26→2026，用20開頭；99以上這種舊寫法才用19開頭）。範例："9/6/26"→月=9,日=6,年=2026→"2026-09-06"。\n'
    + `  規則3：只寫了「月.日」或「月/日」兩組數字、沒有年份，用今年(西元${currentYear}年)當年份。範例："9/26"→"${currentYear}-09-26"。\n`
    + '  規則4：民國年（例如113、115開頭的年份）要換算成西元年（民國年+1911）再轉成YYYY-MM-DD格式。範例："113.5.10"→西元2024年→"2024-05-10"。\n'
    + '  分隔符號可能是點「.」、斜線「/」或減號「-」，效果一樣，都要能辨識。字跡潦草、無法確定是幾號的話才留空字串，不可以自己編造或推測一個日期去填。\n'
    + '- company：名片上的公司/單位名稱。\n'
    + '- contact：名片上的人名（聯絡人姓名），只填姓名本身，職稱不要放這裡（職稱放note）。\n'
    + '- phone：公司市話/總機號碼（可能標示Tel、電話、辦公室電話），含分機請一併寫上（例如"(02)6639-2000 分機2799"）；有多組市話用換行分隔。\n'
    + '- mobile：手機號碼（可能標示Mobile、行動電話、手機）；有多組用換行分隔。\n'
    + '- email：電子郵件地址；有多組用換行分隔。\n'
    + '- address：地址（可能標示地址、Address）。\n'
    + '- note：其他所有「手寫」加註的文字（除了已經被辨識成record_date的日期以外），以及印刷體上不屬於前面欄位的資訊（例如職稱、部門、傳真、統一編號、公司網址、QR code旁邊的文字說明等）。沒有就留空字串。\n'
    + '這張圖片可能只是名片的其中一面（正面或背面），另一面的資訊不會出現在這張圖片裡是正常的，看不到的欄位留空字串即可，不要假設或編造另一面可能有的內容。\n'
    + '看不清楚、模糊、或無法判斷的欄位，一律留空字串，絕對不要瞎猜或編造內容，尤其是日期欄位，寧可留空也不要猜。';
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

    const usage = data?.usage || {};
    await pushUsageStats({ promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, askerEmail: userData.user.email });

    // 格式防呆：只有真的是YYYY-MM-DD才回傳，避免AI偶爾格式跑掉，前端<input type="date">吃到怪格式會直接顯示空白
    var recordDate = fields.record_date || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) recordDate = '';

    res.status(200).json({
      record_date: recordDate,
      company: fields.company || '',
      contact: fields.contact || '',
      phone: fields.phone || '',
      mobile: fields.mobile || '',
      email: fields.email || '',
      address: fields.address || '',
      note: fields.note || '',
    });
  } catch (err) {
    console.error('名片OCR辨識發生例外:', err);
    res.status(500).json({ error: 'AI辨識服務發生錯誤' });
  }
};
