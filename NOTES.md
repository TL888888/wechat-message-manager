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
- 緊急備援(2026-10-17 改):**已拿掉「網址加 ?pwlogin=1」入口**(它不檢查人資權限,TL_projects 是 7 個系統共用,其他系統的帳號也能用舊密碼登入)。
  首頁或人資系統壞掉、真的需要用 email+密碼登入時:把 index.html 的 `var LOGIN_FORM_ENABLED=false;` 改成 `true` 再 push 上線,登入畫面就會出現帳密欄;**用完一定要改回 false 再上線**。
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

### 上線後實測與效能修正(2026-10-16)
- dcb2f2a 上線後,用公司共用帳號(大總管)實測正式站:客戶商務一頁約 7.2~7.5 秒(Supabase 登入者查詢上限 8 秒,太接近)。
- 瓶頸在 **RLS 權限檢查**:visit_records_select 規則裡的 current_user_role() 等函式會「每一筆資料都呼叫一次」,
  光是數一數拜訪紀錄就要約 2.5~2.9 秒;舊版函式又把拜訪紀錄掃了兩次。搜尋文字本身幾乎不花時間。
- 修正 1:`sql/2026-10-16b_wechat_customer_feed_single_scan.sql`:每張表只掃一次。**已被 16d 取代,不用再貼 16b。**
- 修正 1(最終版):`sql/2026-10-16d_wechat_customer_feed_fast.sql`:每張表只掃一次、直接讀欄位(不再 to_jsonb 整列)、比對用長字串只在該條件有填時才組合。測試資料上比 16b 快約 5 倍。
  ⚠ 因為改成直接讀欄位,若以後刪除或改名 wechat_messages / visit_records 的欄位(例如 contact、competitor),要同步改這支函式。
- 修正 2:`sql/2026-10-16c_rls_select_policy_speedup.sql`:visit_records / wechat_messages 的「讀取」規則改成 (select current_user_role()) 寫法
  (Supabase 官方建議),每次查詢只算一次角色。2026-10-16 已貼:拜訪紀錄單純計數從約 2.9 秒降到 0.14 秒。**權限規則不變**,已用測試資料驗證五種角色看得到的資料前後完全相同。
- 其他資料表(crm_records、business_cards 等)的規則也是同樣寫法,資料量變大時可比照修改(見 TODO.md)。

## 機型等級:營業商務訊息只分「高階／一般」(2026-10-16 Michelle 決定)
- 規則:出貨實績對照表(stk_category_mapping)是「高階」的算高階;其他(一般、其他、對照表沒有的機型)全部算「一般」。
  程式:index.html 的 `eaModelTier()`。對照表三分類原樣保留在 `EA_MODEL_TIERS`,方便跟出貨實績對照。
  ⚠ `EA_MODEL_TIERS` 是共用表的「複製品」,不會自動同步:共用表 stk_category_mapping 有改分類時,要請 Claude 同步更新這份。
- ⚠ 共用表 stk_category_mapping 不可改內容、不可改三分類:出貨管理系統、已接未出訂單仍使用「高階／一般／其他」。
- AI 問答(api/wechat-ask.js)目前沒有用到機型等級,所以不用同步改。
- **高階怎麼判斷(Michelle 口述,交接用)**:高階主要是「有 CCD」的機型。
  - 成型機(RU 開頭)型號是「RU + 數字 + H」→ H 代表有 CCD,例如 RU6H、RU6HM、RU2HL。
  - 鑽孔機(DG 開頭)型號是「DG + 數字 + Z」→ Z 代表有 CCD,例如 DG6ZM、DG2ZL。
  - 另外 DG1D 也有 CCD(Michelle 說「標準有點不容易記住」)。
  - 規則跟對照表的差異(2026-10-16 比對 218 個機型,203 個一致):
    - 對照表是高階、但規則抓不到:DG1AF、DG1S-BC、DG6AF、DGGZM、NTL-DG2L、RU6AF、RU6AFL、TM2、TM2-A、TM3、TM3-A、TM4
    - 規則說高階、但對照表原本是一般:DG1D、DG1D2、DG1DX2630 → **DG1D 系列 2026-10-16 已在對照表改為高階**(Michelle 決定,出貨、訂單一起變;營業商務訊息的程式快照 EA_MODEL_TIERS 也同步改了)
  - 所以目前以對照表為準;規則只能當「對照表沒有的新機型」的參考。
- 單位:「應用 × 機型等級」表的數字是 CRM 需求的機型台數。各應用那列依應用類數平分(約略值);最下面「全部應用合計」是實際台數。

## 權限設計決定:一律由人資權限管理、有權限的人看全部(Michelle 2026-10-17)
- Michelle 原話:「之前一開始我們有用後台設定分層管理,後來我覺得要讓人資權限系統管理就好,也就是說,我是華東業務,
  我跟華東總監如果都有人資權限(編寫員),我們兩個都可以看到全部資料」。
- 所以:**不再依業務/地區分層**。從首頁進來,人資權限 完整→大總管(admin)、讀寫→總監(director)、僅讀取→總監＋畫面唯讀,
  總監和大總管在資料庫規則裡都是「看全部」。
- 資料庫 RLS 裡仍保留舊的 sales(業務只看自己)/assistant(助理看自己地區)分支,是早期「後台分層管理」的殘留;
  目前正常登入不會再有人被設成 sales/assistant。殘留項目與清理建議見 TODO.md「權限一致性檢查」。

## 名片管理已移到行動秘書(2026-10-16)
- Michelle 決定:「這個名片系統應該拿掉,因為我們有做一個行動祕書了」。名片統一用行動秘書(TL_technology 的 secretary.html,
  資料表在 TL_technology 專案的 secretary_cards,每張名片綁名片主人 owner_id)。
- 本系統拿掉的東西:「名片管理」頁籤(清單、搜尋、新增、拍照辨識、編輯、刪除)、api/business-card-ocr.js(拍照辨識)、
  api/card-note-repair.js(一次性資料修補腳本)、登入時載入名片、AI 問答查名片的部分。程式都在 git 歷史可查。
- AI 問答拿掉名片後:問「某聯絡人電話/email」「某公司有哪些聯絡人」這類問題會找不到;客戶、機型、業務相關問題照常。
  查聯絡人請用行動秘書的 AI 秘書。
- 環境變數 DEEPINFRA_API_KEY_SALES **不要刪**:AI 問答(api/wechat-ask.js)還在用。
- 補充:拿掉前的名片拍照辨識用 DeepInfra 的 Qwen 視覺模型,DeepInfra 2026-09-18 已下架該模型,所以這功能很可能早就不能用了。
- 資料:business_cards 表與 6 筆名片(林麗君 9/15~9/16 建的)**先保留**,用 sql/2026-10-17c_readonly_export_business_cards_for_secretary.sql
  匯出成行動秘書匯入格式,轉 Excel 給林麗君自己匯入行動秘書。觀察幾天沒問題後再刪表(見 TODO.md)。

## 登入安全修正(2026-10-17,Michelle 決定 A、B 都修)
- A. 拿掉 ?pwlogin=1 緊急入口(見上方「緊急備援」)。
- B. 登入時在 users 表找不到這個人(或沒有角色)→ **拒絕登入**,顯示「您沒有營業商務訊息的權限，請洽人資」並登出。
  以前會「當作大總管」放行。正常從首頁進來的人,api/tl-sso.js 會先依人資權限建好 users 資料,不受影響。
- E. AI「歷史問答」:有權限的人都看得到所有人的提問(最近 50 筆)。**這是 Michelle 2026-10-16 的決定:維持大家都看得到**,不要改成只看自己的。

## 進站不再「閃兩次」(2026-10-19,參考 AI用量統計 39f87ec)
- `<head>` 最前面(還沒畫任何畫面、還沒載入 supabase)先判斷:網址沒有 `#tl_sso=` 憑證、本機也沒有 12 小時內確認過的登入
  (localStorage 的 `sb-bvuygyajzupeqpqfwmgi-auth-token` 裡 app_metadata.tl_wechat_role / tl_sso_at)→ 直接 `location.replace` 回 tl-home.com/?goto=wechat。
- 確認權限時只顯示「正在確認您的權限…」;「回公司首頁」按鈕 8 秒還沒進去才出現。跳轉一律用 replace(按上一頁不會回到中途畫面)。
- 帳密登入開關 `LOGIN_FORM_ENABLED` 移到 `<head>` 最前面那段程式裡(緊急開啟改那裡)。
- 頁面標題/登入畫面/左上角名稱由「訊息管理系統」改為「營業商務訊息」(名稱一致鐵則:首頁卡片＝人資權限＝頁面標題)。

## AI 問答禁止編造(2026-10-23 Michelle:「嚴格禁止 AI 自己編,所有回答只能從資料裡面找出來!!!」)
- api/wechat-ask.js 系統提示開頭加上【最重要規則】:資料紀錄裡沒有的客戶、機型、日期、數量、金額、狀態、終端產品一律回「查無資料」或請使用者補條件,
  不可推測、補完、用常識填;問多個對象只部分查得到時,其餘明確寫「查無資料」;資料有省略時要提醒還有舊資料沒列出。
- 程式端原本就是:沒比對到關鍵字、或比對到但查無紀錄 → 不呼叫 AI,直接回固定訊息,不會硬叫 AI 寫答案。

## AI 問答「先用檢索」(2026-10-24,Michelle 鐵則:網頁搜尋框查得到的,AI 一定要查得到)
網頁搜尋框 ↔ AI 問答對照(api/wechat-ask.js):
| 網頁 | 比對 | AI 問答 |
|---|---|---|
| 客戶商務:客戶/機型/業務聯絡人框 | wechat_customer_feed 的 p_company/p_model/p_person(包含、繁簡) | ① 問題比對到的資料庫名稱 → 同一函式同一參數 |
| 客戶商務:全文關鍵字框 | wechat_customer_feed 的 p_keyword | ② 從問題拆出的搜尋詞 → 同一函式 p_keyword |
| 客戶商務:日期區間 | p_from_key/p_to_key | AI 不篩日期(取最新 30 筆,依日期排序) |
| CRM 需求統計:客戶/機型/業務框 | 網頁 matchQ(包含、繁簡) | 同一個 matchQ(api/_t2s.js,從 index.html 複製) |
- 流程:① 欄位查詢 → 0 筆(或沒比對到名稱)時自動改 ② 全文查詢;問題裡的英數代碼(例 TM、RU6H)沒被①的機型名稱涵蓋時,也一定跑 ②;①②都 0 筆才回「查無資料」。
  各路分開查、結果用「或」合併,同一個詞不會同時塞兩個欄位做 AND。
- 以前的問題(修正前):機型要「問題裡包含完整機型名稱」才算(問 TM 對不到 TM4)、沒有全文查詢(良率、大族、比亞迪這類內文詞查不到)、
  CRM 用「完全相同」比對(網頁打一部分查得到、AI 查不到)。
- 搜尋詞拆法:英數代碼原樣保留;中文用標點與連接詞(和、跟、與、及、或)切開,再去掉問句常用詞(QUESTION_FILLERS 清單,可再補)。
- ⚠ api/_t2s.js 是 index.html 繁簡對照與 matchQ 的複製品,index.html 那邊改了要一起更新。
- **答案正確為主修正(2026-10-24 初版 → 2026-10-25 定案,小科組長要求)**:
  - 英數代碼(TM、DG6Z、RU6H…)「機型欄＋全文」兩路都查、用「或」合併去重(只查機型欄會漏掉約 730 筆拜訪內文真的在講 TM 機台的紀錄)。
  - 防誤抓規則(網頁 SQL wechat_q_pattern 的 p_code 與 api/wechat-ask.js 的 codeRe「完全相同」,只用在機型框、全文框;客戶框/業務框不套):
    - 只看純英數(可含 -)的搜尋字;含數字(TM4、DG6Z、RU6H):前面不能緊接英文字母,後面可接字母(系列代碼找得到 DG6ZM、RU6HM);
    - 純字母且 3 碼以內(TM、GEP):前後都不能緊接英文字母 → 擋掉 FTM、TTM(公司名)、SmartMapping、JTMD、TTTMESSAGE;
    - 純字母 4 碼以上(SAMSUNG、INVESTMENT…):一般包含比對。
  - 實測(2026-10-24 正式資料):全文 TM 858 筆,851 筆真的在講 TM 機台、7 筆英文字誤抓;機型欄 TM 127 筆全部正確。
  - SQL:sql/2026-10-25a_wechat_feed_code_boundary.sql(取代 16d;含 TL_projects 專案檢查),只讀驗收 sql/2026-10-25b_readonly_verify_code_boundary.sql
    (預期:全文TM約 851、仍有誤抓 0、機型框TM約 127、DG6Z>0)。2026-10-25 本機 31 組條件比對全部一致。

- 數字正確(2026-10-25):給 AI 的內容最前面附「程式統計」(提供筆數、各類筆數、出現的業務幾位/客戶幾家),系統提示規定人數/筆數/台數只能照抄程式統計或原文,不可自己數、估算、加總。起因:AI 寫「以上六位」實際只列 5 位。
- 搜尋詞統計(2026-10-26):程式統計另外針對問題裡每個搜尋詞,列出「內容含這個詞」的紀錄筆數、業務名單、客戶名單;問「誰／哪些／幾家」時 AI 必須照名單完整列出、總數照抄(起因:「誰提到良率」8 筆紀錄,AI 一次列 5 位、一次只列 3 位,有漏)。
  統計範圍(2026-10-26 補):搜尋詞的筆數/名單用「系統抓到的全部紀錄」算(CRM 用全部符合的列,不只最新 30 筆),不會因為篇幅只給 AI 看一部分而少算家數。
