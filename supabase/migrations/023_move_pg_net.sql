-- ============================================================
--  023 — ย้าย extension pg_net ออกจาก public schema (แก้ advisor WARN: extension_in_public)
--  pg_net ไม่รองรับ ALTER EXTENSION SET SCHEMA → ใช้ drop + create ใน schema extensions
--  ฟังก์ชัน API (net.http_post/http_get) อยู่ schema "net" เสมอ — cron เดิมไม่ต้องแก้
-- ============================================================
create schema if not exists extensions;

do $$
begin
  if exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_net' and n.nspname = 'public'
  ) then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end $$;
