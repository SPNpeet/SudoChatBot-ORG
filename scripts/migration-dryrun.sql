-- ============================================================
--  โครงจำลอง Supabase สำหรับทดสอบ migration บน Postgres เปล่า
--
--  ทำไมต้องมี: migration ของเราอ้างถึงของที่ Supabase เตรียมให้เสมอ
--  (auth.users · auth.uid() · storage.buckets · cron.schedule · extension)
--  Postgres เปล่าไม่มีสิ่งเหล่านี้ ถ้าไม่จำลองก่อน จะพังตั้งแต่ไฟล์แรก
--  โดยไม่ได้บอกอะไรเราเลยเกี่ยวกับ migration ของเราเอง
--
--  ไฟล์นี้ "ไม่ได้ถูกรันบน production" — ใช้เฉพาะกับคอนเทนเนอร์ทดสอบที่ลบทิ้งทุกครั้ง
-- ============================================================

-- ---- auth (Supabase Auth) ----
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;

-- ---- storage ----
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid, created_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

-- ---- cron / net ----
-- ไม่ต้องจำลอง: image supabase/postgres มี extension pg_cron และ pg_net อยู่แล้ว
-- และ baseline จะ create extension เองที่บรรทัดแรก ๆ
-- (ถ้าเราสร้าง schema cron ไว้ก่อน extension จะชนกันทันที — เคยพลาดมาแล้วตอนทดสอบ)

-- ---- role ที่ Supabase มีให้เสมอ (migration มี grant/revoke ถึง) ----
do $$
begin
  begin create role anon nologin; exception when duplicate_object then null; end;
  begin create role authenticated nologin; exception when duplicate_object then null; end;
  begin create role service_role nologin; exception when duplicate_object then null; end;
  begin create role supabase_auth_admin nologin; exception when duplicate_object then null; end;
end $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth, storage, cron to anon, authenticated, service_role;
grant all on all tables in schema storage to service_role;
grant all on all tables in schema cron to service_role;
