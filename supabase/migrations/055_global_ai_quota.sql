-- 055: Global AI Quota ต่อเจ้าของ (กันปั๊มโควตาหลายบริษัท) — apply บน production แล้ว
-- ดู definition จริง: get_ai_quota_status(uuid), consume_ai_quota(uuid), shops.ai_quota_override
-- โควตางาน AI (purpose assistant/ocr) นับรวมทุกกิจการของเจ้าของ เพดาน = แพ็กที่ดีที่สุดของเจ้าของ
-- แจ้งเตือนอัตโนมัติที่ 80%/95% (ครั้งเดียว/วัน/ระดับ) ผ่านตาราง notifications

-- ⚠️ เพิ่มคำสั่งจริงเมื่อ 5 ส.ค. 2569 — เดิมไฟล์นี้เป็นคอมเมนต์ล้วน (แบบเดียวกับ 056/058)
-- คอลัมน์นี้ถูกสร้างบน production ผ่านหน้า SQL Editor จึงไม่เคยอยู่ใน repo
-- พบตอนทดสอบ "กู้ข้อมูลจากไฟล์สำรองใส่ฐานที่สร้างใหม่" — คำสั่ง insert ตาราง shops พังทั้งก้อน
-- แปลว่าแผนกู้ระบบจะล้มตั้งแต่ตารางแรกที่สำคัญที่สุด โดยไม่มีใครรู้จนถึงวันที่ต้องใช้จริง
-- ผลถ้าไม่มี: get_ai_quota_status อ่านคอลัมน์นี้ -> ระบบโควตา AI ทั้งระบบพัง
alter table public.shops
  add column if not exists ai_quota_override integer;

comment on column public.shops.ai_quota_override is
  'เพดานงาน AI ต่อวันที่ผู้ดูแลแพลตฟอร์มตั้งทับให้ร้านนี้เป็นรายกรณี (null = ใช้ตามแพ็ก)';
