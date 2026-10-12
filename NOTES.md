# NOTES — 營業商務系統(wechat-message-manager)

首頁卡片「營業商務訊息」→ wechat.tl-home.com。前端直連獨立的 Supabase 專案 `bvuygyajzupeqpqfwmgi`。

## CRM Excel 匯入
- 只有「大總管」看得到「匯入 Excel」按鈕。
- **每次匯入都會先清空整張 crm_records，再放入這次的檔案。** 所以一定要匯入「完整的那份」(所有業務分頁都在裡面),不要只匯入某一位業務的分頁,否則其他人的資料會不見。
- 業務重新補填後,直接重新匯入整份最新 Excel 即可覆蓋舊資料。
- 「已接訂單」「已無需求_結案」分頁不匯入。

## 終端應用分析頁籤(2026-10 新增,游總需求)
- 資料來源:CRM Excel 最後一欄「終端產品」→ 存在 `crm_records.end_product`。
- 計分規則(游總訂):每個客戶廠區算 1 分;寫了 N 類應用,每類各得 1/N 分;加總後排名。機型台數也依同比例分配。
- 9 大類 + 其他:AI伺服器/伺服器、汽車電子、光模組、消費電子、IC載板/封裝、通訊/網通、工控/醫療/安防、儲存/記憶體、衛星/航太。
- 業務是自由打字,程式用「關鍵字對照表」自動歸類(index.html 搜尋 `END_APP_CATEGORIES`)。寫客戶品牌的也會換成類別(NV/谷歌/亞馬遜→AI伺服器、特斯拉/比亞迪→汽車、華為/華三→通訊)。
- HDI、mSAP、FPC、厚銅板是「PCB 板型/製程」不是終端產品 → **不計分,另外列出**(Michelle 2026-10-12 決定)。
- 只寫「代工廠」→ **先不計分,在備註列出**(Michelle 2026-10-12 決定)。
- 對照表認不出來的寫法會歸「其他」並列出原文,之後可以補關鍵字。
- 同一客戶多個機型時,業務常只在第一列填客戶名稱/終端產品 → 匯入時會「往下沿用」上一列。合併儲存格也會自動展開(黃榮傑分頁就是把好幾個客戶合併成一格寫)。
- 各業務分頁「終端產品」的欄位位置不同(黃榮傑三週並排在第 15 欄,其他人第 11 欄),程式用表頭文字找欄位,不寫死位置。

### 一次性設定:資料庫要先加欄位(只要做一次)
新功能上線前,要先在 Supabase 加一個欄位,否則終端產品存不進去(其他 CRM 資料仍可照常匯入,匯入完成畫面會跳黃色提醒)。

1. 登入 https://supabase.com/dashboard(用擁有這個專案的帳號;依 ACCOUNT_OVERVIEW.md 推測是 TL_project 那個專案,但尚未在後台核對)
2. 點進 Project URL 是 `bvuygyajzupeqpqfwmgi.supabase.co` 的那個專案(可在「Settings → API」看到 Project URL 核對)
3. 左側選單點「SQL Editor」
4. 貼上下面這一行,按右下角「Run」:

```sql
alter table crm_records add column if not exists end_product text;
```

5. 看到「Success」就完成。之後重新匯入一次 CRM Excel,「終端應用分析」頁籤就會有資料。
