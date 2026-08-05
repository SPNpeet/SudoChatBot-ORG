-- 085: นับค่า AI ของผู้เยี่ยมชม (guest) เข้าเพดานรายวันของแพลตฟอร์ม (5 ส.ค. 2569) — apply บน production แล้ว
--
-- ช่องมองไม่เห็นที่อุด: เพดาน ai_daily_cap_usd ทำงานจาก trigger บน ai_usage_logs
-- แต่ ai_usage_logs.shop_id เป็น NOT NULL — ผู้เยี่ยมชมหน้าแรกไม่มีกิจการ จึงเขียนลงตารางนั้นไม่ได้
-- ผลคือ token ที่ guest เผา (โควตา 300 ครั้ง/วันทั้งแพลตฟอร์ม) ไม่เคยถูกนับเข้าเพดานเงินเลย
-- platform_ai_ok() จึงมองไม่เห็น และหน้าแอดมินแสดงค่าใช้จ่ายต่ำกว่าจริง
--
-- ทางที่เลือก: RPC บวกเข้า platform_ai_daily ตรง ๆ (ไม่แตะ ai_usage_logs ซึ่งเป็นตารางรายกิจการ
-- ที่รายงานและเพดาน OCR รายเดือนใช้อยู่ — ยัดแถวไม่มีเจ้าของลงไปจะทำให้ตัวเลขรายกิจการเพี้ยน)
create or replace function public.bump_platform_ai_cost(p_cost numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into platform_ai_daily (day, cost_usd, calls)
    values ((now() at time zone 'Asia/Bangkok')::date, greatest(coalesce(p_cost, 0), 0), 1)
    on conflict (day) do update
      set cost_usd = platform_ai_daily.cost_usd + greatest(coalesce(p_cost, 0), 0),
          calls = platform_ai_daily.calls + 1;
end $function$;

-- service role เท่านั้น (บทเรียนจาก 082 ที่ลืม revoke แล้วเปิดให้ anon ยิงได้)
revoke execute on function public.bump_platform_ai_cost(numeric) from public, anon, authenticated;
