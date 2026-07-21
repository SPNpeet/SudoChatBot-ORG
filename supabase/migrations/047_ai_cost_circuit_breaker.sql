-- 047: เกราะกันเงินค่า AI รั่ว (Postgres ล้วน — ไม่ต้องจ่ายบริการเพิ่ม)
--   (1) เพดานค่า AI ต่อวันทั้งแพลตฟอร์ม + สวิตช์ปิดฉุกเฉิน (circuit breaker)
--       -> การันตี: ไม่ว่าเกิดอะไร (โดนสแปม/บั๊ก/ลูกค้าฟรีทะลัก) ค่า AI/วัน ไม่เกินที่เจ้าของยอม
--   (2) rate limit ต่อ "ลูกค้ารายคน" — เดิมนับต่อร้านล้วน ลูกค้า/ผู้โจมตีคนเดียวเผาโควตาทั้งร้านได้
--   หมายเหตุ: การหยุดบอทตอนโควตา+เครดิตหมด มีอยู่แล้ว (bill_bot_reply เช็คก่อนเรียก AI) —
--   migration นี้เพิ่ม "เพดานรวมของแพลตฟอร์ม" เป็นตาข่ายนิรภัยชั้นบนสุด

-- ============ (1) Circuit breaker ============
alter table platform_billing_settings
  add column if not exists ai_daily_cap_usd numeric,          -- null = ไม่จำกัด (เจ้าของตั้งเอง)
  add column if not exists ai_kill_switch boolean not null default false;

-- ตัวนับค่า AI สะสมรายวัน (วันแบบเวลาไทย) — trigger เป็นคนอัปเดต ไม่ต้อง scan ทั้งตารางตอนเช็ค
create table if not exists platform_ai_daily (
  day date primary key,
  cost_usd numeric not null default 0,
  calls int not null default 0
);
alter table platform_ai_daily enable row level security; -- service role เท่านั้น

create or replace function public._bump_platform_ai_daily()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into platform_ai_daily (day, cost_usd, calls)
    values ((now() at time zone 'Asia/Bangkok')::date, coalesce(new.cost_usd, 0), 1)
    on conflict (day) do update
      set cost_usd = platform_ai_daily.cost_usd + coalesce(new.cost_usd, 0),
          calls = platform_ai_daily.calls + 1;
  return new;
end $$;

drop trigger if exists trg_bump_platform_ai_daily on ai_usage_logs;
create trigger trg_bump_platform_ai_daily
  after insert on ai_usage_logs
  for each row execute function public._bump_platform_ai_daily();

-- เช็คว่าแพลตฟอร์มยังให้เรียก AI ได้ไหม (kill switch ปิด? เกินเพดานวันนี้?)
create or replace function public.platform_ai_ok()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_kill boolean; v_cap numeric; v_spent numeric;
begin
  select ai_kill_switch, ai_daily_cap_usd into v_kill, v_cap
    from platform_billing_settings where id = true;
  if coalesce(v_kill, false) then return false; end if;
  if v_cap is null then return true; end if;
  select coalesce(cost_usd, 0) into v_spent
    from platform_ai_daily where day = (now() at time zone 'Asia/Bangkok')::date;
  return coalesce(v_spent, 0) < v_cap;
end $$;

revoke all on function public.platform_ai_ok() from public, anon;
grant execute on function public.platform_ai_ok() to service_role, authenticated;

-- สถานะให้หน้าแอดมินดู (ค่าวันนี้ เพดาน สวิตช์ ร้านที่กินเยอะสุด)
create or replace function public.platform_ai_guard_status()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
      ) x), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

revoke all on function public.platform_ai_guard_status() from public, anon;
grant execute on function public.platform_ai_guard_status() to authenticated;

-- ตั้งเพดาน / สลับสวิตช์ (แอดมินแพลตฟอร์มเท่านั้น)
create or replace function public.set_platform_ai_guard(p_cap_usd numeric, p_kill boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  update platform_billing_settings
    set ai_daily_cap_usd = case when p_cap_usd is null or p_cap_usd <= 0 then null else p_cap_usd end,
        ai_kill_switch = coalesce(p_kill, false),
        updated_at = now()
    where id = true;
  insert into audit_logs (actor_type, actor_id, action, resource_type, details)
    values ('user', (select auth.uid())::text, 'platform_ai_guard_set', 'platform_billing_settings',
      jsonb_build_object('cap_usd', p_cap_usd, 'kill_switch', p_kill));
end $$;

revoke all on function public.set_platform_ai_guard(numeric, boolean) from public, anon;
grant execute on function public.set_platform_ai_guard(numeric, boolean) to authenticated;

-- ============ bill_bot_reply: เพิ่มด่านแพลตฟอร์มไว้บนสุด ============
-- (ทุกข้อความบอทตอบลูกค้า/คอมเมนต์ ผ่านฟังก์ชันนี้ = จุดกั้นเดียวคุมได้หมด)
drop function if exists public.bill_bot_reply(uuid, text, int);

create or replace function public.bill_bot_reply(p_shop_id uuid, p_ref text default null, p_weight int default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_period text := current_period();
  v_plan record; v_used int; v_bal numeric; v_price numeric;
  v_w int := greatest(1, least(10, coalesce(p_weight, 1)));
  v_free int; v_paid int; v_charge numeric;
begin
  -- ด่าน 0: เพดาน/สวิตช์ระดับแพลตฟอร์ม — เกิน/ปิด = หยุดก่อนเผา AI (ยังไม่จอง ref จะได้ลองใหม่รอบหน้า)
  if not public.platform_ai_ok() then
    return jsonb_build_object('allowed', false, 'reason', 'platform_paused',
      'message', 'ระบบ AI หยุดชั่วคราวโดยผู้ดูแลแพลตฟอร์ม (เกินเพดานค่าใช้จ่ายรายวันหรือปิดฉุกเฉิน) — บอทจะกลับมาเมื่อเปิดใหม่');
  end if;

  -- idempotency: ref เดิมเคยบิลแล้ว -> ทำต่อโดยไม่หักซ้ำ
  if p_ref is not null then
    insert into billed_refs (ref, shop_id) values (p_ref, p_shop_id) on conflict (ref) do nothing;
    if not found then
      return jsonb_build_object('allowed', true, 'billed', false, 'dedup', true);
    end if;
  end if;

  select p.* into v_plan from shops s join plans p on p.code = s.plan where s.id = p_shop_id;
  if not found then
    select * into v_plan from plans where code = 'free';
  end if;

  insert into usage_monthly (shop_id, period, replies_count) values (p_shop_id, v_period, 0)
    on conflict (shop_id, period) do nothing;
  select replies_count into v_used from usage_monthly where shop_id = p_shop_id and period = v_period for update;

  v_free := greatest(0, least(v_plan.included_replies - v_used, v_w));
  v_paid := v_w - v_free;

  if v_paid = 0 then
    update usage_monthly set replies_count = replies_count + v_w where shop_id = p_shop_id and period = v_period;
    return jsonb_build_object('allowed', true, 'billed', false, 'remaining_free', v_plan.included_replies - v_used - v_w);
  end if;

  v_price := v_plan.price_per_extra_reply;
  v_charge := round((v_price * v_paid)::numeric, 2);
  select balance into v_bal from wallets where shop_id = p_shop_id for update;
  if coalesce(v_bal, 0) >= v_charge then
    update wallets set balance = balance - v_charge, updated_at = now() where shop_id = p_shop_id returning balance into v_bal;
    update usage_monthly set replies_count = replies_count + v_w, billed_replies = billed_replies + v_paid,
      billed_amount = billed_amount + v_charge where shop_id = p_shop_id and period = v_period;
    insert into wallet_transactions (shop_id, type, amount, balance_after, ref_type, ref_id, note)
      values (p_shop_id, 'debit', -v_charge, v_bal, 'bot_reply', p_ref, 'ค่าบอทตอบเกินโควตา');
    return jsonb_build_object('allowed', true, 'billed', true, 'charged', v_charge, 'balance', v_bal);
  else
    if p_ref is not null then delete from billed_refs where ref = p_ref; end if;
    return jsonb_build_object('allowed', false, 'reason', 'insufficient_credit',
      'message', 'เครดิตหมดและใช้เกินโควตาแพ็กเกจแล้ว กรุณาเติมเงินหรืออัปเกรดแพ็กเกจ');
  end if;
end $$;

revoke all on function public.bill_bot_reply(uuid, text, int) from public, anon, authenticated;
grant execute on function public.bill_bot_reply(uuid, text, int) to service_role;

-- ============ (2) rate limit ต่อลูกค้ารายคน ============
create table if not exists customer_rate_counters (
  channel_id uuid not null,
  platform_user_id text not null,
  bucket timestamptz not null,
  n int not null default 1,
  primary key (channel_id, platform_user_id, bucket)
);
alter table customer_rate_counters enable row level security; -- service role เท่านั้น

-- นับข้อความต่อลูกค้าต่อนาที (คนจริงไม่พิมพ์เกิน ~15 ครั้ง/นาที) — เพิ่มก่อนเช็คเสมอ กันสแปมรีเซ็ตไม่ได้
create or replace function public.check_customer_rate_limit(p_channel_id uuid, p_user_id text, p_limit int default 15)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_n int;
begin
  insert into customer_rate_counters (channel_id, platform_user_id, bucket, n)
    values (p_channel_id, p_user_id, date_trunc('minute', now()), 1)
    on conflict (channel_id, platform_user_id, bucket) do update set n = customer_rate_counters.n + 1
    returning n into v_n;
  return v_n <= greatest(1, p_limit);
end $$;

revoke all on function public.check_customer_rate_limit(uuid, text, int) from public, anon, authenticated;
grant execute on function public.check_customer_rate_limit(uuid, text, int) to service_role;

-- ล้างตัวนับลูกค้าเก่าทุกวัน (รวมกับงานล้าง rate_limit_counters เดิม)
select cron.schedule('cleanup_customer_rate', '5 19 * * *',
  $$ delete from public.customer_rate_counters where bucket < now() - interval '2 hours'; $$);
