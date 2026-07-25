-- 069: ธงข้อมูลตัวอย่าง — ผู้ใช้ใหม่กดปุ่มเดียวเห็นระบบทำงานเต็มรูป แล้วล้างทิ้งได้สะอาด
-- แก้ "กำแพงศูนย์": เปิดแดชบอร์ดครั้งแรกเจอเลข 0 ทุกช่อง ไม่รู้ว่าระบบดียังไง
alter table fin_docs   add column if not exists is_sample boolean not null default false;
alter table contacts   add column if not exists is_sample boolean not null default false;
alter table products   add column if not exists is_sample boolean not null default false;
create index if not exists idx_fin_docs_sample on fin_docs (shop_id) where is_sample;
