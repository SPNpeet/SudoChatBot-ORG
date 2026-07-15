-- ============================================================
--  023 — ย้าย extension pg_net ออกจาก public schema (แก้ advisor WARN: extension_in_public)
--  หมายเหตุ: ฟังก์ชันของ pg_net (http_post/http_get) อยู่ใน schema "net" เสมอ
--  การย้ายนี้ย้ายตัว extension object — โค้ดที่เรียก net.http_post ไม่ต้องแก้
--  ส่วน send_platform_email (021) ตั้ง search_path ครอบคลุม net + extensions ไว้แล้ว
-- ============================================================

create schema if not exists extensions;

do $$
begin
  -- pg_net รองรับ ALTER EXTENSION SET SCHEMA ตั้งแต่ v0.10
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      alter extension pg_net set schema extensions;
    exception when others then
      -- เวอร์ชันเก่าที่ relocate ไม่ได้: drop แล้ว create ใหม่ใน schema extensions
      -- (ปลอดภัย: pg_net ไม่เก็บ state ถาวรนอกคิว request ชั่วคราว)
      drop extension pg_net;
      create extension pg_net with schema extensions;
    end;
  end if;
end $$;
