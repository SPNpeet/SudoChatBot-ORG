-- ============================================================
--  050: โครงบัญชีหลังบ้าน AP/AR (pivot จากแชทบอทขายของ)
--  additive เท่านั้น — ไม่แตะ/ไม่ลบตารางเดิม ข้อมูลเก่าอยู่ครบ
--  ผู้ติดต่อ · เอกสารขาย-ซื้อ · รายการรับ-จ่าย · หมวดค่าใช้จ่าย · เลขรันเอกสาร
-- ============================================================

-- ---------- ผู้ติดต่อ (ลูกค้า/ผู้ขาย) ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  kind text not null default 'customer' check (kind in ('customer','vendor','both')),
  name text not null,
  tax_id text,
  branch text,                       -- สำนักงานใหญ่ / สาขาที่ 00001
  address text,
  email text,
  phone text,
  notes text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_shop_idx on public.contacts (shop_id, kind, status);

-- ---------- หมวดค่าใช้จ่าย ----------
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  unique (shop_id, name)
);
create index if not exists expense_categories_shop_idx on public.expense_categories (shop_id, sort);

-- seed หมวดมาตรฐานไทยให้ทุกร้าน (เดิม + ร้านใหม่ผ่าน trigger)
create or replace function public.seed_expense_categories(p_shop_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.expense_categories (shop_id, name, sort)
  values
    (p_shop_id, 'ซื้อสินค้า/วัตถุดิบ', 1),
    (p_shop_id, 'เงินเดือน/ค่าจ้าง', 2),
    (p_shop_id, 'ค่าเช่า', 3),
    (p_shop_id, 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต', 4),
    (p_shop_id, 'ค่าขนส่ง/เดินทาง', 5),
    (p_shop_id, 'การตลาด/โฆษณา', 6),
    (p_shop_id, 'ค่าธรรมเนียม/บริการ', 7),
    (p_shop_id, 'วัสดุ/อุปกรณ์สำนักงาน', 8),
    (p_shop_id, 'ภาษี/ประกันสังคม', 9),
    (p_shop_id, 'อื่น ๆ', 99)
  on conflict (shop_id, name) do nothing;
$$;

create or replace function public.tg_seed_expense_categories()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_expense_categories(new.id);
  return new;
end $$;

drop trigger if exists seed_expense_categories_on_shop on public.shops;
create trigger seed_expense_categories_on_shop
  after insert on public.shops
  for each row execute function public.tg_seed_expense_categories();

select public.seed_expense_categories(id) from public.shops;

-- ---------- เอกสารการเงิน (ขาย: quotation/invoice/receipt · ซื้อ: expense) ----------
create table if not exists public.fin_docs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  doc_type text not null check (doc_type in ('quotation','invoice','receipt','expense')),
  doc_number text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text,                 -- snapshot ตอนออกเอกสาร (แก้ผู้ติดต่อทีหลังเอกสารเดิมไม่เพี้ยน)
  contact_tax_id text,
  contact_address text,
  issue_date date not null default ((now() at time zone 'Asia/Bangkok'))::date,
  due_date date,
  category_id uuid references public.expense_categories(id) on delete set null,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  vat_mode text not null default 'none' check (vat_mode in ('none','exclusive','inclusive')),
  vat_amount numeric(14,2) not null default 0,
  wht_rate numeric(5,2) not null default 0,   -- หัก ณ ที่จ่าย %
  wht_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,     -- ยอดสุทธิที่ต้องรับ/จ่ายจริง
  paid_amount numeric(14,2) not null default 0,
  status text not null default 'awaiting' check (status in ('draft','awaiting','partial','paid','void')),
  source text not null default 'manual' check (source in ('manual','ai','import','recurring')),
  file_path text,                    -- ไฟล์ต้นทาง (บิล/ใบเสร็จที่ถ่ายรูป) ใน bucket slips
  ref_doc_id uuid references public.fin_docs(id) on delete set null, -- เช่น ใบเสร็จอ้างใบแจ้งหนี้
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, doc_type, doc_number)
);
create index if not exists fin_docs_list_idx on public.fin_docs (shop_id, doc_type, status, issue_date desc);
create index if not exists fin_docs_due_idx on public.fin_docs (shop_id, due_date);
create index if not exists fin_docs_contact_idx on public.fin_docs (contact_id);
create index if not exists fin_docs_category_idx on public.fin_docs (category_id);
create index if not exists fin_docs_ref_idx on public.fin_docs (ref_doc_id);

create table if not exists public.fin_doc_items (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.fin_docs(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  qty numeric(12,2) not null default 1,
  unit text,
  unit_price numeric(14,2) not null default 0,
  amount numeric(14,2) not null default 0,
  sort int not null default 0
);
create index if not exists fin_doc_items_doc_idx on public.fin_doc_items (doc_id);
create index if not exists fin_doc_items_shop_idx on public.fin_doc_items (shop_id);

-- ---------- รายการรับ/จ่ายเงิน (ผูกเอกสารได้ · แนบสลิป · ตรวจ EasySlip) ----------
create table if not exists public.fin_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  doc_id uuid references public.fin_docs(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  method text not null default 'transfer' check (method in ('transfer','promptpay','cash','card','other')),
  amount numeric(14,2) not null,
  paid_at timestamptz not null default now(),
  slip_storage_path text,
  slip_trans_ref text,
  slip_data jsonb,                   -- payload จาก EasySlip/SlipOK ไว้ตรวจย้อนหลัง
  verify_status text not null default 'unverified' check (verify_status in ('unverified','verified','failed','manual')),
  verify_note text,
  matched_by text check (matched_by in ('manual','auto','ai')),
  statement_ref text,                -- อ้างอิงแถว statement ตอนนำเข้าไฟล์ธนาคาร
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists fin_payments_list_idx on public.fin_payments (shop_id, direction, paid_at desc);
create index if not exists fin_payments_doc_idx on public.fin_payments (doc_id);
-- กันสลิปซ้ำ: trans_ref เดียวกันในร้านเดียวกันบันทึกได้ครั้งเดียว
create unique index if not exists fin_payments_transref_uniq
  on public.fin_payments (shop_id, slip_trans_ref) where slip_trans_ref is not null;

-- ---------- เลขรันเอกสารต่อร้าน/ประเภท/ปี ----------
create table if not exists public.fin_doc_counters (
  shop_id uuid not null references public.shops(id) on delete cascade,
  doc_type text not null,
  year int not null,
  counter int not null default 0,
  primary key (shop_id, doc_type, year)
);

create or replace function public.next_fin_doc_number(p_shop_id uuid, p_doc_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  v_counter int;
  v_prefix text := case p_doc_type
    when 'quotation' then 'QT'
    when 'invoice' then 'INV'
    when 'receipt' then 'RC'
    when 'expense' then 'EXP'
    else 'DOC' end;
begin
  insert into public.fin_doc_counters (shop_id, doc_type, year, counter)
  values (p_shop_id, p_doc_type, v_year, 1)
  on conflict (shop_id, doc_type, year)
  do update set counter = public.fin_doc_counters.counter + 1
  returning counter into v_counter;
  return v_prefix || '-' || v_year || '-' || lpad(v_counter::text, 4, '0');
end $$;

revoke all on function public.next_fin_doc_number(uuid, text) from public, anon;
grant execute on function public.next_fin_doc_number(uuid, text) to service_role;

-- ---------- RLS (pattern เดียวกับตารางเดิม: member อ่าน · owner/admin/agent เขียน) ----------
alter table public.contacts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.fin_docs enable row level security;
alter table public.fin_doc_items enable row level security;
alter table public.fin_payments enable row level security;
alter table public.fin_doc_counters enable row level security;

create policy contacts_member_select on public.contacts for select to authenticated using (is_shop_member(shop_id));
create policy contacts_agent_ins on public.contacts for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy contacts_agent_upd on public.contacts for update to authenticated using (has_shop_role(shop_id, array['owner','admin','agent'])) with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy contacts_admin_del on public.contacts for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']));

create policy expense_categories_member_select on public.expense_categories for select to authenticated using (is_shop_member(shop_id));
create policy expense_categories_admin_ins on public.expense_categories for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin']));
create policy expense_categories_admin_upd on public.expense_categories for update to authenticated using (has_shop_role(shop_id, array['owner','admin'])) with check (has_shop_role(shop_id, array['owner','admin']));
create policy expense_categories_admin_del on public.expense_categories for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']));

create policy fin_docs_member_select on public.fin_docs for select to authenticated using (is_shop_member(shop_id));
create policy fin_docs_agent_ins on public.fin_docs for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy fin_docs_agent_upd on public.fin_docs for update to authenticated using (has_shop_role(shop_id, array['owner','admin','agent'])) with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy fin_docs_admin_del on public.fin_docs for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']));

create policy fin_doc_items_member_select on public.fin_doc_items for select to authenticated using (is_shop_member(shop_id));
create policy fin_doc_items_agent_ins on public.fin_doc_items for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy fin_doc_items_agent_upd on public.fin_doc_items for update to authenticated using (has_shop_role(shop_id, array['owner','admin','agent'])) with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy fin_doc_items_admin_del on public.fin_doc_items for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']));

create policy fin_payments_member_select on public.fin_payments for select to authenticated using (is_shop_member(shop_id));
create policy fin_payments_agent_ins on public.fin_payments for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy fin_payments_agent_upd on public.fin_payments for update to authenticated using (has_shop_role(shop_id, array['owner','admin','agent'])) with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy fin_payments_admin_del on public.fin_payments for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']));

-- counters: อ่านได้เฉพาะสมาชิก เขียนผ่าน RPC (service) เท่านั้น
create policy fin_doc_counters_member_select on public.fin_doc_counters for select to authenticated using (is_shop_member(shop_id));
