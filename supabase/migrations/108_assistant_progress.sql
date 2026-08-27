-- 108: ป้ายบอกขั้นตอนที่ผู้ช่วย AI กำลังทำ (เพิ่ม 28 ส.ค. 2569 ตามผลตรวจภายนอก)
-- ฝั่งแชท poll อ่านระหว่างรอคำตอบ — เป็นส่วนเสริมล้วน ๆ เขียนไม่สำเร็จห้ามทำให้งานหลักพัง
-- อ่าน/เขียนผ่าน service role เท่านั้น (RLS เปิดไว้โดยไม่มี policy = ปิดตายฝั่ง client)
create table if not exists public.assistant_progress (
  rid        uuid primary key,
  shop_id    uuid not null references public.shops(id) on delete cascade,
  label      text,
  updated_at timestamptz not null default now()
);
alter table public.assistant_progress enable row level security;
