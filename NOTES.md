# NOTES — 營業商務系統(wechat-message-manager)

首頁卡片「營業商務訊息」→ wechat.tl-home.com。前端直連獨立的 Supabase 專案 `bvuygyajzupeqpqfwmgi`。

## CRM Excel 匯入
- 只有「大總管」看得到「匯入 Excel」按鈕。
- **每次匯入都會先清空整張 crm_records，再放入這次的檔案。** 所以一定要匯入「完整的那份」(所有業務分頁都在裡面),不要只匯入某一位業務的分頁,否則其他人的資料會不見。
- 業務重新補填後,直接重新匯入整份最新 Excel 即可覆蓋舊資料。
- 「已接訂單」「已無需求_結案」分頁不匯入。

## 終端應用分析頁籤(2026-10 新增,游總需求)
- 資料來源:CRM Excel 最後一欄「終端產品」→ 存在 `crm_records.end_product`。
- 計算規則(游總訂,2026-10-15 改版):**以需求台數為主**。每一列機型需求的台數,依「該列」寫的應用類數平分(例:100 台寫 3 類 → 各約 33.3 台),加總後排名。家數僅供參考。
  - 舊版(2026-10-12)是「每個客戶廠區算 1 分」,游總比對後改成台數。
  - 要逐列計算、不能整家合併:業務有時對同一客戶不同機型寫不同應用(例:慶鼎淮安)。
  - 頁面分層:應用排名 → 應用的各機型(最下方合計)→ 點機型展開客戶 → 點客戶看該客戶全部需求;另有「依客戶查看」可搜尋清單、「匯出計算明細」Excel 供逐筆核對。
- 9 大類 + 其他:AI伺服器/伺服器、汽車電子、光模組、消費電子、IC載板/封裝、通訊/網通、工控/醫療/安防、儲存/記憶體、衛星/航太。
- 業務是自由打字,程式用「關鍵字對照表」自動歸類(index.html 搜尋 `END_APP_CATEGORIES`)。寫客戶品牌的也會換成類別(NV/谷歌/亞馬遜→AI伺服器、特斯拉/比亞迪→汽車、華為/華三→通訊)。
- HDI、mSAP、FPC、厚銅板是「PCB 板型/製程」不是終端產品 → **不計分,另外列出**(Michelle 2026-10-12 決定)。
- 只寫「代工廠」→ **先不計分,在備註列出**(Michelle 2026-10-12 決定)。
- 對照表認不出來的寫法會歸「其他」並列出原文,之後可以補關鍵字。
- 同一客戶多個機型時,業務常只在第一列填客戶名稱/終端產品 → 匯入時會「往下沿用」上一列。合併儲存格也會自動展開(黃榮傑分頁就是把好幾個客戶合併成一格寫)。
- 各業務分頁「終端產品」的欄位位置不同(黃榮傑三週並排在第 15 欄,其他人第 11 欄),程式用表頭文字找欄位,不寫死位置。

### 一次性設定:資料庫要先加欄位(✅ 2026-10-12 已完成,Michelle 在 TL_projects 執行成功)
本系統的 Supabase 專案 `bvuygyajzupeqpqfwmgi` = **TL_projects**(TL888888's Org 底下,2026-10-12 於後台確認)。
新功能上線前,要先在 Supabase 加一個欄位,否則終端產品存不進去(其他 CRM 資料仍可照常匯入,匯入完成畫面會跳黃色提醒)。

1. 登入 https://supabase.com/dashboard(用擁有這個專案的帳號;依 ACCOUNT_OVERVIEW.md 推測是 TL_project 那個專案,但尚未在後台核對)
2. 點進 Project URL 是 `bvuygyajzupeqpqfwmgi.supabase.co` 的那個專案(可在「Settings → API」看到 Project URL 核對)
3. 左側選單點「SQL Editor」
4. 貼上下面這一行,按右下角「Run」:

```sql
alter table crm_records add column if not exists end_product text;
```

5. 看到「Success」就完成。之後重新匯入一次 CRM Excel,「終端應用分析」頁籤就會有資料。

## 登入方式:一律依人資系統權限(2026-10-13 起)
- **不再有自己的帳號密碼登入畫面**。權限由 TL_technology 人資系統(HR_manager)的「營業商務訊息」欄位決定。
- 流程:首頁點卡片 → 首頁把登入憑證放在網址 # 後面帶來 → `api/tl-sso.js` 向 TL_technology 確認身分與 `members.wechat_role` → 自動登入(本系統沒帳號會自動建立)。
  直接打開 wechat.tl-home.com 的人會被帶到 `tl-home.com/?goto=wechat`,首頁確認後自動轉回來。
- 人資權限 → 本系統角色:完整(管理員)→ 大總管 admin;讀寫(編輯員)→ 總監 director;僅讀取(瀏覽員,人資存的值是 reader)→ 總監 + 畫面唯讀(看不到新增/編輯/刪除按鈕)。
  **為什麼不用「助理」**:資料庫規則(RLS)裡助理只能看自己地區、且完全看不到 CRM 需求統計;總監才看得到全部。
- 每次從首頁進來都會依「當下」人資權限更新角色;超過 12 小時會自動回首頁重新確認(人資取消權限,最晚 12 小時內失效)。
- ⚠️ Michelle 自己在人資系統的權限要設「完整(管理員)」,否則會變成總監,看不到「匯入 Excel」。
- 緊急備援:網址加 `?pwlogin=1`(例:wechat.tl-home.com/?pwlogin=1)會出現舊的 email+密碼登入框。要永久恢復,把 index.html 的 `LOGIN_FORM_ENABLED` 改 true。
- 「帳號管理」頁籤也暫停(`ACCOUNT_MGMT_ENABLED=false`),程式保留,經理要啟用時改 true。
- 已知限制:瀏覽員的唯讀只做在畫面上,資料庫層級沒有擋(要擋需新增 viewer 角色並改 RLS)。

## 問問AI：等待時的翻書小女生 — 2026-10-14
- 送出問題後，原本泡泡顯示「思考中...」，改成翻書的小女生 + 每 2.5 秒換一句（翻翻商務訊息… → 對照 CRM… → 看看拜訪紀錄跟名片…）。
- 圖和動畫在根目錄 `ai-mascot.js`，**這個檔案是從 TL_technology 複製過來的**（TL 那邊出貨、BOM 等系統也用同一個），改一邊要記得複製到另一邊。
- ⚠️ Michelle 決定小女生的圖和顏色都不要動（綠色制服），只改句子。
- 程式位置：`index.html` 搜尋 `submitAiQuestion`。檔案沒載入成功時會自動退回原本的「思考中...」。
- 機型等級(高階/一般/其他):來自 TL_technology 出貨實績的 `stk_category_mapping` 表,2026-10-15 讀出快照放在 index.html 的 `EA_MODEL_TIERS`。
  出貨實績那邊改了分類要同步:到 TL_technology 的 SQL Editor 執行 `select category_name, stk_no from stk_category_mapping` 後更新。
  CRM 裡的 RU5M 不在出貨實績清單中(顯示「未分類」),要請出貨實績那邊補分類。
- 「應用 × 機型等級」交叉表:點格子看該組合的機型×台數;最下面一列「全部應用合計」= 不分應用看高階/一般各有哪些機型。

## 客戶商務頁籤改後台搜尋(2026-10-16,雲端系統總管派工)
**為什麼改**:拜訪紀錄 visit_records 有 10,230 筆(2026-08-14 一次匯入的歷史資料)。以前登入後網頁會在背景把整張表抓進手機,再在手機上搜尋/篩選/分頁,iPhone 記憶體會吃不消(資料庫計算鐵則)。

**改了什麼**
- 新增後台資料庫函式 `wechat_customer_feed`(SQL 檔:`sql/2026-10-16_wechat_customer_feed.sql`,貼在 **TL_projects**)。
  「客戶商務」頁籤的搜尋、篩選、日期區間、排序、分頁,全部在資料庫裡做,網頁一次只拿一頁(15 筆,約 22 KB)。
  微信訊息 wechat_messages 跟拜訪紀錄是合併顯示的,所以一起併進同一支函式。
- 匯出 Excel:改成向同一支函式每次拿 500 筆、分批拿完。
- 拿掉 `loadVisitFirstPage` / `loadVisitRemainingInBackground`(整張抓的迴圈)、`visitData` 變數、沒在用的 `fetchAllRows()`。
- 輔助函式:`wechat_q_pattern` / `wechat_q_patterns`(搜尋字轉成繁簡互通的比對樣式)、`wechat_date_key`(日期排序鍵)。
- 權限不變:函式用登入者本人的權限執行(security invoker),RLS 照舊,業務仍只看得到自己的資料。

**比對規則跟改版前完全相同**(2026-10-16 用 30 組測試條件逐筆比對舊網頁算法 vs 新函式,結果、筆數、排序全部一致)
- 客戶名稱:微信=company;拜訪=customer
- 機型:微信=model+raw;拜訪=model
- 業務/聯絡人:微信=sales+contact+raw;拜訪=sales
- 全文關鍵字:微信=company+contact+model+price+delivery+status+note+raw;
  拜訪=customer+sales+model+customer_info+competitor+market_info+other+work+work_purpose+next_action
- 繁簡互通、不分大小寫的「包含」比對;日期看不懂的,篩日期區間時不算在內
- 排序:日期新→舊;同一天微信訊息在前、拜訪紀錄在後;再依建立時間新→舊
- 繁簡對照表是從 index.html 的 T2S 自動產生的(產生方式:把 T2S 轉成「每個字→它的繁簡同義字組」的 JSON 寫進 wechat_q_pattern)。
  **若修改 T2S 對照表,要重新產生 SQL**(請 Claude 處理)。
- 效能注意:不要改成「把每筆資料逐字轉簡體再比對」(2026-10-16 測過,一萬筆長文字會慢到無法使用);
  現在是「只轉換搜尋字」(例:報價→[報报][價价])。

**以後要改篩選規則,三處一起改**(網頁查詢與 AI 問答同步鐵則)
1. `sql/2026-10-16_wechat_customer_feed.sql` 的 `wechat_customer_feed`(改完要重新貼到 TL_projects)
2. `index.html` 的 `getUnifiedFilters` / `uniRpcParams` / `renderUnified`(網頁送哪些條件)
3. `api/wechat-ask.js` 的 `fetchFeedByAnyDimension`(AI 問答找微信訊息與拜訪紀錄也是呼叫同一支函式)

## AI 問答(api/wechat-ask.js)2026-10-16 調整
- 找微信訊息、拜訪紀錄改成呼叫 `wechat_customer_feed`(跟網頁同一套比對規則)。客戶/機型/業務三個線索仍是「符合任一個就算」。
  與以前的差異:以前是「欄位值完全相同」才找得到,現在跟網頁一樣是「包含」比對(例如機型欄寫「鑽孔機:RU6HM-125*82台」也找得到 RU6HM-125)。
- CRM 需求加上 `end_product`(終端產品),AI 可以回答「某客戶的終端應用」。
- 各類紀錄合併排序時,日期改用跟網頁相同的排序鍵(避免「2026/9/3」被排到「2026/10/1」後面)。
- 備註:repo 根目錄也有一個 `wechat-ask.js`,跟 `api/wechat-ask.js` 內容不同;Vercel 實際使用的是 `api/` 底下那支,根目錄那支疑似舊檔。
