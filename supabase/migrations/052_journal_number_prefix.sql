-- 052: เพิ่ม prefix JV สำหรับเลขสมุดรายวัน (apply บน production แล้ว)
create or replace function public.next_fin_doc_number(p_shop_id uuid, p_doc_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  v_counter int;
  v_prefix text := case p_doc_type
    when 'quotation' then 'QT'
    when 'invoice' then 'INV'
    when 'receipt' then 'RC'
    when 'expense' then 'EXP'
    when 'journal' then 'JV'
    else 'DOC' end;
begin
  insert into public.fin_doc_counters (shop_id, doc_type, year, counter)
  values (p_shop_id, p_doc_type, v_year, 1)
  on conflict (shop_id, doc_type, year)
  do update set counter = public.fin_doc_counters.counter + 1
  returning counter into v_counter;
  return v_prefix || '-' || v_year || '-' || lpad(v_counter::text, 4, '0');
end $$;
