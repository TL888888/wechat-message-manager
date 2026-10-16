-- ════════════════════════════════════════════════════════════════════
-- 【營業商務訊息】RLS 權限檢查加速（2026-10-16c）
-- 要貼到的 Supabase 專案：TL_projects（bvuygyajzupeqpqfwmgi）→ SQL Editor → 整份貼上 → Run
-- 請在 2026-10-16b 那支貼完之後再貼這支。
--
-- 為什麼：2026-10-16 實測，光是「數一數拜訪紀錄有幾筆」就要約 2.5～2.9 秒。
--   原因是查詢權限規則裡的 current_user_role() 等函式，資料庫會「每一筆資料都重新呼叫一次」（一萬筆＝一萬次）。
--   Supabase 官方建議的寫法是用 (select 函式()) 包起來，資料庫就會「每次查詢只算一次」。
--
-- ⚠ 權限規則「完全不變」：誰看得到哪些資料跟原本一模一樣，只是把同樣的條件換成更快的寫法。
--   原本的條件（2026-10-13 從 pg_policies 讀出）：
--     (current_user_role() = ANY (ARRAY['admin','director']))
--     OR (current_user_role() = 'sales' AND sales = current_user_sales_name())
--     OR (current_user_role() = 'assistant' AND sales_name_to_region(sales) = current_user_region())
--   只改「讀取(SELECT)」的規則；新增/修改/刪除的規則不動。
--   sales_name_to_region(sales) 跟每筆資料的業務有關，必須每筆算，維持原樣。
--
-- 萬一要還原成原本寫法：把下面每段的 (select current_user_role()) 改回 current_user_role()、
--   (select current_user_sales_name()) 改回 current_user_sales_name()、(select current_user_region()) 改回 current_user_region() 再執行一次即可。
-- ════════════════════════════════════════════════════════════════════

alter policy visit_records_select on public.visit_records
  using (
    ((select current_user_role()) = any (array['admin'::text, 'director'::text]))
    or (((select current_user_role()) = 'sales'::text) and (sales = (select current_user_sales_name())))
    or (((select current_user_role()) = 'assistant'::text) and (sales_name_to_region(sales) = (select current_user_region())))
  );

alter policy wechat_messages_select on public.wechat_messages
  using (
    ((select current_user_role()) = any (array['admin'::text, 'director'::text]))
    or (((select current_user_role()) = 'sales'::text) and (sales = (select current_user_sales_name())))
    or (((select current_user_role()) = 'assistant'::text) and (sales_name_to_region(sales) = (select current_user_region())))
  );

-- 貼完後可以用這段確認（唯讀）：兩條規則的條件裡都應該出現「SELECT current_user_role()」
-- select tablename, policyname, qual from pg_policies where policyname in ('visit_records_select','wechat_messages_select');
