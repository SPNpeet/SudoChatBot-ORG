-- ============================================================
--  092 — Stripe เป็นช่องทางรับเงินเพิ่ม (คงของเดิมไว้ทั้งหมด)
--
--  ทำไมเพิ่ม ไม่ใช่แทนที่: ตอนนี้มีลูกค้าจ่ายเงินอยู่จริงบนช่องทางเดิม
--  ถ้าตัด promptpay_slip/omise ทิ้งพร้อมกัน คนที่กำลังจ่ายค้างอยู่จะจ่ายไม่จบ
--  เปลี่ยนช่องทางทำได้ที่หน้าแอดมิน สลับกลับได้ทันทีถ้า Stripe มีปัญหา
--
--  Stripe เหนือกว่าเส้นสลิปตรงจุดที่แพงที่สุดของเรา: ไม่ต้องตรวจสลิปเลย
--  (ไม่พึ่ง SlipOK/EasySlip · ไม่มีสลิปปลอม · ยืนยันทันทีตอนลูกค้าสแกนจ่าย)
--  ยืนยันจากเอกสาร Stripe 5 ส.ค. 2569: บัญชีต้องจดทะเบียนในไทย · สกุลเงิน THB
--  · PromptPay ใช้กับ Checkout โหมด payment ได้ (ไม่รองรับโหมด subscription)
-- ============================================================

-- ---- ช่องทางรับเงินเพิ่มค่า 'stripe' ----
alter table public.platform_billing_settings drop constraint if exists platform_billing_settings_payment_gateway_check;
alter table public.platform_billing_settings add constraint platform_billing_settings_payment_gateway_check
  check (payment_gateway in ('promptpay_slip','omise','stripe'));

-- ==== Vault: secret key + webhook signing secret ====
-- แยกสองตัวโดยตั้งใจ: webhook secret คือกุญแจที่ใช้ "ตรวจว่าใครส่งมา"
-- ถ้าเก็บรวมกันแล้วหลุดตัวเดียว = ทั้งยิงคำสั่งแทนเราได้ และปลอม event ได้พร้อมกัน
create or replace function public.store_platform_stripe_key(p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select id into v_id from vault.secrets where name = 'platform_stripe_secret_key';
  if v_id is not null then
    perform vault.update_secret(v_id, p_key);
  else
    perform vault.create_secret(p_key, 'platform_stripe_secret_key');
  end if;
end $$;
revoke execute on function public.store_platform_stripe_key(text) from anon, public;
grant execute on function public.store_platform_stripe_key(text) to authenticated, service_role;

create or replace function public.store_platform_stripe_webhook_secret(p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select id into v_id from vault.secrets where name = 'platform_stripe_webhook_secret';
  if v_id is not null then
    perform vault.update_secret(v_id, p_key);
  else
    perform vault.create_secret(p_key, 'platform_stripe_webhook_secret');
  end if;
end $$;
revoke execute on function public.store_platform_stripe_webhook_secret(text) from anon, public;
grant execute on function public.store_platform_stripe_webhook_secret(text) to authenticated, service_role;

-- อ่านได้เฉพาะ service_role — ห้าม authenticated อ่าน ไม่งั้นเจ้าของกิจการคนไหนก็ดึงคีย์แพลตฟอร์มได้
create or replace function public.get_platform_stripe_key() returns text
language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'platform_stripe_secret_key' limit 1;
$$;
revoke execute on function public.get_platform_stripe_key() from anon, authenticated, public;
grant execute on function public.get_platform_stripe_key() to service_role;

create or replace function public.get_platform_stripe_webhook_secret() returns text
language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'platform_stripe_webhook_secret' limit 1;
$$;
revoke execute on function public.get_platform_stripe_webhook_secret() from anon, authenticated, public;
grant execute on function public.get_platform_stripe_webhook_secret() to service_role;
