-- 079: กันสลิปซ้ำ "ทั้งแพลตฟอร์ม" (5 ส.ค. 2569) — apply บน production แล้ว
-- ก่อนหน้านี้ dedupe แยกโลก: fin_payments กันซ้ำรายร้าน / topups กันซ้ำเฉพาะ topups
-- ผลคือสลิปใบเดียวใช้จ่ายร้าน A แล้วเอาไปจ่ายร้าน B หรือไปเติมเงินแพลตฟอร์มซ้ำได้
-- ตารางนี้คือทะเบียนกลาง: transRef หนึ่งใบ = ใช้ได้ครั้งเดียวทั้งระบบ
create table if not exists slip_refs (
  trans_ref text primary key,
  shop_id uuid,
  source text not null check (source in ('doc_payment','topup')),
  created_at timestamptz not null default now()
);
-- ไม่มี policy = client แตะไม่ได้เลย ใช้ผ่าน service role เท่านั้น
alter table slip_refs enable row level security;

-- backfill ของเดิมทั้งสองทาง — สลิปที่เคยผ่านแล้วต้องห้ามใช้ซ้ำตั้งแต่วันแรกที่ตารางนี้เกิด
insert into slip_refs (trans_ref, shop_id, source, created_at)
  select slip_trans_ref, shop_id, 'doc_payment', coalesce(created_at, now())
  from fin_payments where slip_trans_ref is not null
on conflict (trans_ref) do nothing;
insert into slip_refs (trans_ref, shop_id, source, created_at)
  select slip_trans_ref, shop_id, 'topup', coalesce(created_at, now())
  from topups where slip_trans_ref is not null
on conflict (trans_ref) do nothing;
