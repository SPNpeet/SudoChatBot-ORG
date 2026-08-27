-- บันทึกการยินยอม (PDPA) — คนตรวจภายนอก 28 ส.ค. 2569 ชี้ว่าระบบที่ให้ติ๊กยอมรับ
-- แต่ไม่เก็บหลักฐานว่าใครยอมรับอะไรเมื่อไร เท่ากับพิสูจน์การยินยอมไม่ได้เลย
create table if not exists consent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  shop_id uuid references shops(id) on delete set null,
  kind text not null,           -- signup_terms · upload_rights · accountant_export
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table consent_logs is 'หลักฐานการยินยอม/ยืนยันสิทธิ์ของผู้ใช้ — เขียนโดย service role เท่านั้น';
create index if not exists consent_logs_user_idx on consent_logs (user_id, created_at desc);
-- RLS เปิดไว้โดยไม่มี policy = อ่าน/เขียนได้เฉพาะ service role (แบบเดียวกับตารางระบบอื่น)
alter table consent_logs enable row level security;
