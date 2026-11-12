# NOTES — 【營業商務訊息】(repo: wechat-message-manager)

首頁卡片「營業商務訊息」→ wechat.tl-home.com。前端直連獨立 Supabase 專案 `bvuygyajzupeqpqfwmgi`(= **TL_projects**,7 個系統共用)。貼 SQL 一律先加專案檢查(全域規則)。
待辦見 `TODO.md`;舊事完整原文見 `NOTES_歷史.md`(新對話不用讀)。

## 教訓索引(開機不讀教訓檔;要做哪類工作前,先讀對應檔,檔在 `教訓\`)
| 做什麼工作時 | 讀哪個檔 |
|---|---|
| 匯入 CRM Excel、重匯、清空問題 | `CRM匯入_每次清空整張表要匯完整Excel.md` |
| 改匯入解析(欄位、合併儲存格、終端產品空白、同名借用) | `CRM匯入_欄位規則合併儲存格與同名借用.md` |
| 改搜尋/比對(機型框、全文框、英數代碼) | `搜尋_短代碼TM會誤抓英文字.md` |
| 動 RLS、`wechat_customer_feed`、查詢變慢 | `效能_RLS逐筆呼叫角色函式很慢.md` |
| 改篩選規則、T2S 繁簡表、ai-mascot、`_t2s.js` | `同步_三處一起改與複製品檔案.md` |
| 動機型等級、共用表 stk_category_mapping | `機型等級_共用表不可改與高階判斷.md` |
| 改 AI 問答的統計、把關、提示詞 | `AI問答_數字由程式算不可讓AI數.md` |
| 改 AI 問答的查詢錯誤、時間詞、逾時 | `AI問答_查詢失敗要照實說不可當查無.md` |
| 換 AI 模型/供應商(Gemini) | `AI問答_換Gemini須實測且思考要關.md` |
| 動登入、權限、緊急備援、SSO | `登入_緊急備援開關與pwlogin已移除.md` |

## 現況(2026-11-12)
- 11/11 已匯入 CRM:14 位業務、331 筆(匯入前庫內只有 11/04 一批 335 筆);終端產品空白 13 列 = 奎源4、奎正2、黃石奎源1、映祥瑞4(此 11 列正常)+滬士電子 B1/C3 各 1。git 無未 push commit。
- 未提交的唯讀 SQL `sql/2026-11-11d_readonly_sheet_counts.sql`;Gemini 換模型尚未實測(見 TODO)。
- 仍空白待業務補:黃石滬士C4P3、滬利微電、滬士電子、泰興電路、勝偉策、健鼎T4、昆山超颖、泰兴(泰国)。
- 「沒填」類備註已全拿掉(11/11):終端應用分析不再顯示未填名單/填寫率;未填的不計入台數。

## 終端應用分析頁籤(游總需求,2026-10)
- 資料:CRM「終端產品」欄 → `crm_records.end_product`(已加欄)。
- 計算(游總訂,10/15):**以需求台數為主**,每列機型台數依「該列」寫的應用類數平分(100 台寫 3 類 → 各 33.3)加總排名;家數僅參考。要逐列算、不能整家合併(同客戶不同機型可寫不同應用)。
- 頁面:應用排名 → 各機型 → 展開客戶 → 該客戶全部需求;「依客戶查看」、「匯出計算明細」供核對;「應用 × 機型等級」交叉表(單位台,各應用列約略值,最下「全部應用合計」為實際台數)。
- 9 大類 + 其他:AI伺服器/伺服器、汽車電子、光模組、消費電子、IC載板/封裝、通訊/網通、工控/醫療/安防、儲存/記憶體、衛星/航太。業務自由打字,靠關鍵字表 `END_APP_CATEGORIES` 歸類(NV/谷歌→AI伺服器、特斯拉/比亞迪→汽車、華為/華三→通訊);認不出的歸「其他」並列原文,可補關鍵字。
- HDI、mSAP、FPC、厚銅板是板型/製程 → **不計分,另列**;只寫「代工廠」→ **不計分,備註列出**(Michelle 10/12)。

## 登入與權限摘要(細節見教訓檔)
- 一律依人資權限登入,無自己的帳密畫面;流程:首頁卡片 → `#tl_sso=` → `api/tl-sso.js` 查 TL_technology `members.wechat_role`。
- **權限設計決定(Michelle 10/17)**:不依業務/地區分層,有人資權限者看全部;RLS 殘留 sales/assistant 分支無害不動。
- AI「歷史問答」有權限者看得到所有人最近 50 筆(Michelle 10/16 決定維持)。
- ⚠ Michelle 在人資系統要設「完整」,否則看不到匯入按鈕。

## 客戶商務頁籤 = 後台搜尋(2026-10-16)
- 為什麼:visit_records 約 10,230 筆(8/14 一次匯入),以前整張抓進手機,iPhone 撐不住(資料庫計算鐵則)。
- 後台函式 `wechat_customer_feed`(現行 SQL:`sql/2026-10-25a_wechat_feed_code_boundary.sql`,取代 16d),搜尋/篩選/日期/排序/分頁全在資料庫,網頁一次 15 筆;匯出每次取 500 筆。微信訊息與拜訪紀錄併同一函式,security invoker、RLS 照舊。
- 比對:客戶=微信 company/拜訪 customer;機型=微信 model+raw/拜訪 model;業務聯絡人=微信 sales+contact+raw/拜訪 sales;全文=多欄位。繁簡互通、不分大小寫包含;日期看不懂的篩日期時不算;排序日期新→舊、同天微信在前。

## AI 問答(api/wechat-ask.js)摘要
- 鐵則:嚴禁編造、只用查到的資料;「先用檢索」:網頁搜尋框查得到的 AI 一定查得到,答案正確為最高原則。
- **模型只有一個**:DeepInfra `openai/gpt-oss-120b`(`AI_MODEL_WECHAT` 可覆蓋,Vercel 實際值待有權限者確認)。**不可加備援模型**。`DEEPINFRA_API_KEY_SALES` **不要刪**。
- 流程:拆詞/查詢 → 3200 字預算(三類各保證名額)挑紀錄 → AI(單次 48 秒、重試 1 次、總 55 秒)→ 程式把關 → 附程式算的【系統統計】。
- 網頁 ↔ AI 對照:客戶/機型/業務框 → `wechat_customer_feed` 的 p_company/p_model/p_person;全文框 → p_keyword;日期 → p_from_key/p_to_key;CRM 統計框 → 同一個 `matchQ`(`api/_t2s.js`)。
- 查詢流程:① 欄位查詢 → 0 筆自動改 ② 全文;英數代碼兩路都查「或」合併;兩路都 0 才回查無。同一詞不同時塞兩欄 AND。搜尋詞中文依標點/連接詞切、去 `QUESTION_FILLERS` 贅詞。
- 小女生翻書動畫在 `ai-mascot.js`(複製自 TL_technology,圖與顏色不動,只改句子)。

## 名片管理已移到行動秘書(2026-10-16)
- Michelle 決定拿掉名片功能,改用行動秘書(TL_technology secretary.html,表 `secretary_cards`)。已拿掉:名片頁籤、`api/business-card-ocr.js`、`api/card-note-repair.js`、AI 查名片(git 歷史可查);AI 問聯絡人電話/email 會查不到,請用行動秘書 AI。
- `business_cards` 表與 6 筆名片(林麗君建)先保留;已匯出轉 Excel 於 `名片交接/`(**已 .gitignore:含個人電話/email,repo 公開不可上傳**)。匯出 SQL `sql/2026-10-17c_readonly_export_business_cards_for_secretary.sql`。
- 名片 OCR 用的 DeepInfra Qwen 視覺模型 2026-09-18 已下架。
