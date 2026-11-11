do $$ begin if to_regclass('public.ai_usage_events') is null then raise exception '貼錯專案！這段要貼到 TL_projects，請換專案重貼（什麼都沒改到）'; end if; end $$;
-- 唯讀：列出 crm_records 目前有哪幾批（匯入日期）、各幾筆、最早/最晚建立時間。不會改任何資料。
-- 預期：只有 1 批（2026-11-04，335 筆）。若出現其他日期（例如 2026-10-19）就是舊資料沒清乾淨。
select import_date, count(*) as 筆數, count(distinct customer) as 客戶數,
       min(created_at) as 最早建立, max(created_at) as 最晚建立
from public.crm_records
group by import_date
order by import_date desc nulls last;
