-- 056: ซื้อแพ็กเกจจ่ายตรง — apply บน production แล้ว
-- topups.plan_code + plan_applied_at + RPC apply_plan_purchase(topup_id):
-- ตัดค่าแพ็กจากเครดิตที่เพิ่งเข้า + เปิดแพ็ก + next_bill_at +1 เดือน (idempotent, service_role เท่านั้น)

-- ⚠️ เพิ่มคำสั่งจริงเมื่อ 5 ส.ค. 2569 — เดิมไฟล์นี้เป็นคอมเมนต์ล้วน 3 บรรทัด
-- (RPC apply_plan_purchase ถูกเขียนใหม่ครบใน 078 แล้ว เหลือแค่คอลัมน์ที่ยังไม่มีที่ไหนเลย)
-- พบตอนทดสอบกู้ข้อมูลจริง: insert ตาราง topups พังเพราะไม่มีคอลัมน์เหล่านี้
-- ผลถ้าไม่มี: ซื้อแพ็กเกจจ่ายตรงทำไม่ได้เลยทั้งเส้น (apply_plan_purchase อ่านสองคอลัมน์นี้)
alter table public.topups
  add column if not exists plan_code       text,          -- รหัสแพ็กที่ซื้อ (null = เติมเครดิตปกติ)
  add column if not exists plan_applied_at timestamptz;   -- เปิดแพ็กแล้วเมื่อไหร่ (กันเปิดซ้ำ)
