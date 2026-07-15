-- ============================================================
--  020 — ใบกำกับภาษีเต็มรูปแบบ (เลขผู้เสียภาษี + VAT 7%)
--  ราคาเป็นแบบรวม VAT (VAT-inclusive): ก่อน VAT = ยอด*100/107
-- ============================================================

-- ข้อมูลผู้ขาย (แพลตฟอร์ม)
alter table public.platform_billing_settings add column if not exists company_name text;
alter table public.platform_billing_settings add column if not exists company_address text;
alter table public.platform_billing_settings add column if not exists tax_id text;
alter table public.platform_billing_settings add column if not exists tax_branch text not null default 'สำนักงานใหญ่';
alter table public.platform_billing_settings add column if not exists vat_registered boolean not null default false;

-- ข้อมูลผู้ซื้อ (ร้านค้า) สำหรับออกใบกำกับภาษี
alter table public.shops add column if not exists billing_name text;
alter table public.shops add column if not exists billing_address text;
alter table public.shops add column if not exists tax_id text;

-- เลขที่ใบกำกับ: รันต่อเนื่องต่อเดือน เช่น INV-202607-0001
alter table public.topups add column if not exists invoice_number text;
create unique index if not exists topups_invoice_number_key on public.topups (invoice_number) where invoice_number is not null;

create table if not exists public.invoice_counters (
  period text primary key,
  n int not null default 0
);
alter table public.invoice_counters enable row level security; -- deny-all: ใช้ผ่าน function เท่านั้น

create or replace function public.next_invoice_number() returns text
language plpgsql security definer set search_path = public as $$
declare v_period text := to_char(now() at time zone 'Asia/Bangkok', 'YYYYMM'); v_n int;
begin
  insert into invoice_counters (period, n) values (v_period, 1)
    on conflict (period) do update set n = invoice_counters.n + 1
    returning n into v_n;
  return 'INV-' || v_period || '-' || lpad(v_n::text, 4, '0');
end $$;
revoke execute on function public.next_invoice_number() from anon, authenticated, public;
grant execute on function public.next_invoice_number() to service_role;

-- ออกเลขใบกำกับอัตโนมัติเมื่อ topup เปลี่ยนเป็น paid (ครอบคลุมทุกช่องทาง: manual/สลิป auto/Omise)
create or replace function public.on_topup_paid_invoice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') and new.invoice_number is null then
    new.invoice_number := public.next_invoice_number();
  end if;
  return new;
end $$;
drop trigger if exists trg_topup_invoice on public.topups;
create trigger trg_topup_invoice before update of status on public.topups
  for each row execute function public.on_topup_paid_invoice();
