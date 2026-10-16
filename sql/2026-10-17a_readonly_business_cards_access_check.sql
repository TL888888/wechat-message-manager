-- ════════════════════════════════════════════════════════════════════
-- 【營業商務訊息】只讀查詢：名片表的權限規則＋interview_access 名單（2026-10-17a）
-- 檔名：sql/2026-10-17a_readonly_business_cards_access_check.sql
-- 要貼到的 Supabase 專案：TL_projects（bvuygyajzupeqpqfwmgi）→ SQL Editor → 整份貼上 → Run
-- ✅ 只讀：只查詢、不改任何資料或設定，重複執行也安全。
--
-- 目的：名片表 business_cards 除了正常的角色規則外，還有兩條「interview_access」舊規則
--   （名單上的人可以看到並修改/刪除所有名片）。先列出名單與規則，讓 Michelle 決定要不要刪。
-- 結果會有兩段（SQL Editor 可能只顯示最後一段；看不到第一段的話，把第二段刪掉再 Run 一次）。
-- ════════════════════════════════════════════════════════════════════

-- 第一段：business_cards 目前所有的權限規則（名稱、適用動作、條件）
select policyname as 規則名稱,
       cmd        as 適用動作,      -- SELECT=讀取、INSERT=新增、UPDATE=修改、DELETE=刪除、ALL=全部
       qual       as 條件,
       with_check as 寫入條件
from pg_policies
where schemaname = 'public' and tablename = 'business_cards'
order by policyname;

-- 第二段：interview_access 名單（這些 email 目前可以看到並修改/刪除所有名片）
select * from public.interview_access order by 1;
