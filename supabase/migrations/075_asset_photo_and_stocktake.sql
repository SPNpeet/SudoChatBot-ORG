-- ============================================================
--  075 — รูปทรัพย์สินจริง + วันที่ตรวจนับ (คำขอเจ้าของ 4 ส.ค. 2569)
--  "ทรัพย์สิน สามารถเพิ่มรูปจริงได้ด้วยและระบุวันที่ทำจะได้ยืนยันได้ด้วยว่าอยู่ที่นั้นจริงๆ"
--
--  ทำไมสำคัญทางบัญชี: ทะเบียนทรัพย์สินที่ไม่เคยตรวจนับ = ตัวเลขในงบไม่มีหลักฐานรองรับ
--  ผู้สอบบัญชีขอดู "หลักฐานการตรวจนับทรัพย์สิน" ทุกปี รูป + วันที่ + คนตรวจ คือหลักฐานนั้น
--  และช่วยจับทรัพย์สินที่หายไปแล้วแต่ยังคิดค่าเสื่อมอยู่ (ค่าใช้จ่ายเกินจริง = เสียภาษีผิด)
--
--  ⚠️ bucket ต้องเป็น private — รูปทรัพย์สินมักติดเลขเครื่อง ที่ตั้ง หน้าตาสำนักงาน
--  ซึ่งเป็นข้อมูลภายในของกิจการ ไม่ใช่ของสาธารณะเหมือนรูปสินค้า
-- ============================================================

-- ⚠️ ต้องห่อด้วยเงื่อนไข "ถ้ามีตารางแล้ว" (แก้ 5 ส.ค. 2569)
-- ตาราง fixed_assets ถูกสร้างบน production ผ่านหน้า SQL Editor ไม่เคยมี DDL ใน repo
-- จนมาเขียนกลับใน migration 090 ซึ่ง "รันทีหลัง" ไฟล์นี้
-- บน clone ใหม่ ไฟล์นี้จึงตายทันที (ตารางยังไม่มี) แล้วไฟล์ที่เหลือไม่ถูกรันเลย
-- บน production: ตารางมีอยู่แล้ว ทำงานเหมือนเดิมทุกประการ
-- บน DB ใหม่: ข้ามตรงนี้ไป แล้ว 090 สร้างตารางพร้อมคอลัมน์เหล่านี้ครบตั้งแต่แรกอยู่แล้ว
do $$
begin
  if to_regclass('public.fixed_assets') is null then
    raise notice 'ข้าม: ยังไม่มีตาราง fixed_assets (migration 090 จะสร้างพร้อมคอลัมน์เหล่านี้ครบ)';
    return;
  end if;

  alter table public.fixed_assets
    add column if not exists photo_path    text,
    add column if not exists verified_on   date,
    add column if not exists verified_by   uuid,
    add column if not exists verified_note text;

  comment on column public.fixed_assets.photo_path    is 'รูปทรัพย์สินจริงใน bucket asset-photos (private) — path ขึ้นต้นด้วย shop_id';
  comment on column public.fixed_assets.verified_on   is 'วันที่ตรวจนับล่าสุด (ยืนยันว่าของอยู่จริง) — หลักฐานให้ผู้สอบบัญชี';
  comment on column public.fixed_assets.verified_by   is 'ผู้ที่ตรวจนับ';
  comment on column public.fixed_assets.verified_note is 'บันทึกตอนตรวจนับ เช่น ที่ตั้งจริง สภาพของ';
end $$;

insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', false)
on conflict (id) do nothing;

-- ขยาย policy เดิมให้ครอบคลุม bucket ใหม่ (กฎเดียวกัน: สมาชิกกิจการนั้นเท่านั้น)
-- ไม่สร้าง policy ใหม่แยก เพราะกฎซ้ำสองที่แล้วอัปเดตไม่พร้อมกันคือสาเหตุบั๊กที่เจอมาแล้ว
drop policy if exists private_member_rw on storage.objects;
create policy private_member_rw on storage.objects
  for all
  using (
    bucket_id = any (array['knowledge','slips','asset-photos'])
    and public.is_shop_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = any (array['knowledge','slips','asset-photos'])
    and public.is_shop_member(((storage.foldername(name))[1])::uuid)
  );
