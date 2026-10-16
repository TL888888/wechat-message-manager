-- ════════════════════════════════════════════════════════════════════
-- 【營業商務訊息】只讀：匯出名片給行動秘書（2026-10-17c）
-- 檔名：sql/2026-10-17c_readonly_export_business_cards_for_secretary.sql
-- 要貼到的 Supabase 專案：TL_projects（bvuygyajzupeqpqfwmgi）→ SQL Editor → 整份貼上 → Run
-- ✅ 只讀：只查詢、不改任何資料，重複執行也安全。
--
-- 用途：營業商務訊息的「名片管理」2026-10-16 拿掉，名片改用行動秘書（TL_technology 的 secretary_cards）。
--   business_cards 裡的名片（目前 6 筆，林麗君 9/15～9/16 建的）用這支查出來，
--   欄位名稱直接用行動秘書「匯入 Excel」的格式：日期、公司、聯絡人、電話、手機、Email、地址、備註。
-- 跑完後：結果表右上角 Export → Download CSV，把 CSV 交給 Claude 轉成 .xlsx，
--   再由林麗君登入行動秘書 → 名片管理 → 匯入 Excel（名片會掛在她自己的帳號下）。
-- 「業務」欄只是參考（行動秘書匯入時不會用到），方便確認是不是都是林麗君的名片。
-- ════════════════════════════════════════════════════════════════════

select coalesce(upload_date::text, '') as "日期",
       coalesce(company, '')           as "公司",
       coalesce(contact, '')           as "聯絡人",
       coalesce(phone, '')             as "電話",
       coalesce(mobile, '')            as "手機",
       coalesce(email, '')             as "Email",
       coalesce(address, '')           as "地址",
       coalesce(note, '')              as "備註",
       coalesce(sales, '')             as "業務"
from public.business_cards
order by upload_date, created_at;
