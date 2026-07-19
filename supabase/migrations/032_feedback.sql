-- 032: ความเห็น/ปัญหาจากผู้ใช้ในแอป — เจ้าของแพลตฟอร์มอ่านจากแดชบอร์ดแอดมิน
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete set null,
  user_id uuid not null,
  message text not null check (char_length(message) between 3 and 2000),
  page text,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;

-- สมาชิกร้านส่งความเห็นของตัวเองได้
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_shop_member(shop_id));

-- อ่านได้เฉพาะแอดมินแพลตฟอร์ม
drop policy if exists feedback_admin_read on feedback;
create policy feedback_admin_read on feedback for select to authenticated
  using (public.is_platform_admin());

create index if not exists feedback_created_at_idx on feedback (created_at desc);
create index if not exists feedback_shop_id_idx on feedback (shop_id);
