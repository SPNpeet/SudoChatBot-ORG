-- โทเคนที่ถูก cache — แยกออกจาก input_tokens เพื่อให้ "เพดานเงินต่อวัน" วัดของจริง
--
-- ⚠️ ทำไมเรื่องนี้สำคัญกว่าที่เห็น: platform_ai_ok() เอา sum(cost_usd) ของวันนี้
-- ไปเทียบกับ ai_daily_cap_usd ($5) แล้วตัด AI ของ "ทุกกิจการ" เมื่อถึงเพดาน
-- ถ้า cost_usd สูงเกินจริง = ลูกค้าที่จ่ายเงินโดนตัดกลางคันทั้งที่เรายังไม่ได้ใช้เงินถึงเพดาน
--
-- นี่คือบั๊กชนิดเดียวกับที่เคยเจอและแก้ไปแล้วในทาง OCR (ดูคอมเมนต์ใน src/lib/ai-catalog.ts
-- เรื่อง OCR_COST_BY_PROVIDER: ประมาณเกิน -> เพดานดับที่ ~250 ครั้ง/วัน ทั้งที่เงินจริงซื้อได้ ~1,100)
-- ทางผู้ช่วย AI มีอาการเดียวกันเพราะคิดโทเคนที่ถูก cache ในราคาเต็มทุกตัว
--
-- วัดจริง 13 ส.ค. 2569: คำถามที่เล็กที่สุดในระบบยังใช้ input 4,386 โทเคน
-- เพราะ system prompt + schema ของ tool 26 ตัว ถูกส่งซ้ำทุกครั้ง และซ้ำทุกรอบของลูป agent
-- ก้อนที่ซ้ำแบบนี้คือก้อนที่ทุกค่ายคิดราคาถูกลงเมื่อ cache ติด
--
-- นิยามที่ต้องรักษาไว้: input_tokens นับรวม cached_tokens อยู่แล้วเสมอ
-- (cached_tokens คือ "ส่วนย่อยที่ได้ราคาถูก" ไม่ใช่ยอดเพิ่ม) — ฝั่งโค้ดปรับให้ตรงกันทุกค่ายแล้ว
alter table public.ai_usage_logs
  add column if not exists cached_tokens integer not null default 0;

comment on column public.ai_usage_logs.cached_tokens is
  'ส่วนย่อยของ input_tokens ที่ผู้ให้บริการคิดราคาถูกลงเพราะ cache ติด (0 = ไม่ติด/ไม่รองรับ)';

-- เพิ่มตัวเลข cache เข้าไปในสถานะเกราะกันค่า AI
-- ⚠️ ถ้าไม่มีที่ให้ดู การเก็บ cached_tokens จะไร้ประโยชน์: ไม่มีใครรู้ว่า cache ติดหรือไม่ติด
-- และจะไม่มีวันรู้ว่าที่ "ประหยัดได้" นั้นเกิดขึ้นจริงหรือแค่หวังไว้ (กติกาข้อ 5 ของโปรเจกต์)
create or replace function public.platform_ai_guard_status()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_today date := (now() at time zone 'Asia/Bangkok')::date; v_out jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'day', v_today,
    'cost_usd_today', coalesce((select cost_usd from platform_ai_daily where day = v_today), 0),
    'calls_today', coalesce((select calls from platform_ai_daily where day = v_today), 0),
    'cap_usd', (select ai_daily_cap_usd from platform_billing_settings where id = true),
    'kill_switch', (select ai_kill_switch from platform_billing_settings where id = true),
    'top_shops_today', coalesce((
      select jsonb_agg(x) from (
        select s.name, l.shop_id, round(sum(l.cost_usd)::numeric, 4) as cost_usd, count(*) as calls
        from ai_usage_logs l join shops s on s.id = l.shop_id
        where l.created_at >= (v_today::timestamp at time zone 'Asia/Bangkok')
        group by l.shop_id, s.name order by sum(l.cost_usd) desc nulls last limit 5
      ) x), '[]'::jsonb),
    'last_7d', coalesce((
      select jsonb_agg(x order by x.day) from (
        select day, cost_usd, calls from platform_ai_daily
        where day > v_today - 7 order by day
      ) x), '[]'::jsonb),
    -- ใหม่: cache ติดแค่ไหนใน 7 วัน (นับเฉพาะทางที่รู้ token จริง — ทาง OCR ไม่รู้ จึงไม่นับ)
    'cache_7d', coalesce((
      select jsonb_build_object(
        'in_tokens', coalesce(sum(input_tokens), 0),
        'cached_tokens', coalesce(sum(cached_tokens), 0))
      from ai_usage_logs
      where created_at > now() - interval '7 days' and input_tokens > 0
    ), jsonb_build_object('in_tokens', 0, 'cached_tokens', 0))
  ) into v_out;
  return v_out;
end $function$;
