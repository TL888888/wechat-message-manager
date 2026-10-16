-- ════════════════════════════════════════════════════════════════════
-- 【營業商務訊息】刪除名片表的兩條 interview_access 舊規則（2026-10-17b）
-- 檔名：sql/2026-10-17b_drop_business_cards_interview_access_policies.sql
-- 要貼到的 Supabase 專案：TL_projects（bvuygyajzupeqpqfwmgi）→ SQL Editor → 整份貼上 → Run
--
-- ⚠ 先不要貼！要等 Michelle 看過 2026-10-17a 查出來的名單、決定要刪除後才貼。
--
-- 這兩條規則是「董事長訪談資料庫」（interview-records，已暫停使用）共用資料庫時留下的：
--   只要 email 在 interview_access 名單上，就能看到所有人的名片，還能修改、刪除，不看角色。
-- 刪除後：名片只依正常的角色規則（business_cards_select / insert / update / delete）決定誰能看、能改。
--   大總管、總監看全部；業務看自己的；助理看自己地區的（跟拜訪紀錄一樣）。
-- 不會刪除任何名片資料，也不會動 interview_access 名單本身。
--
-- 萬一要還原，執行下面註解裡的兩段 create policy（條件是 2026-10-13 從 pg_policies 讀出的原樣）：
--   create policy "interview_access users can select business_cards" on public.business_cards
--     for select using (exists (select 1 from interview_access a where a.email = auth.email()));
--   create policy "interview_access users can modify business_cards" on public.business_cards
--     for all using (exists (select 1 from interview_access a where a.email = auth.email()))
--     with check (exists (select 1 from interview_access a where a.email = auth.email()));
-- ════════════════════════════════════════════════════════════════════

drop policy if exists "interview_access users can select business_cards" on public.business_cards;
drop policy if exists "interview_access users can modify business_cards" on public.business_cards;

-- 貼完後確認（只讀）：應該只剩 business_cards_select / insert / update / delete 四條
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'business_cards' order by policyname;
