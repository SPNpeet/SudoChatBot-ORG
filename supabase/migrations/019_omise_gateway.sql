-- ============================================================
--  019 — Payment gateway Omise (Charges API + PromptPay source)
--  เติมเงินผ่าน Omise แทน trust-based slip (มี settlement จริง)
-- ============================================================

-- topups: ผูกกับ charge ของ gateway
alter table public.topups add column if not exists gateway text not null default 'promptpay_slip';
alter table public.topups add column if not exists charge_id text;
create unique index if not exists topups_charge_id_key on public.topups (charge_id) where charge_id is not null;

-- platform_billing_settings: เลือก gateway + public key (public key ไม่ลับ แสดงฝั่ง client ได้)
alter table public.platform_billing_settings add column if not exists payment_gateway text not null default 'promptpay_slip';
alter table public.platform_billing_settings add column if not exists omise_public_key text;
alter table public.platform_billing_settings drop constraint if exists platform_billing_settings_payment_gateway_check;
alter table public.platform_billing_settings add constraint platform_billing_settings_payment_gateway_check
  check (payment_gateway in ('promptpay_slip','omise'));

-- webhook_events รับ event จาก gateway ได้ (ถ้ามี check constraint platform เดิม ให้ปลดออก)
alter table public.webhook_events drop constraint if exists webhook_events_platform_check;

-- ==== Vault: เก็บ Omise secret key ====
create or replace function public.store_platform_omise_key(p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select id into v_id from vault.secrets where name = 'platform_omise_secret_key';
  if v_id is not null then
    perform vault.update_secret(v_id, p_key);
  else
    perform vault.create_secret(p_key, 'platform_omise_secret_key');
  end if;
end $$;
revoke execute on function public.store_platform_omise_key(text) from anon, public;
grant execute on function public.store_platform_omise_key(text) to authenticated, service_role;

create or replace function public.get_platform_omise_key() returns text
language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'platform_omise_secret_key' limit 1;
$$;
revoke execute on function public.get_platform_omise_key() from anon, authenticated, public;
grant execute on function public.get_platform_omise_key() to service_role;
