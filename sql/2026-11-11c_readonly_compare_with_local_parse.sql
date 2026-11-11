do $$ begin if to_regclass('public.ai_usage_events') is null then raise exception '貼錯專案！這段要貼到 TL_projects，請換專案重貼（什麼都沒改到）'; end if; end $$;
-- 唯讀（只查不改）：跟本機試算對照用。會出 2 個結果表，請兩個都截圖／回貼。
-- 表1：各分頁（業務）筆數、終端產品空白筆數。
select sheet as 分頁, count(*) as 筆數, count(*) filter (where coalesce(trim(end_product),'') = '') as 空白筆數
from public.crm_records
where import_date = (select max(import_date) from public.crm_records)
group by sheet order by sheet;

-- 表2：本機試算認為「原本空白」的幾家客戶，資料庫實際存的終端產品（只顯示前40字）
select sheet as 分頁, replace(customer, E'\n', ' ') as 客戶, count(*) as 筆數,
       left(max(end_product), 40) as 終端產品
from public.crm_records
where import_date = (select max(import_date) from public.crm_records)
  and (customer like '%黃石滬士%' or customer like '%泰興電路%' or customer like '%滬利微電%'
       or customer like '%勝偉策%' or customer like '%健鼎T4%' or customer like '%昆山超颖%' or customer like '%泰兴%')
group by sheet, customer order by sheet, customer;
