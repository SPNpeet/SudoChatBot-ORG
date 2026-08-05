-- 063: แนบไฟล์ได้หลายใบต่อเอกสาร (เดิม fin_docs.file_path เก็บได้ใบเดียว — ผู้ใช้แจ้งว่าไม่พอ
-- เพราะบิลจริงมีหลายหน้า/มีทั้งบิลและสลิป) · คงคอลัมน์เดิมไว้เป็นไฟล์หลัก ไม่พังของเก่า
create table if not exists fin_doc_files (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references fin_docs(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  path text not null,
  name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_fin_doc_files_doc on fin_doc_files (doc_id);
alter table fin_doc_files enable row level security;

drop policy if exists fin_doc_files_read on fin_doc_files;
create policy fin_doc_files_read on fin_doc_files
  for select to authenticated using (public.is_shop_member(shop_id));

insert into fin_doc_files (doc_id, shop_id, path, name)
select d.id, d.shop_id, d.file_path, null
from fin_docs d
where d.file_path is not null
  and not exists (select 1 from fin_doc_files f where f.doc_id = d.id and f.path = d.file_path);

-- ⚠️ เพิ่ม 5 ส.ค. 2569 — index นี้มีบน production แต่ไม่เคยอยู่ในไฟล์ไหน
-- (พบจากการเทียบ schema ที่สร้างจาก repo กับ production ทีละ index หลังรันจริงบน DB เปล่า)
-- ถ้าไม่มี: การอ่านไฟล์แนบทั้งกิจการจะ scan ทั้งตาราง ช้าขึ้นเรื่อย ๆ ตามจำนวนเอกสาร
create index if not exists fin_doc_files_shop_idx on public.fin_doc_files using btree (shop_id);
