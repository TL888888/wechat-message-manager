# 登入:緊急備援開關、?pwlogin=1 已移除、找不到人拒絕登入
- 一律依人資權限登入(完整→admin、讀寫→director、僅讀取→director+唯讀);不用 assistant(RLS 看不到 CRM)。每次依當下權限更新角色,12 小時自動重確認。
- `?pwlogin=1` 已拿掉(它不查人資權限,TL_projects 7 系統共用帳號都能登入)。users 表找不到人/無角色 → 拒絕登入(以前當大總管放行)。
- 緊急備援:首頁/人資壞掉時,index.html `<head>` 最前面 `LOGIN_FORM_ENABLED=false` 改 true 再 push;**用完務必改回 false**。「帳號管理」`ACCOUNT_MGMT_ENABLED=false`,要啟用改 true。
- 瀏覽員唯讀只擋畫面、DB 沒擋(要擋需 viewer 角色改約 6 張表 RLS+tl-sso.js,約半天)。
- 進站不閃兩次:`<head>` 最前先判斷無 `#tl_sso=` 且無 12 小時內登入紀錄 → `location.replace` 回首頁。
