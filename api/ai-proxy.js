// ══════════════════════════════════════════════════════════════
// Vercel API route: /api/ai-proxy
// 用途：純轉發。瀏覽器改成呼叫這支API（走 wechat.tl-home.com，
//      已確認中國大陸連得上），由 Vercel 伺服器端（美國/香港等節點，
//      不在中國大陸境內）去呼叫原本的 Cloudflare Worker，
//      繞開「瀏覽器直接連 Cloudflare Worker 在大陸不穩定」的問題。
//
// 這支API完全不碰Groq金鑰、不改動Worker內部邏輯，單純原封不動
// 把前端送來的內容轉發給Worker，再把Worker的回應轉發回前端。
//
// 部署方式：這個檔案要放在 GitHub repo 的 /api/ai-proxy.js
//          （repo根目錄下新增一個api資料夾，裡面放這個檔案），
//          commit後Vercel會自動偵測並部署成一支API路由。
// ══════════════════════════════════════════════════════════════

const WORKER_URL = 'https://withered-sound-43b8.michelle-chang.workers.dev';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const workerResp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const text = await workerResp.text();
    res.status(workerResp.status);
    res.setHeader('Content-Type', workerResp.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: 'Proxy error: ' + (e && e.message ? e.message : String(e)) });
  }
};
