-- 081: ผูกบัญชี LINE กับผู้ใช้ Supabase (5 ส.ค. 2569) — apply บน production แล้ว
-- LINE ไม่อยู่ในรายชื่อ provider ของ Supabase Auth — ทำ flow เองฝั่ง server
-- ตารางนี้คือแผนที่ line_user_id -> auth.users.id ใช้ผ่าน service role เท่านั้น
create table if not exists line_identities (
  line_user_id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table line_identities enable row level security;
