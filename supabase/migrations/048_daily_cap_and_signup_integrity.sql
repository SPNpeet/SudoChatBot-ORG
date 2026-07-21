-- 048: (1) เพดานตอบรายวันต่อร้าน แบ่งตามแพ็ก (ฟรีตายตัว ทุกคนเท่ากัน ห้ามเกิน)
--      (2) กันสมัครซ้ำ/แอบใช้ฟรีจากอีเมลแฝง: normalize email (gmail dot/+ ) + บล็อกอีเมลชั่วคราว
--          + 1 ตัวตน (normalized email) สร้างร้านได้ร้านเดียว (บังคับระดับ DB ผ่าน trigger)

-- ============ (1) เพดานรายวันต่อแพ็ก ============
alter table plans add column if not exists daily_reply_cap int; -- null = ไม่จำกัดรายวัน
update plans set daily_reply_cap = 30   where code = 'free';       -- ฟรี: 30/วัน ตายตัว ทุกคนเท่ากัน
update plans set daily_reply_cap = 150  where code = 'mini';
update plans set daily_reply_cap = 400  where code = 'starter';
update plans set daily_reply_cap = 1500 where code = 'pro';
update plans set daily_reply_cap = null where code = 'enterprise'; -- ไม่จำกัด

-- ฟรี = 30/วัน รีเซ็ตทุกวัน (ตั้งโควตาเดือนให้ไม่บีบก่อน -> daily เป็นตัวคุมจริง ใช้ได้ตลอด ไม่ตายกลางเดือน)
update plans set included_replies = 1000,
  features = '["บอทปิดการขายอัตโนมัติ","1 ช่องทาง","ตอบฟรี 30 ข้อความ/วัน (รีเซ็ตทุกวัน)","ไม่ต้องใช้บัตรเครดิต"]'::jsonb
where code = 'free';

-- ตัวนับตอบรายวันต่อร้าน (วันแบบเวลาไทย)
create table if not exists usage_daily (
  shop_id uuid not null,
  day date not null,
  replies_count int not null default 0,
  primary key (shop_id, day)
);
alter table usage_daily enable row level security; -- service role เท่านั้น
create index if not exists usage_daily_day_idx on usage_daily (day);

-- ล้างตัวนับรายวันเก่า (เก็บ 40 วันพอ)
select cron.schedule('cleanup_usage_daily', '40 19 * * *',
  $$ delete from public.usage_daily where day < (now() at time zone 'Asia/Bangkok')::date - 40; $$);

-- bill_bot_reply v4: + เพดานรายวัน (fail-closed hard cap ทุกแพ็ก, นับ weight เหมือนรายเดือน)
drop function if exists public.bill_bot_reply(uuid, text, int);
create or replace function public.bill_bot_reply(p_shop_id uuid, p_ref text default null, p_weight int default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_period text := current_period();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_plan record; v_used int; v_bal numeric; v_price numeric;
  v_w int := greatest(1, least(10, coalesce(p_weight, 1)));
  v_free int; v_paid int; v_charge numeric; v_daily int;
begin
  -- ด่าน 0: เพดาน/สวิตช์ระดับแพลตฟอร์ม
  if not public.platform_ai_ok() then
    return jsonb_build_object('allowed', false, 'reason', 'platform_paused',
      'message', 'ระบบ AI หยุดชั่วคราวโดยผู้ดูแลแพลตฟอร์ม — บอทจะกลับมาเมื่อเปิดใหม่');
  end if;

  -- idempotency
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

  -- ด่านเพดานรายวัน (ตายตัวตามแพ็ก — ฟรีห้ามเกิน 30/วันเด็ดขาด)
  if v_plan.daily_reply_cap is not null then
    insert into usage_daily (shop_id, day, replies_count) values (p_shop_id, v_today, 0)
      on conflict (shop_id, day) do nothing;
    select replies_count into v_daily from usage_daily where shop_id = p_shop_id and day = v_today for update;
    if v_daily + v_w > v_plan.daily_reply_cap then
      if p_ref is not null then delete from billed_refs where ref = p_ref; end if;
      return jsonb_build_object('allowed', false, 'reason', 'daily_cap',
        'message', 'ใช้ครบโควตาตอบรายวันของแพ็กแล้ว บอทจะกลับมาตอบพรุ่งนี้ (อัปเกรดแพ็กเพื่อเพิ่มโควตารายวันได้)');
    end if;
  end if;

  -- โควตารายเดือน / กระเป๋าเงิน
  insert into usage_monthly (shop_id, period, replies_count) values (p_shop_id, v_period, 0)
    on conflict (shop_id, period) do nothing;
  select replies_count into v_used from usage_monthly where shop_id = p_shop_id and period = v_period for update;

  v_free := greatest(0, least(v_plan.included_replies - v_used, v_w));
  v_paid := v_w - v_free;

  if v_paid = 0 then
    update usage_monthly set replies_count = replies_count + v_w where shop_id = p_shop_id and period = v_period;
    update usage_daily set replies_count = replies_count + v_w where shop_id = p_shop_id and day = v_today;
    return jsonb_build_object('allowed', true, 'billed', false, 'remaining_free', v_plan.included_replies - v_used - v_w);
  end if;

  v_price := v_plan.price_per_extra_reply;
  v_charge := round((v_price * v_paid)::numeric, 2);
  select balance into v_bal from wallets where shop_id = p_shop_id for update;
  if coalesce(v_bal, 0) >= v_charge then
    update wallets set balance = balance - v_charge, updated_at = now() where shop_id = p_shop_id returning balance into v_bal;
    update usage_monthly set replies_count = replies_count + v_w, billed_replies = billed_replies + v_paid,
      billed_amount = billed_amount + v_charge where shop_id = p_shop_id and period = v_period;
    update usage_daily set replies_count = replies_count + v_w where shop_id = p_shop_id and day = v_today;
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

-- ============ (2) กันสมัครซ้ำ / แอบใช้ฟรีจากอีเมลแฝง ============

-- normalize email: lowercase, ตัด +tag; gmail/googlemail ตัดจุดด้วย (a.b+x@gmail = ab@gmail)
create or replace function public.normalize_email(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null or position('@' in p) = 0 then lower(trim(coalesce(p, '')))
    else (
      select case
        when d in ('gmail.com', 'googlemail.com')
          then regexp_replace(split_part(l, '+', 1), '\.', '', 'g') || '@gmail.com'
        else split_part(l, '+', 1) || '@' || d
      end
      from (select lower(split_part(trim(p), '@', 1)) l, lower(split_part(trim(p), '@', 2)) d) x
    )
  end
$$;

-- เก็บ normalized email บน profiles + backfill
alter table profiles add column if not exists email_normalized text;
update profiles set email_normalized = public.normalize_email(email) where email is not null and email_normalized is null;
create index if not exists profiles_email_normalized_idx on profiles (email_normalized);

-- อัปเดต handle_new_user ให้เก็บ normalized email ด้วย
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, display_name, email, email_normalized, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1)),
    new.email,
    public.normalize_email(new.email),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- โดเมนอีเมลชั่วคราว/ทิ้งขว้าง ที่ห้ามใช้สมัคร
create table if not exists blocked_email_domains (domain text primary key);
alter table blocked_email_domains enable row level security; -- service role เท่านั้น
insert into blocked_email_domains (domain) values
  ('mailinator.com'),('guerrillamail.com'),('guerrillamail.info'),('sharklasers.com'),
  ('10minutemail.com'),('tempmail.com'),('temp-mail.org'),('tempmail.net'),('throwawaymail.com'),
  ('yopmail.com'),('getnada.com'),('nada.email'),('trashmail.com'),('maildrop.cc'),
  ('dispostable.com'),('fakeinbox.com'),('mailnesia.com'),('tempinbox.com'),('mohmal.com'),
  ('emailondeck.com'),('moakt.com'),('mintemail.com'),('mailcatch.com'),('spam4.me'),
  ('trbvm.com'),('mytemp.email'),('tempr.email'),('discard.email'),('inboxbear.com'),
  ('luxusmail.org'),('1secmail.com'),('emlhub.com'),('mailpoof.com'),('burnermail.io')
on conflict (domain) do nothing;

-- trigger บังคับ integrity ตอนสร้างร้าน (ระดับ DB — เลี่ยงไม่ได้)
create or replace function public.enforce_shop_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_email text; v_norm text; v_domain text;
begin
  select email into v_email from profiles where id = new.owner_id;
  if v_email is null or v_email = '' then return new; end if; -- ไม่มีอีเมล (seed/ระบบ) ข้าม
  v_norm := public.normalize_email(v_email);
  v_domain := split_part(v_norm, '@', 2);

  -- อีเมลชั่วคราว = ห้ามสร้างร้าน
  if exists (select 1 from blocked_email_domains where domain = v_domain) then
    raise exception 'disposable_email' using errcode = 'P0001';
  end if;

  -- 1 ตัวตน (normalized email) = 1 ร้าน กันสมัครซ้ำด้วยอีเมลแฝง/ลบร้านแล้วสมัครใหม่
  if exists (
    select 1 from shops s join profiles pr on pr.id = s.owner_id
    where s.id <> new.id and public.normalize_email(pr.email) = v_norm
  ) then
    raise exception 'duplicate_signup' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists trg_enforce_shop_signup on shops;
create trigger trg_enforce_shop_signup before insert on shops
  for each row execute function public.enforce_shop_signup();
