# 效能:RLS 的 current_user_role() 每筆呼叫一次,很慢
- 發生什麼:客戶商務一頁 7.2~7.5 秒(Supabase 上限 8 秒)。瓶頸是 RLS 規則每筆資料都呼叫 current_user_role();光數拜訪紀錄就 2.5~2.9 秒。
- 修法(16c):讀取規則改 `(select current_user_role())`,計數 2.9→0.14 秒,權限不變(五種角色驗證相同)。16d 函式再優化:每表只掃一次、直接讀欄位。正式站:不篩選 0.9 秒、匯出 10,258 筆約 14 秒。
- 之後:其他表(crm_records、business_cards、wechat_ai_qa_usage_log、各表 update/delete 規則)量大時比照改。
- 不可改成「每筆資料逐字轉簡體再比」(一萬筆長文慢到不能用);現在只轉搜尋字(報價→[報报][價价])。
- 函式直接讀欄位:刪/改名 wechat_messages、visit_records 欄位(contact、competitor…)要同步改 `wechat_customer_feed`。
