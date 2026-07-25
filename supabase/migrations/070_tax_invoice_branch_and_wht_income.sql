-- ============================================================
--  070 — ข้อมูลที่กฎหมายบังคับบนเอกสารภาษี (apply บน production แล้ว)
--
--  1) shops.branch + fin_docs.contact_branch
--     ประกาศอธิบดีกรมสรรพากร ฉบับที่ 199 บังคับตั้งแต่ 1 ม.ค. 2558 ให้ใบกำกับภาษี
--     เต็มรูประบุ "สำนักงานใหญ่" หรือ "สาขาที่ ....." ของทั้งผู้ขายและผู้ซื้อ
--     ขาดข้อความนี้ = ผู้ซื้อขอคืนภาษีซื้อไม่ได้
--     contacts มี branch อยู่แล้ว แต่ shops ไม่มี และ fin_docs ไม่ได้เก็บ snapshot
--
--  2) fin_docs.wht_income_type
--     ประเภทเงินได้ตาม ม.40 ใช้บนหนังสือรับรอง 50 ทวิ และไฟล์ยื่น ภ.ง.ด.3/53
--     เดิมฮาร์ดโค้ดเป็น "ค่าสินค้า/บริการ" ทุกรายการ = ผิดทุกบรรทัด
-- ============================================================
alter table public.shops
  add column if not exists branch text not null default 'สำนักงานใหญ่';
comment on column public.shops.branch is
  'สำนักงานใหญ่ หรือ สาขาที่ NNNNN — บังคับบนใบกำกับภาษีเต็มรูป (ประกาศอธิบดีฯ 199)';

alter table public.fin_docs
  add column if not exists contact_branch text;
comment on column public.fin_docs.contact_branch is
  'snapshot สาขาของผู้ซื้อ ณ วันออกเอกสาร — เอกสารเก่าต้องไม่เปลี่ยนตามเมื่อแก้ข้อมูลผู้ติดต่อทีหลัง';

alter table public.fin_docs
  add column if not exists wht_income_type text;
comment on column public.fin_docs.wht_income_type is
  'ประเภทเงินได้ตาม ม.40 เช่น 40(8) — ใช้บน 50 ทวิ และไฟล์ยื่น ภ.ง.ด.3/53';

update public.fin_docs
   set wht_income_type = '40(8)'
 where wht_rate > 0 and wht_income_type is null;

update public.fin_docs d
   set contact_branch = c.branch
  from public.contacts c
 where d.contact_id = c.id and d.contact_branch is null and c.branch is not null;
