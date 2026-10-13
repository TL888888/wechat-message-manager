// api/tl-sso.js
// 「人資系統開權限 → 免密碼登入」（Michelle 2026-10-12 需求）
//
// 流程：
//  1. 使用者在 TL_technology 首頁（tl-home.com）點「營業商務訊息」卡片，
//     首頁把「他在首頁的登入憑證(access token)」放在網址 # 後面帶過來（# 後面的內容不會送到任何伺服器）
//  2. 本系統前端把憑證 POST 到這支 API
//  3. 這裡拿憑證去 TL_technology 的 Supabase 確認身分，並讀人資系統 members 表的 wechat_role
//  4. 有權限的話，在本系統(TL_projects)找到/自動建立同 email 的帳號，角色依人資權限設定，
//     再產生一次性登入碼(magic link token)回傳，前端用它直接登入，不用打密碼
//
// 人資權限 → 本系統角色（角色決定資料庫看得到哪些資料，規則見 NOTES.md）：
//   完整(admin)  → admin   大總管：全部功能
//   讀寫(editor) → director 總監：看得到全部資料、可新增修改刪除
//   僅讀取(reader)→ director 總監＋前端唯讀：畫面上鎖住新增/修改/刪除
//     （注意：人資下拉選單「僅讀取」存的值是 reader，不是 viewer；2026-10-13 曾因寫錯導致瀏覽員進不去）
//     （資料庫層級沒有「唯讀總監」這種角色，唯讀目前只做在畫面上，見 NOTES.md）
//   無權限(none) → 拒絕
// 每次從首頁點進來都會依「當下」人資權限更新角色，所以人資那邊改了，下次點進來就生效。
// 直接到 wechat.tl-home.com 用 email+密碼登入的舊方式仍可用，角色維持資料庫裡最後一次的設定。

const { createClient } = require('@supabase/supabase-js');

const WECHAT_SUPABASE_URL = 'https://bvuygyajzupeqpqfwmgi.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_WECHAT;
// TL_technology 首頁的 Supabase 連線設定：首頁本來就公開提供在 /api/env（anon key 屬公開金鑰），
// 也可以在 Vercel 設環境變數 TL_TECH_SUPABASE_URL / TL_TECH_SUPABASE_KEY 覆蓋
const TL_ENV_URL = 'https://tl-home.com/api/env';

// key = TL_technology HR_manager.html 下拉選單的 option value（none / reader / editor / admin）
const ROLE_MAP = { admin: 'admin', editor: 'director', reader: 'director', viewer: 'director' };

async function getTlTechConfig() {
  if (process.env.TL_TECH_SUPABASE_URL && process.env.TL_TECH_SUPABASE_KEY) {
    return { url: process.env.TL_TECH_SUPABASE_URL, key: process.env.TL_TECH_SUPABASE_KEY };
  }
  const r = await fetch(TL_ENV_URL);
  if (!r.ok) throw new Error('讀不到首頁系統設定');
  const j = await r.json();
  return { url: j.SUPABASE_URL, key: j.SUPABASE_KEY };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: '缺少首頁登入憑證' });
    return;
  }
  if (!SERVICE_KEY) {
    res.status(500).json({ error: '伺服器未設定 SUPABASE_SERVICE_ROLE_KEY_WECHAT' });
    return;
  }

  try {
    // 1. 向 TL_technology 確認身分與人資權限
    const tlCfg = await getTlTechConfig();
    const tl = createClient(tlCfg.url, tlCfg.key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: ud, error: ue } = await tl.auth.getUser(token);
    if (ue || !ud || !ud.user || !ud.user.email) {
      res.status(401).json({ error: '首頁登入狀態已過期，請回首頁重新整理後再點一次卡片' });
      return;
    }
    const tlUser = ud.user;
    const email = tlUser.email.trim().toLowerCase();
    const { data: member, error: me } = await tl.from('members').select('*').eq('id', tlUser.id).maybeSingle();
    if (me) throw new Error('讀取人資權限失敗：' + me.message);
    const hrRole = member && member.wechat_role;
    if (!hrRole || !ROLE_MAP[hrRole]) {
      res.status(403).json({ error: '人資系統尚未開通您的「營業商務訊息」權限，請洽人資或管理員' });
      return;
    }
    const role = ROLE_MAP[hrRole];
    const name = (member.name || '').trim() || email.split('@')[0];

    // 2. 本系統：確保有同 email 的登入帳號（沒有就自動建立，不設密碼）
    const svc = createClient(WECHAT_SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: ce } = await svc.auth.admin.createUser({ email, email_confirm: true });
    if (ce && !/already|registered|exists/i.test(ce.message || '')) throw ce;

    // 3. 產生一次性登入碼（同時取得帳號 id）
    const { data: link, error: le } = await svc.auth.admin.generateLink({ type: 'magiclink', email });
    if (le) throw le;
    const uid = link.user.id;

    // 4. 把人資權限記在帳號上（前端用它判斷是否唯讀；只有伺服器能改 app_metadata，使用者自己改不了）
    await svc.auth.admin.updateUserById(uid, {
      // tl_sso_at：最後一次跟人資系統確認的時間，前端超過 12 小時會自動回首頁重新確認（人資取消權限後最晚 12 小時內失效）
      app_metadata: Object.assign({}, link.user.app_metadata, { tl_wechat_role: hrRole, tl_sso_at: Date.now() }),
    });

    // 5. 本系統的 users 資料表：沒有就新增，有就把角色更新成人資權限對應的角色（業務姓名、地區保留不動）
    const { data: prof, error: pe } = await svc.from('users').select('id,role').eq('id', uid).maybeSingle();
    if (pe) throw pe;
    if (!prof) {
      const { error: ie } = await svc.from('users').insert({ id: uid, email, name, role });
      if (ie) throw ie;
    } else if (prof.role !== role) {
      const { error: upe } = await svc.from('users').update({ role }).eq('id', uid);
      if (upe) throw upe;
    }

    res.status(200).json({ token_hash: link.properties.hashed_token, hr_role: hrRole });
  } catch (e) {
    res.status(500).json({ error: '自動登入失敗：' + (e && e.message ? e.message : String(e)) });
  }
};
