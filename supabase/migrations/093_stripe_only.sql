-- ============================================================
--  093 — เหลือช่องทางรับเงินเดียว: Stripe
--
--  ตัด PromptPay+อัปสลิป และ Omise ออกทั้งหมด (5 ส.ค. 2569 ตามคำสั่งเจ้าของ)
--  ทำไมตัดได้โดยไม่มีใครเดือดร้อน: ตรวจก่อนตัด ตาราง topups มี 7 แถว
--  เป็น rejected 5 / expired 2 ไม่มีแถวไหนเป็น pending, verifying หรือ paid เลย
--  แปลว่าไม่มีใครค้างจ่ายอยู่ และไม่เคยมีใครจ่ายผ่านสองเส้นนั้นสำเร็จ
--
--  ทำไมบังคับที่ฐานข้อมูลด้วย ไม่ใช่แค่ลบโค้ด: กติกาข้อ 3 ของโปรเจกต์ —
--  "ถ้าต้องการให้ห้าม ให้ throw อย่าเขียน prompt ขอ" ถ้าเหลือ CHECK ที่ยังรับ
--  'promptpay_slip' ไว้ วันหลังมีคนเผลอเขียนค่านั้นกลับเข้าไป ระบบจะกลับไปอยู่ใน
--  สถานะที่ไม่มีโค้ดรองรับแล้ว = หน้าจ่ายเงินตายเงียบโดยไม่มี error ให้เห็น
--
--  ⚠️ ไม่ลบ secret ของ Omise ออกจาก vault — เป็นคีย์ของเจ้าของ ให้เจ้าของ
--  ไปเพิกถอนที่ฝั่ง Omise เอง (ลบฟังก์ชันอ่านแล้ว ไม่มีทางในระบบนี้อ่านมันได้อีก)
-- ============================================================

-- ---- 1) ลบแนวคิด "เลือกช่องทาง" ทิ้ง ----
-- เคยลองบีบ CHECK ให้เหลือ 'stripe' ค่าเดียวก่อน แล้วตัวทดสอบกู้ระบบจับได้ว่า
-- ไฟล์สำรองเก่า (ซึ่งมีค่า 'promptpay_slip') กู้กลับไม่ได้เลยทั้งไฟล์
-- คอลัมน์ที่เหลือค่าเดียวคือคอลัมน์ที่ไม่มีประโยชน์ แต่ยังพังได้ — ลบทิ้งดีกว่า
-- (ลบแล้ว restore-sql.mjs จะมองข้ามคีย์นี้ในไฟล์สำรองเก่าให้เอง)
alter table public.platform_billing_settings drop constraint if exists platform_billing_settings_payment_gateway_check;
alter table public.platform_billing_settings drop column if exists payment_gateway;

-- รายการใหม่ทุกใบเป็นของ Stripe — แถวเก่ายังคงค่าเดิมไว้เป็นประวัติ ห้ามเขียนทับ
alter table public.topups alter column gateway set default 'stripe';

-- ---- 2) ตัดร่องรอย Omise ----
drop function if exists public.store_platform_omise_key(text);
drop function if exists public.get_platform_omise_key();
alter table public.platform_billing_settings drop column if exists omise_public_key;
