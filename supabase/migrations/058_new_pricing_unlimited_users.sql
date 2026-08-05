-- 058: โครงสร้างราคาใหม่ (apply บน production แล้ว) — พนักงานไม่จำกัดทุกแพ็ก จำกัดที่ AI/สลิป/จำนวนกิจการ
-- plans: +max_companies +slip_quota · แพ็กใหม่ starter 990 / professional 1990 / executive 3990 / agency 9900
-- free = ทดลองใช้ (AI 30/วัน, สลิป 30/ด, 1 กิจการ) · migrate pro->professional, mini->starter, enterprise->agency
-- RPC: check_slip_quota(shop) ถังกลางต่อเจ้าของ · can_create_company(owner) ลิมิตกิจการตามแพ็ก

-- ⚠️ เพิ่มคำสั่งจริงเมื่อ 5 ส.ค. 2569 — เดิมไฟล์นี้มีแต่คอมเมนต์ 4 บรรทัด ไม่มี SQL เลย
-- (บรรยายว่าทำอะไรไปแล้ว แต่ของจริง apply ผ่านหน้า SQL Editor จึงไม่เคยอยู่ใน repo)
-- พบจากการรัน migration ทั้งชุดบน Postgres เปล่าจริงใน Docker: 076/077/082 ตายเพราะไม่มีคอลัมน์นี้
-- ผลถ้าไม่มี: ไม่มีเพดานจำนวนกิจการและโควตาสลิปเลย = ทุกแพ็กกลายเป็นไม่จำกัด
alter table public.plans
  add column if not exists max_companies integer,   -- null = ไม่จำกัดจำนวนกิจการ
  add column if not exists slip_quota    integer;   -- null = ตรวจสลิปอัตโนมัติไม่จำกัด

comment on column public.plans.max_companies is 'จำนวนกิจการสูงสุดของบัญชีเจ้าของ (null = ไม่จำกัด) — ใช้โดย can_create_company';
comment on column public.plans.slip_quota    is 'โควตาตรวจสลิปอัตโนมัติต่อเดือน นับรวมทุกกิจการของเจ้าของ (null = ไม่จำกัด) — ใช้โดย check_slip_quota';
