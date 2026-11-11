do $$ begin if to_regclass('public.ai_usage_events') is null then raise exception '貼錯專案！這段要貼到 TL_projects，請換專案重貼（什麼都沒改到）'; end if; end $$;
-- 唯讀（只查不改）：匯入新版 CRM 後驗收。會出兩個結果表，請兩個都截圖／回貼：
-- 表1：各批匯入日期與筆數。預期只有 1 批（今天匯入的日期），沒有 2026-11-04 殘留。
-- 表2：終端產品仍空白的客戶與筆數（奎正／奎源／映祥瑞屬正常空白）。
select import_date, count(*) as 筆數, count(distinct customer) as 客戶數,
       count(*) filter (where coalesce(trim(end_product),'') = '') as 終端產品空白筆數
from public.crm_records
group by import_date
order by import_date desc nulls last;

select sales as 業務, replace(customer, E'\n', ' ') as 客戶, count(*) as 空白筆數
from public.crm_records
where coalesce(trim(end_product),'') = ''
  and import_date = (select max(import_date) from public.crm_records)
group by sales, customer
order by sales, 空白筆數 desc;
