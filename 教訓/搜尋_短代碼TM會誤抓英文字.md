# 搜尋:短代碼(TM、GEP)會誤抓 FTM、TTM、INVESTMENT
- 發生什麼:全文/機型框搜 TM 會抓到客戶名 INVESTMENT、FTM、SmartMapping 等。
- 規則(10/25,SQL `wechat_q_pattern` p_code 與 `api/wechat-ask.js` codeRe,只用在機型框、全文框;客戶/業務框不套):含數字(TM4、DG6Z)前面不可緊接英文字母、後面可接(找得到 DG6ZM);純字母 ≤3 碼前後都不可接字母;≥4 碼一般包含。
- AI 英數代碼要「機型欄+全文」兩路都查、用「或」合併去重(只查機型欄漏約 730 筆內文在講 TM 機台的拜訪紀錄)。
- 實測:全文 TM 851 筆、誤抓 0;機型框 TM 127 筆。驗收 SQL `sql/2026-10-25b_readonly_verify_code_boundary.sql`;函式 SQL `sql/2026-10-25a_wechat_feed_code_boundary.sql`。
