-- 專案檢查：貼錯專案會立刻停下、什麼都不改
do $$ begin if to_regclass('public.ai_usage_events') is null then raise exception '貼錯專案！這段要貼到 TL_projects，請換專案重貼（什麼都沒改到）'; end if; end $$;

-- ════════════════════════════════════════════════════════════════════
-- 【營業商務訊息】只讀驗收：英數代碼防誤抓（2026-10-25b）
-- 檔名：sql/2026-10-25b_readonly_verify_code_boundary.sql
-- 要貼到的 Supabase 專案：TL_projects（bvuygyajzupeqpqfwmgi）
--   直接開對專案：https://supabase.com/dashboard/project/bvuygyajzupeqpqfwmgi/sql/new
-- 請在 2026-10-25a_wechat_feed_code_boundary.sql 貼完之後再貼這支。
-- ✅ 只讀：只查詢、不改任何資料，重複執行也安全。
--
-- 看結果（一列）：
--   全文TM筆數        改版前是 858，改版後應該約 851（少掉 7 筆英文字誤抓：FTM、TTM、SmartMapping、TTTMESSAGE、JTMD、ChatTmet）
--   仍有誤抓筆數      應該是 0（結果裡沒有「TM 前後緊接英文字母、而沒有獨立 TM」的資料）
--   機型框TM筆數      應該跟改版前一樣約 127
--   系列代碼DG6Z筆數  應該大於 0（系列代碼仍找得到 DG6ZM、DG6ZM-TM…）
-- ════════════════════════════════════════════════════════════════════

with tm as (
  select r
  from jsonb_array_elements(
         public.wechat_customer_feed(null, null, null, array['TM'], null, null, null, 0, 1000, true) -> 'rows') as r
),
tm_text as (
  select (select string_agg(value, ' ') from jsonb_each_text(r -> 'src')) as txt from tm
)
select
  (public.wechat_customer_feed(null, null, null, array['TM'], null, null, null, 0, 1, false) ->> 'total')::int   as "全文TM筆數",
  (select count(*) from tm_text where txt !~* '(^|[^A-Za-z])TM([^A-Za-z]|$)')                                   as "仍有誤抓筆數",
  (public.wechat_customer_feed(null, array['TM'], null, null, null, null, null, 0, 1, false) ->> 'total')::int   as "機型框TM筆數",
  (public.wechat_customer_feed(null, null, null, array['DG6Z'], null, null, null, 0, 1, false) ->> 'total')::int as "系列代碼DG6Z筆數";
