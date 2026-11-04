// 模擬測試:AI 模型切換機制 + 程式把關(2026-11-04)
// ⚠ 用「假的資料庫」＋「假的 AI 伺服器」,不連正式資料、不用任何真金鑰(金鑰全是假字串)。
//   目的:驗證 ① 環境變數切換(網址/模型/金鑰/思考參數/用量推播)正確 ② 模型亂答時程式把關有擋住。
//   不能驗證:真實模型的速度與回答品質(要有 Google/DeepInfra 金鑰,由有權限者在本機或預覽環境實測)。
// 執行:node test/ai-switch-sim.js
const http = require('http');
const Module = require('module');
const path = require('path');

// ── 假的 Supabase ──
const CUSTOMERS = Array.from({ length: 14 }, (_, i) => '測試客戶' + String(i + 1).padStart(2, '0'));
function feedRows(params) {
  const hit = [].concat(params.p_model || [], params.p_keyword || []).some((t) => /^TM/i.test(t));
  if (!hit) return [];
  return CUSTOMERS.slice(0, 5).map((c, i) => ({
    id: i + 1, kind: 'visit', date_key: '2026110' + (i + 1), sales: '業務' + (i % 2), customer: c,
    src: { report_date: '2026/11/0' + (i + 1), customer: c, model: 'TM4', customer_info: '測試資料:討論 TM4 交期', sales: '業務' + (i % 2) },
  }));
}
const crmRows = CUSTOMERS.map((c, i) => ({ import_date: '2026-10-19', customer: c, model: 'TM4', qty: 2, delivery: '12月', status_w1: '', status_w2: '洽談中', sales: '業務' + (i % 3), end_product: 'AI伺服器', created_at: '2026-10-19' }));
function chain(result) {
  const o = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  ['select', 'eq', 'gte', 'not', 'order', 'limit', 'range', 'single', 'insert'].forEach((m) => { o[m] = () => o; });
  return o;
}
const fakeClient = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'test@example.com' } }, error: null }) },
  from: (t) => {
    if (t === 'wechat_ai_qa_settings') return chain({ data: { daily_cost_limit_usd: 5 }, error: null });
    if (t === 'wechat_ai_qa_usage_log') return chain({ data: [], error: null });
    if (t === 'crm_records') {
      const c = chain({ data: crmRows, error: null });
      // 取最新匯入日的那次查詢(select('import_date'))
      c.select = (cols) => (cols === 'import_date' ? chain({ data: [{ import_date: '2026-10-19' }], error: null }) : c);
      return c;
    }
    return chain({ data: [], error: null });
  },
  rpc: (fn, params) => {
    let result;
    if (fn === 'wechat_customer_feed') { const rows = feedRows(params || {}); result = { data: { rows, total: rows.length }, error: null }; }
    else if (fn === 'wechat_ai_qa_candidate_customers') result = { data: CUSTOMERS.map((c) => ({ customer: c })), error: null };
    else if (fn === 'wechat_ai_qa_candidate_models') result = { data: [{ model: 'TM4' }], error: null };
    else result = { data: [{ sales: '業務0' }, { sales: '業務1' }], error: null };
    const o = { then: (res, rej) => Promise.resolve(result).then(res, rej), range: () => ({ then: (res, rej) => Promise.resolve(result).then(res, rej) }) };
    return o;
  },
};
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@supabase/supabase-js') return { createClient: () => fakeClient };
  return origLoad.call(this, req, ...rest);
};

// ── 假的 AI 伺服器 ──
let mode = 'good'; let calls = []; let pushes = [];
const server = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => (b += d)); req.on('end', async () => {
    const body = b ? JSON.parse(b) : {};
    if (req.url.startsWith('/push')) { pushes.push({ headers: req.headers, body }); res.end('{}'); return; }
    calls.push({ url: req.url, auth: req.headers.authorization, body });
    const send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const ok = (text, finish) => send(200, { choices: [{ message: { content: text }, finish_reason: finish || 'stop' }], usage: { prompt_tokens: 1500, completion_tokens: 120 } });
    if (mode === 'reason400' && body.reasoning_effort) return send(400, [{ error: { message: 'Unsupported parameter: reasoning_effort' } }]);
    if (mode === 'good') return ok('查到的資料顯示 TM4 主要有業務0、業務1 的客戶在洽談,多數處於洽談中,交期集中在12月。完整名單與總數請見下方系統統計。');
    if (mode === 'english') return ok('Here are the customers who mentioned TM. (continue with the remaining names)');
    if (mode === 'fabricate') return ok('相關客戶有 ' + CUSTOMERS.join('、') + ',以上都有 TM 需求。');
    if (mode === 'wrongcount') return ok('列出的紀錄中 TM4 都在洽談,共 99 筆。');
    if (mode === 'truncated') return ok('這是被截斷的半截答案', 'length');
    if (mode === 'reason400') return ok('查到的資料顯示 TM4 有多家客戶在洽談,詳見下方系統統計。');
  });
});

function runHandler(question) {
  const handler = require(path.join(__dirname, '..', 'api', 'wechat-ask.js'));
  const out = {};
  const res = { status: (c) => { out.status = c; return res; }, json: (o) => { out.body = o; return res; } };
  const req = { method: 'POST', headers: { authorization: 'Bearer fake-user-token' }, body: { question } };
  return handler(req, res).then(() => out);
}
function freshEnv(extra) {
  Object.keys(process.env).filter((k) => /^(AI_|GEMINI_|DEEPINFRA_|STATS_)/.test(k)).forEach((k) => delete process.env[k]);
  Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY_WECHAT: 'fake', STATS_PUSH_SECRET: 'fake', STATS_PUSH_URL: base + '/push' }, extra);
  Object.keys(require.cache).filter((k) => k.endsWith('wechat-ask.js')).forEach((k) => delete require.cache[k]);
}
let base; let pass = 0, fail = 0;
const check = (name, cond, extra) => { (cond ? pass++ : fail++); console.log((cond ? '  ✔ ' : '  ✘ ') + name + (cond ? '' : '  ← ' + (extra || ''))); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  const GEM = { AI_BASE_URL_WECHAT: base + '/generativelanguage.googleapis.com/v1beta/openai/chat/completions', GEMINI_API_KEY_SALES: 'fake-gemini', AI_MODEL_WECHAT: 'gemini-2.5-flash' };
  const DI = { AI_BASE_URL: base + '/deepinfra.com/v1/openai/chat/completions', DEEPINFRA_API_KEY_SALES: 'fake-deepinfra' };

  console.log('\n【1】完全不設新環境變數(= 現況):模型、金鑰、請求內容要跟以前一樣');
  mode = 'good'; calls = []; pushes = []; freshEnv(DI);
  let r = await runHandler('本月TM有哪些客戶');
  check('模型 = openai/gpt-oss-120b', calls[0] && calls[0].body.model === 'openai/gpt-oss-120b');
  check('用 DeepInfra 金鑰', calls[0] && calls[0].auth === 'Bearer fake-deepinfra');
  check('請求沒有 reasoning_effort', calls[0] && !('reasoning_effort' in calls[0].body));
  check('temperature 0.2 / max_tokens 2000 不變', calls[0].body.temperature === 0.2 && calls[0].body.max_tokens === 2000);
  check('答案含 AI 摘要＋系統統計', /洽談/.test(r.body.answer) && /系統統計/.test(r.body.answer), r.body.answer);
  await new Promise((s) => setTimeout(s, 100));
  check('用量推播 provider=deepinfra / key=DEEPINFRA_API_KEY_SALES', pushes[0] && pushes[0].body.ai_provider === 'deepinfra' && pushes[0].body.api_key_name === 'DEEPINFRA_API_KEY_SALES' && pushes[0].body.ai_model === 'openai/gpt-oss-120b', JSON.stringify(pushes[0] && pushes[0].body));

  console.log('\n【2】切到 Gemini(只設環境變數):');
  mode = 'good'; calls = []; pushes = []; freshEnv({ ...GEM, AI_REASONING_EFFORT_WECHAT: 'none' });
  r = await runHandler('本月TM有哪些客戶');
  check('打到 Gemini 網址', calls[0] && /generativelanguage/.test(calls[0].url));
  check('模型 = gemini-2.5-flash', calls[0].body.model === 'gemini-2.5-flash');
  check('用 Gemini 金鑰(沒把 DeepInfra 金鑰送出去)', calls[0].auth === 'Bearer fake-gemini');
  check('帶 reasoning_effort=none', calls[0].body.reasoning_effort === 'none');
  await new Promise((s) => setTimeout(s, 100));
  check('用量推播 provider=gemini / key=GEMINI_API_KEY_SALES / 模型名', pushes[0] && pushes[0].body.ai_provider === 'gemini' && pushes[0].body.api_key_name === 'GEMINI_API_KEY_SALES' && pushes[0].body.ai_model === 'gemini-2.5-flash', JSON.stringify(pushes[0] && pushes[0].body));

  console.log('\n【3】模型不接受 reasoning_effort(回 400,Gemini 可能回陣列格式):應拿掉參數重送、仍正常回答');
  mode = 'reason400'; calls = []; freshEnv({ ...GEM, AI_REASONING_EFFORT_WECHAT: 'none' });
  r = await runHandler('本月TM有哪些客戶');
  check('共呼叫 2 次(第 2 次沒帶參數)', calls.length === 2 && !('reasoning_effort' in calls[1].body), 'calls=' + calls.length);
  check('最後有正常答案', /TM4/.test(r.body.answer) && !/查詢失敗/.test(r.body.answer), r.body.answer);

  console.log('\n【4】只有 Gemini 網址、卻沒設 Gemini 金鑰:要明講缺哪把金鑰,不可偷用 DeepInfra 金鑰');
  freshEnv({ ...GEM, DEEPINFRA_API_KEY_SALES: 'fake-deepinfra', GEMINI_API_KEY_SALES: '' });
  delete process.env.GEMINI_API_KEY_SALES; calls = [];
  r = await runHandler('本月TM有哪些客戶');
  check('回 500 並寫出 GEMINI_API_KEY_SALES', r.status === 500 && /GEMINI_API_KEY_SALES/.test(r.body.error) && calls.length === 0, JSON.stringify(r));

  console.log('\n【5】模型亂答時,程式把關要擋住(換任何模型都適用)');
  const cases = [['english', '整段英文/偷懶字樣'], ['fabricate', 'AI 自己列出一大串名單'], ['wrongcount', '把筆數編成「共 99 筆」'], ['truncated', '回答被截斷']];
  for (const [m, label] of cases) {
    mode = m; calls = []; freshEnv(DI);
    r = await runHandler('本月TM有哪些客戶');
    check(label + ' → 重問 1 次、仍不合格只回程式統計', calls.length === 2 && r.body.ai_check_failed && /AI 說明未通過檢查/.test(r.body.answer) && /系統統計/.test(r.body.answer) && !/共 99 筆/.test(r.body.answer) && !/Here are/.test(r.body.answer), 'calls=' + calls.length + ' ' + JSON.stringify(r.body).slice(0, 200));
  }

  console.log('\n【6】查無資料(ZZQX999):不呼叫 AI');
  mode = 'good'; calls = []; freshEnv(DI);
  r = await runHandler('ZZQX999 的拜訪紀錄');
  check('回查無資料、AI 呼叫 0 次', calls.length === 0 && /查無資料/.test(r.body.answer), JSON.stringify(r.body).slice(0, 200));

  console.log('\n結果:通過 ' + pass + ' 項,失敗 ' + fail + ' 項');
  server.close();
  process.exit(fail ? 1 : 0);
})();
