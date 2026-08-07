-- ============================================================
--  098 — ทะเบียนทรัพย์สิน: ข้อมูลที่ใช้ "ชี้ตัวของจริง" ได้
--
--  ⚠️ ทำไม (8 ส.ค. 2569)
--  เดิมทะเบียนเก็บแค่ ชื่อ · ราคาทุน · วันที่ได้มา · อายุ · หมายเหตุก้อนเดียว
--  ซึ่งพอสำหรับ "คิดค่าเสื่อม" แต่ไม่พอสำหรับ "ทะเบียนทรัพย์สิน" จริง ๆ
--
--  ปัญหาที่เกิดตอนใช้งานจริง:
--   · มีโน้ตบุ๊ก 5 เครื่องชื่อเหมือนกันหมด ตอนตรวจนับไม่รู้ว่าเครื่องไหนคือแถวไหน
--   · ผู้สอบบัญชีขอดูทะเบียนแล้วสุ่มตรวจของจริง ต้องมีเลขเครื่อง/ที่ตั้ง/ผู้ครอบครอง
--     ไม่งั้นพิสูจน์ไม่ได้ว่าของยังอยู่ (existence) ซึ่งเป็นข้อที่ถูกสุ่มตรวจบ่อยที่สุด
--   · ของหายแล้วไม่มีใครรู้ เพราะไม่เคยรู้ว่าใครถืออยู่
--
--  asset_code = รหัสที่เอาไปติดสติกเกอร์บนตัวของ (ระบบออกให้อัตโนมัติถ้าไม่กรอก)
--  unique ต่อกิจการ เพื่อไม่ให้รหัสซ้ำกันเองแล้วชี้ผิดตัว
-- ============================================================
alter table public.fixed_assets
  add column if not exists asset_code text,       -- รหัสติดตัวของ เช่น FA-2569-0001
  add column if not exists serial_no text,        -- เลขเครื่อง / S/N ที่โรงงานให้มา
  add column if not exists brand_model text,      -- ยี่ห้อ + รุ่น
  add column if not exists location text,         -- ที่ตั้ง เช่น สำนักงานใหญ่ ชั้น 2
  add column if not exists holder text,           -- ผู้ครอบครอง / แผนกที่ใช้
  add column if not exists supplier text,         -- ผู้ขาย
  add column if not exists purchase_ref text;     -- เลขที่ใบกำกับ/ใบเสร็จตอนซื้อ

-- รหัสห้ามซ้ำในกิจการเดียวกัน (ปล่อยว่างได้ — unique ไม่นับ null)
create unique index if not exists fixed_assets_shop_code_uidx
  on public.fixed_assets (shop_id, asset_code) where asset_code is not null;

-- ค้นด้วยเลขเครื่องเป็นสิ่งที่ทำบ่อยที่สุดตอนตรวจนับ
create index if not exists fixed_assets_shop_serial_idx
  on public.fixed_assets (shop_id, serial_no) where serial_no is not null;
