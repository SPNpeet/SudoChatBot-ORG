-- 035: platform_billing_settings เดิมเปิดให้ authenticated ทุกคน SELECT ทั้งตาราง (รวม tax_id/company_address ที่ไม่ควรเห็นทั่วไป)
-- ยืนยันแล้วว่าทุกจุดในโค้ดตอนนี้อ่านผ่าน service client (bypass RLS) อยู่แล้ว จึงไม่กระทบพฤติกรรมเดิมเลย — อุดช่องเผื่ออนาคต
drop policy if exists pbs_read on platform_billing_settings;
create policy pbs_read_admin on platform_billing_settings for select to authenticated
  using (public.is_platform_admin());

-- ฟังก์ชันสาธารณะ: คืนเฉพาะ 4 ฟิลด์ที่ร้านค้าต้องใช้จริงตอนเติมเงิน (promptpay/omise public key) ให้ client เรียกตรงได้โดยไม่ต้องผ่าน service client
create or replace function public.platform_billing_public()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'promptpay_id', promptpay_id,
    'account_name', account_name,
    'payment_gateway', payment_gateway,
    'omise_public_key', omise_public_key
  ) from platform_billing_settings where id = true;
$$;

revoke all on function public.platform_billing_public() from public;
grant execute on function public.platform_billing_public() to authenticated;
