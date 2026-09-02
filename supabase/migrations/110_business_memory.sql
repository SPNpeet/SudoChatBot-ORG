-- 110: Business Memory — สิ่งที่ผู้ช่วย AI "จำ" เกี่ยวกับกิจการ (เพิ่ม 31 ส.ค. 2569 ตามมอคอัพ Sudo Financial OS)
--
-- ทำไมต้องมี: ผู้ใช้บอกซ้ำทุกครั้งว่า "ร้าน A เครดิต 30 วัน" "ค่าเช่าจ่ายทุกวันที่ 1 บัญชีกสิกร"
-- ผู้ช่วยที่จำไม่ได้คือผู้ช่วยที่ต้องสอนงานใหม่ทุกเช้า — เหตุผลอันดับต้นที่คนเลิกใช้
--
-- กติกาที่ต้องคงไว้:
--  · ความจำเป็น "บริบท" ให้โมเดลอ่านเท่านั้น ไม่ใช่คำสั่งอัตโนมัติ ไม่มีผลกับตัวเลขบัญชีโดยตรง
--  · ผู้ใช้เห็นทุกรายการ ลบ/แก้/ปิดได้ทุกอัน (PDPA: ความจำมีชื่อลูกค้าได้ ต้องคุมได้)
--  · เพดานต่อกิจการบังคับในโค้ด (business-memory.ts) ไม่ใช่ที่นี่ — เปลี่ยนเพดานไม่ต้อง migrate
--  · client อ่านได้อย่างเดียวผ่าน RLS · เขียนผ่าน server action (assertMember) ด้วย service role
create table if not exists public.business_memories (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  kind         text not null default 'fact' check (kind in ('fact', 'preference', 'rule')),
  content      text not null check (char_length(content) between 1 and 300),
  source       text not null default 'user' check (source in ('user', 'ai')),
  active       boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists business_memories_shop_idx on public.business_memories (shop_id, active, updated_at desc);

alter table public.business_memories enable row level security;
drop policy if exists business_memories_select on public.business_memories;
create policy business_memories_select on public.business_memories
  for select to authenticated using (public.is_shop_member(shop_id));
-- insert/update/delete: service_role เท่านั้น (ไม่มี policy = client ทำไม่ได้)

-- rollback (ถ้าต้องถอย):
--   drop table if exists public.business_memories;
