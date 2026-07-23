-- ============================================================
--  051: แกนกลางบัญชี — ผังบัญชี + สมุดรายวัน (GL)
--  ทุกธุรกรรม (ขาย/รับเงิน/ค่าใช้จ่าย/จ่ายเงิน) ลงเดบิต/เครดิตอัตโนมัติจากแอป
--  + เชื่อมสต๊อก: fin_doc_items.product_id · products.cost (ต้นทุนขาย)
-- ============================================================

-- ---------- ผังบัญชี ----------
create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text not null,                -- 1010, 4010, 5110 ...
  name text not null,
  type text not null check (type in ('asset','liability','equity','income','expense')),
  is_system boolean not null default false,  -- บัญชีที่ระบบใช้ลงอัตโนมัติ ห้ามลบ
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (shop_id, code)
);
create index if not exists coa_shop_idx on public.chart_of_accounts (shop_id, type, code);

create or replace function public.seed_chart_of_accounts(p_shop_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.chart_of_accounts (shop_id, code, name, type, is_system)
  values
    (p_shop_id, '1010', 'เงินสด', 'asset', true),
    (p_shop_id, '1020', 'เงินฝากธนาคาร', 'asset', true),
    (p_shop_id, '1130', 'ลูกหนี้การค้า', 'asset', true),
    (p_shop_id, '1154', 'ภาษีซื้อ', 'asset', true),
    (p_shop_id, '1155', 'ภาษีถูกหัก ณ ที่จ่าย', 'asset', true),
    (p_shop_id, '1160', 'สินค้าคงเหลือ', 'asset', true),
    (p_shop_id, '2010', 'เจ้าหนี้การค้า', 'liability', true),
    (p_shop_id, '2030', 'ภาษีขาย', 'liability', true),
    (p_shop_id, '2045', 'ภาษีหัก ณ ที่จ่ายค้างนำส่ง', 'liability', true),
    (p_shop_id, '3010', 'ส่วนของเจ้าของ', 'equity', true),
    (p_shop_id, '3020', 'กำไรสะสม', 'equity', true),
    (p_shop_id, '4010', 'รายได้จากการขาย/บริการ', 'income', true),
    (p_shop_id, '4090', 'รายได้อื่น', 'income', true),
    (p_shop_id, '5010', 'ต้นทุนขาย/ซื้อสินค้า', 'expense', true),
    (p_shop_id, '5110', 'เงินเดือน/ค่าจ้าง', 'expense', true),
    (p_shop_id, '5120', 'ค่าเช่า', 'expense', true),
    (p_shop_id, '5130', 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต', 'expense', true),
    (p_shop_id, '5140', 'ค่าขนส่ง/เดินทาง', 'expense', true),
    (p_shop_id, '5150', 'การตลาด/โฆษณา', 'expense', true),
    (p_shop_id, '5160', 'ค่าธรรมเนียม/บริการ', 'expense', true),
    (p_shop_id, '5170', 'วัสดุ/อุปกรณ์สำนักงาน', 'expense', true),
    (p_shop_id, '5180', 'ภาษี/ประกันสังคม', 'expense', true),
    (p_shop_id, '5990', 'ค่าใช้จ่ายอื่น', 'expense', true)
  on conflict (shop_id, code) do nothing;
$$;

create or replace function public.tg_seed_chart_of_accounts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_chart_of_accounts(new.id);
  return new;
end $$;

drop trigger if exists seed_coa_on_shop on public.shops;
create trigger seed_coa_on_shop
  after insert on public.shops
  for each row execute function public.tg_seed_chart_of_accounts();

select public.seed_chart_of_accounts(id) from public.shops;

-- หมวดค่าใช้จ่าย -> รหัสบัญชีที่ลงอัตโนมัติ
alter table public.expense_categories add column if not exists account_code text;
update public.expense_categories set account_code = case name
  when 'ซื้อสินค้า/วัตถุดิบ' then '5010'
  when 'เงินเดือน/ค่าจ้าง' then '5110'
  when 'ค่าเช่า' then '5120'
  when 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต' then '5130'
  when 'ค่าขนส่ง/เดินทาง' then '5140'
  when 'การตลาด/โฆษณา' then '5150'
  when 'ค่าธรรมเนียม/บริการ' then '5160'
  when 'วัสดุ/อุปกรณ์สำนักงาน' then '5170'
  when 'ภาษี/ประกันสังคม' then '5180'
  else '5990' end
where account_code is null;

-- seed หมวดในอนาคตให้มี account_code ด้วย
create or replace function public.seed_expense_categories(p_shop_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.expense_categories (shop_id, name, sort, account_code)
  values
    (p_shop_id, 'ซื้อสินค้า/วัตถุดิบ', 1, '5010'),
    (p_shop_id, 'เงินเดือน/ค่าจ้าง', 2, '5110'),
    (p_shop_id, 'ค่าเช่า', 3, '5120'),
    (p_shop_id, 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต', 4, '5130'),
    (p_shop_id, 'ค่าขนส่ง/เดินทาง', 5, '5140'),
    (p_shop_id, 'การตลาด/โฆษณา', 6, '5150'),
    (p_shop_id, 'ค่าธรรมเนียม/บริการ', 7, '5160'),
    (p_shop_id, 'วัสดุ/อุปกรณ์สำนักงาน', 8, '5170'),
    (p_shop_id, 'ภาษี/ประกันสังคม', 9, '5180'),
    (p_shop_id, 'อื่น ๆ', 99, '5990')
  on conflict (shop_id, name) do nothing;
$$;

-- ---------- สมุดรายวัน ----------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  entry_number text not null,
  entry_date date not null default ((now() at time zone 'Asia/Bangkok'))::date,
  memo text,
  source_type text not null default 'manual'
    check (source_type in ('sale','receipt','expense','payment','stock','manual','reversal')),
  source_id uuid,                    -- fin_docs.id / fin_payments.id ที่เป็นต้นทาง
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (shop_id, entry_number)
);
create index if not exists journal_entries_shop_idx on public.journal_entries (shop_id, entry_date desc);
create index if not exists journal_entries_source_idx on public.journal_entries (source_type, source_id);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id),
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  memo text,
  sort int not null default 0
);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (shop_id, account_id);

-- ---------- เชื่อมสต๊อก/ต้นทุน ----------
alter table public.products add column if not exists cost numeric(14,2);
alter table public.fin_doc_items add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists fin_doc_items_product_idx on public.fin_doc_items (product_id);

-- ---------- RLS ----------
alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy coa_member_select on public.chart_of_accounts for select to authenticated using (is_shop_member(shop_id));
create policy coa_admin_ins on public.chart_of_accounts for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin']));
create policy coa_admin_upd on public.chart_of_accounts for update to authenticated using (has_shop_role(shop_id, array['owner','admin'])) with check (has_shop_role(shop_id, array['owner','admin']));
create policy coa_admin_del on public.chart_of_accounts for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']) and not is_system);

create policy journal_entries_member_select on public.journal_entries for select to authenticated using (is_shop_member(shop_id));
create policy journal_entries_agent_ins on public.journal_entries for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy journal_entries_admin_del on public.journal_entries for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']));

create policy journal_lines_member_select on public.journal_lines for select to authenticated using (is_shop_member(shop_id));
create policy journal_lines_agent_ins on public.journal_lines for insert to authenticated with check (has_shop_role(shop_id, array['owner','admin','agent']));
create policy journal_lines_admin_del on public.journal_lines for delete to authenticated using (has_shop_role(shop_id, array['owner','admin']));
