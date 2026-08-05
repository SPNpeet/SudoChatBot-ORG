-- 090: เขียนโครงสร้างที่ "มีบน production แต่ไม่เคยอยู่ใน repo" กลับคืน (5 ส.ค. 2569)
--
-- ⚠️ ทำไมไฟล์นี้ถึงสำคัญกว่าที่เห็น
-- baseline (000_baseline_schema.sql) เป็นสแนปช็อตวันที่ 21 ก.ค. 2569
-- ของที่เพิ่มบน production หลังจากนั้นถูก apply ผ่านหน้า SQL Editor แต่ไม่เคยเขียนกลับลง repo
-- ผลคือ clone ใหม่ + รัน migration ครบทุกไฟล์ = ได้ฐานข้อมูลที่ขาด 10 ตาราง + 11 ฟังก์ชัน
-- ซึ่งเป็น "แกนของระบบภาษี" ทั้งหมด (อัตรา VAT ตามวันที่ · ล็อกงวด · ทรัพย์สิน · ม.78/1 · โควตา AI)
--
-- ที่อันตรายกว่าคือมัน **ไม่พังดัง ๆ** — migration รันจบปกติ แล้วไปพังตอน runtime แบบเงียบ:
--   vat_rate_on ไม่มี -> rpc error -> โค้ดฝั่ง TS ตกไปใช้ 0.07 ค่าคงที่โดยไม่มี error ถึงผู้ใช้
--   = กลไก "อัตราตามวันที่ออกเอกสาร" ตายทั้งเส้นโดยไม่มีใครรู้
-- ตรงกับกติกาข้อ 5: ของที่เชื่อว่าใช้ได้แต่ไม่เคยพิสูจน์ อันตรายกว่าของที่รู้ว่าใช้ไม่ได้
--
-- ทุกคำสั่งเป็น idempotent (if not exists / or replace / do-block ดัก duplicate)
-- รันบน production ที่มีของอยู่แล้วได้โดยไม่เปลี่ยนอะไร และรันบน DB เปล่าแล้วได้ของครบ

-- ============================================================
--  ส่วนที่ 1 — ตาราง
-- ============================================================
create table if not exists public.vat_rates (
  id smallint not null,
  rate numeric not null,
  effective_from date not null,
  effective_to date,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.th_public_holidays (
  holiday_date date not null,
  name text not null,
  source_note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.rd_filing_extensions (
  id smallint not null,
  form_group text default 'wht'::text not null,
  extra_days smallint not null,
  effective_from date not null,
  effective_to date,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.vat_recognitions (
  id uuid default gen_random_uuid() not null,
  shop_id uuid not null,
  doc_id uuid not null,
  payment_id uuid,
  recognized_on date not null,
  base_amount numeric not null,
  vat_amount numeric not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.fin_period_locks (
  shop_id uuid not null,
  locked_through date not null,
  locked_by uuid,
  locked_at timestamp with time zone default now() not null,
  note text
);

create table if not exists public.fiscal_closes (
  id uuid default gen_random_uuid() not null,
  shop_id uuid not null,
  year_end date not null,
  net_profit numeric not null,
  entry_id uuid,
  closed_by uuid,
  closed_at timestamp with time zone default now() not null
);

create table if not exists public.fixed_assets (
  id uuid default gen_random_uuid() not null,
  shop_id uuid not null,
  name text not null,
  cost numeric not null,
  salvage numeric default 1 not null,
  acquired_on date not null,
  life_years numeric not null,
  disposed_on date,
  note text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  photo_path text,
  verified_on date,
  verified_by uuid,
  verified_note text
);

create table if not exists public.depreciation_runs (
  id uuid default gen_random_uuid() not null,
  shop_id uuid not null,
  asset_id uuid not null,
  period_month date not null,
  amount numeric not null,
  entry_id uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.notice_dismissals (
  shop_id uuid not null,
  user_id uuid not null,
  notice_key text not null,
  dismissed_at timestamp with time zone default now() not null
);

create table if not exists public.guest_ai_usage (
  id uuid default gen_random_uuid() not null,
  guest_id uuid not null,
  ip_hash text,
  created_at timestamp with time zone default now() not null
);

-- ============================================================
--  ส่วนที่ 2 — กุญแจ/ข้อจำกัด (ห่อ do-block เพราะ add constraint ไม่มี if not exists)
-- ============================================================
do $$
begin
  begin alter table public.vat_rates add constraint vat_rates_pkey primary key (id); exception when others then null; end;
  begin alter table public.vat_rates add constraint vat_rates_range check ((effective_to is null) or (effective_to >= effective_from)); exception when others then null; end;
  begin alter table public.vat_rates add constraint vat_rates_rate_check check ((rate >= 0) and (rate <= 1)); exception when others then null; end;

  begin alter table public.th_public_holidays add constraint th_public_holidays_pkey primary key (holiday_date); exception when others then null; end;

  begin alter table public.rd_filing_extensions add constraint rd_filing_extensions_pkey primary key (id); exception when others then null; end;
  begin alter table public.rd_filing_extensions add constraint rd_filing_extensions_extra_days_check check (extra_days >= 0); exception when others then null; end;

  begin alter table public.vat_recognitions add constraint vat_recognitions_pkey primary key (id); exception when others then null; end;
  begin alter table public.vat_recognitions add constraint vat_recognitions_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade; exception when others then null; end;
  begin alter table public.vat_recognitions add constraint vat_recognitions_doc_id_fkey foreign key (doc_id) references fin_docs(id) on delete cascade; exception when others then null; end;
  begin alter table public.vat_recognitions add constraint vat_recognitions_payment_id_fkey foreign key (payment_id) references fin_payments(id) on delete set null; exception when others then null; end;

  begin alter table public.fin_period_locks add constraint fin_period_locks_pkey primary key (shop_id); exception when others then null; end;
  begin alter table public.fin_period_locks add constraint fin_period_locks_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade; exception when others then null; end;

  begin alter table public.fiscal_closes add constraint fiscal_closes_pkey primary key (id); exception when others then null; end;
  begin alter table public.fiscal_closes add constraint fiscal_closes_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade; exception when others then null; end;
  begin alter table public.fiscal_closes add constraint fiscal_closes_entry_id_fkey foreign key (entry_id) references journal_entries(id) on delete set null; exception when others then null; end;
  begin alter table public.fiscal_closes add constraint fiscal_closes_shop_id_year_end_key unique (shop_id, year_end); exception when others then null; end;

  begin alter table public.fixed_assets add constraint fixed_assets_pkey primary key (id); exception when others then null; end;
  begin alter table public.fixed_assets add constraint fixed_assets_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade; exception when others then null; end;
  begin alter table public.fixed_assets add constraint fixed_assets_cost_check check (cost > 0); exception when others then null; end;
  begin alter table public.fixed_assets add constraint fixed_assets_life_years_check check (life_years > 0); exception when others then null; end;
  begin alter table public.fixed_assets add constraint fixed_assets_salvage_check check (salvage >= 0); exception when others then null; end;

  begin alter table public.depreciation_runs add constraint depreciation_runs_pkey primary key (id); exception when others then null; end;
  begin alter table public.depreciation_runs add constraint depreciation_runs_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade; exception when others then null; end;
  begin alter table public.depreciation_runs add constraint depreciation_runs_asset_id_fkey foreign key (asset_id) references fixed_assets(id) on delete cascade; exception when others then null; end;
  begin alter table public.depreciation_runs add constraint depreciation_runs_entry_id_fkey foreign key (entry_id) references journal_entries(id) on delete set null; exception when others then null; end;
  -- กันลงค่าเสื่อมซ้ำเดือนเดียวกันของทรัพย์สินชิ้นเดียว
  begin alter table public.depreciation_runs add constraint depreciation_runs_asset_id_period_month_key unique (asset_id, period_month); exception when others then null; end;

  begin alter table public.notice_dismissals add constraint notice_dismissals_pkey primary key (shop_id, user_id, notice_key); exception when others then null; end;
  begin alter table public.notice_dismissals add constraint notice_dismissals_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade; exception when others then null; end;
  begin alter table public.notice_dismissals add constraint notice_dismissals_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade; exception when others then null; end;
  begin alter table public.notice_dismissals add constraint notice_dismissals_notice_key_check check ((length(notice_key) >= 1) and (length(notice_key) <= 200)); exception when others then null; end;

  begin alter table public.guest_ai_usage add constraint guest_ai_usage_pkey primary key (id); exception when others then null; end;
end $$;

-- ============================================================
--  ส่วนที่ 3 — ดัชนี
-- ============================================================
create index if not exists vat_recognitions_shop_date_idx on public.vat_recognitions using btree (shop_id, recognized_on);
create index if not exists vat_recognitions_doc_idx on public.vat_recognitions using btree (doc_id);
create index if not exists vat_recognitions_payment_idx on public.vat_recognitions using btree (payment_id);
create index if not exists fiscal_closes_entry_idx on public.fiscal_closes using btree (entry_id);
create index if not exists fixed_assets_shop_idx on public.fixed_assets using btree (shop_id, acquired_on);
create index if not exists depreciation_runs_shop_idx on public.depreciation_runs using btree (shop_id, period_month);
create index if not exists depreciation_runs_entry_idx on public.depreciation_runs using btree (entry_id);
create index if not exists guest_ai_usage_guest_idx on public.guest_ai_usage using btree (guest_id, created_at desc);
create index if not exists guest_ai_usage_ip_idx on public.guest_ai_usage using btree (ip_hash, created_at desc);

-- ============================================================
--  ส่วนที่ 4 — RLS (เปิดทุกตาราง · policy ของตารางที่ผู้ใช้ต้องอ่านอยู่ในไฟล์ต้นทางเดิม)
-- ============================================================
alter table public.vat_rates enable row level security;
alter table public.th_public_holidays enable row level security;
alter table public.rd_filing_extensions enable row level security;
alter table public.vat_recognitions enable row level security;
alter table public.fin_period_locks enable row level security;
alter table public.fiscal_closes enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.depreciation_runs enable row level security;
alter table public.notice_dismissals enable row level security;
alter table public.guest_ai_usage enable row level security;

-- อัตรา VAT เป็นข้อมูลสาธารณะ (ไม่มี PII) หน้าเว็บที่ยังไม่ล็อกอินต้องอ่านได้
do $$
begin
  create policy vat_rates_read on public.vat_rates for select using (true);
exception when duplicate_object then null;
end $$;

-- ============================================================
--  ส่วนที่ 5 — ฟังก์ชัน (ทั้งหมดเป็น or replace อยู่แล้ว ปลอดภัยกับ production ที่มีของเดิม)
-- ============================================================

-- อัตรา VAT ตามวันที่ — หัวใจของ "ประกาศที่มีวันหมดอายุอยู่ในตาราง ไม่ใช่ในโค้ด"
create or replace function public.vat_rate_on(p_date date default ((now() at time zone 'Asia/Bangkok'::text))::date)
returns numeric language sql stable security definer set search_path to 'public'
as $function$
  -- 1) ช่วงที่ครอบคลุมวันที่นั้นพอดี
  -- 2) ถ้าไม่มี (เช่น เลยวันสิ้นสุดแล้วยังไม่มีใครอัปเดต) ใช้อัตราล่าสุดที่เคยมีผล
  --    ไม่กระโดดกลับ 10% เอง เพราะการเปลี่ยนอัตราเงียบ ๆ เสียหายกว่า
  select coalesce(
    (select rate from vat_rates
      where p_date >= effective_from and (effective_to is null or p_date <= effective_to)
      order by effective_from desc limit 1),
    (select rate from vat_rates
      where effective_from <= p_date
      order by effective_from desc limit 1),
    0.07
  );
$function$;

create or replace function public.valid_thai_tax_id(p_raw text)
returns boolean language plpgsql immutable set search_path to 'public', 'pg_temp'
as $function$
declare d text; s int := 0; i int;
begin
  d := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
  if length(d) <> 13 then return false; end if;
  for i in 1..12 loop
    s := s + (substr(d, i, 1))::int * (14 - i);
  end loop;
  return ((11 - (s % 11)) % 10) = (substr(d, 13, 1))::int;
end $function$;

create or replace function public.vat_rate_status()
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with today as (select (now() at time zone 'Asia/Bangkok')::date d),
  cur as (
    select r.rate, r.effective_from, r.effective_to, r.note
    from vat_rates r, today t
    where t.d >= r.effective_from and (r.effective_to is null or t.d <= r.effective_to)
    order by r.effective_from desc limit 1
  ),
  fallback as (
    select r.rate, r.effective_from, r.effective_to, r.note
    from vat_rates r, today t
    where r.effective_from <= t.d
    order by r.effective_from desc limit 1
  ),
  pick as (select * from cur union all select * from fallback limit 1)
  select jsonb_build_object(
    'rate',        p.rate,
    'percent',     round(p.rate * 100, 2),
    'valid_until', p.effective_to,
    'days_left',   case when p.effective_to is null then null
                        else (p.effective_to - (select d from today)) end,
    'status',      case
                     when p.effective_to is null then 'ok'
                     when (select d from today) > p.effective_to then 'expired'
                     when p.effective_to - (select d from today) <= 45 then 'warn'
                     else 'ok' end,
    'note',        p.note
  ) from pick p;
$function$;

-- กำหนดนำส่ง ภ.ง.ด. — เลื่อนพ้นเสาร์-อาทิตย์และวันหยุดราชการ + ส่วนขยายยื่นออนไลน์
create or replace function public.wht_due_dates(p_period text)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_paper_raw date; v_paper date; v_online_raw date; v_online date;
  v_extra smallint; v_to date; v_note text; v_has_year boolean;
begin
  if p_period !~ '^\d{4}-\d{2}$' then return null; end if;
  v_paper_raw := (p_period || '-01')::date + interval '1 month' + interval '6 days';

  select extra_days, effective_to, note into v_extra, v_to, v_note
  from rd_filing_extensions
  where form_group = 'wht'
    and effective_from <= v_paper_raw
    and (effective_to is null or effective_to >= v_paper_raw)
  order by effective_from desc limit 1;

  if v_extra is not null then v_online_raw := v_paper_raw + v_extra; end if;

  v_paper := v_paper_raw;
  while extract(isodow from v_paper) >= 6
     or exists (select 1 from th_public_holidays h where h.holiday_date = v_paper) loop
    v_paper := v_paper + 1;
  end loop;

  if v_online_raw is not null then
    v_online := v_online_raw;
    while extract(isodow from v_online) >= 6
       or exists (select 1 from th_public_holidays h where h.holiday_date = v_online) loop
      v_online := v_online + 1;
    end loop;
  end if;

  select exists (select 1 from th_public_holidays h
                 where extract(year from h.holiday_date) = extract(year from v_paper_raw))
    into v_has_year;

  return jsonb_build_object(
    'paper', v_paper, 'paper_statutory', v_paper_raw, 'shifted', v_paper <> v_paper_raw,
    'online', v_online, 'extra_days', v_extra, 'extension_until', v_to,
    'holidays_loaded', v_has_year, 'note', v_note
  );
end $function$;

-- ล็อกงวดที่ยื่นภาษีไปแล้ว — trigger นี้คือด่านสุดท้ายที่กันการแก้ย้อนหลัง
create or replace function public.assert_period_open()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_shop uuid; v_locked date; v_old jsonb; v_new jsonb;
  -- คอลัมน์ที่แก้ได้แม้ปิดงวดแล้ว เพราะไม่มีผลต่อ ภ.พ.30 / ภ.ง.ด. / งบการเงินของงวดนั้น
  -- ⚠️ เวอร์ชันแรกบล็อกทุกอย่างซึ่งทำให้เก็บเงินลูกหนี้ใบเก่าไม่ได้ = ใช้งานจริงไม่ได้
  v_allowed text[] := array[
    'paid_amount','status','notes','share_key','file_path','updated_at',
    'approval_status','approval_by','approval_at','approval_note'
  ];
begin
  v_shop := coalesce(new.shop_id, old.shop_id);
  select locked_through into v_locked from fin_period_locks where shop_id = v_shop;
  if v_locked is null then return coalesce(new, old); end if;

  if tg_table_name = 'journal_entries' then
    if least(coalesce(new.entry_date,'9999-12-31'::date),
             coalesce(old.entry_date,'9999-12-31'::date)) <= v_locked then
      raise exception 'ปิดงวดถึง % แล้ว ลงหรือแก้บัญชีย้อนเข้างวดที่ปิดไม่ได้ — ให้ลงในงวดปัจจุบันแทน หรือปลดล็อกงวดที่ ตั้งค่า › ปิดงวด ก่อน', v_locked
        using errcode = 'check_violation';
    end if;
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.issue_date <= v_locked then
      raise exception 'ปิดงวดถึง % แล้ว ออกเอกสารลงวันที่ในงวดที่ปิดไม่ได้ — ให้ลงวันที่ในงวดปัจจุบัน หรือปลดล็อกงวดที่ ตั้งค่า › ปิดงวด ก่อน', v_locked
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.issue_date <= v_locked then
      raise exception 'ปิดงวดถึง % แล้ว ลบเอกสารในงวดที่ปิดไม่ได้', v_locked
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if least(coalesce(new.issue_date,'9999-12-31'::date),
           coalesce(old.issue_date,'9999-12-31'::date)) > v_locked then
    return new;
  end if;

  v_old := to_jsonb(old) - v_allowed;
  v_new := to_jsonb(new) - v_allowed;
  if v_old is distinct from v_new then
    raise exception 'ปิดงวดถึง % แล้ว แก้ตัวเลขหรือวันที่ของเอกสารในงวดที่ปิดไม่ได้ — ถ้าต้องปรับปรุงให้ออกเอกสารใหม่ในงวดปัจจุบัน (บันทึกรับชำระยังทำได้ตามปกติ)', v_locked
      using errcode = 'check_violation';
  end if;

  if new.status = 'void' and old.status <> 'void' then
    raise exception 'ปิดงวดถึง % แล้ว ยกเลิกเอกสารที่อยู่ในงวดที่ยื่นภาษีไปแล้วไม่ได้ — กรณีคืนของหรือลดราคาต้องออกใบลดหนี้ในงวดปัจจุบัน', v_locked
      using errcode = 'check_violation';
  end if;

  return new;
end $function$;

do $$
begin
  create trigger fin_docs_period_lock before insert or update or delete on public.fin_docs
    for each row execute function public.assert_period_open();
exception when duplicate_object then null;
end $$;
do $$
begin
  create trigger journal_entries_period_lock before insert or update or delete on public.journal_entries
    for each row execute function public.assert_period_open();
exception when duplicate_object then null;
end $$;

create or replace function public.shop_data_health(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_shop record; v_bad_ptr int; v_names text; v_odd int; v_odd_list text;
begin
  -- เห็นเฉพาะกิจการที่ตัวเองเป็นสมาชิก — กันดูข้อมูลข้ามกิจการ
  if not exists (select 1 from shop_members m where m.shop_id = p_shop_id and m.user_id = auth.uid()) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select tax_id, billing_address into v_shop from shops where id = p_shop_id;

  select count(distinct contact_name), string_agg(distinct contact_name, ' · ' order by contact_name)
    into v_bad_ptr, v_names
  from fin_docs
  where shop_id = p_shop_id and doc_type = 'expense' and wht_amount > 0
    and status not in ('draft', 'void') and not valid_thai_tax_id(contact_tax_id);

  select count(*), string_agg(doc_number || ' = ' || issue_date, ' · ') into v_odd, v_odd_list
  from (select doc_number, issue_date from fin_docs
        where shop_id = p_shop_id and status not in ('draft', 'void')
          and issue_date > (now() at time zone 'Asia/Bangkok')::date + 90
        order by issue_date desc limit 3) x;

  return jsonb_build_object(
    'tax_id_ok', valid_thai_tax_id(v_shop.tax_id),
    'address_ok', coalesce(btrim(v_shop.billing_address), '') <> '',
    'bad_partners', coalesce(v_bad_ptr, 0), 'partner_names', left(coalesce(v_names, ''), 120),
    'odd_dates', coalesce(v_odd, 0), 'odd_list', left(coalesce(v_odd_list, ''), 120)
  );
end $function$;

create or replace function public.can_create_company(p_owner uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_cap int; v_count int; v_plan text;
begin
  if (select auth.uid()) is not null and p_owner <> (select auth.uid())
     and not public.is_platform_admin() then
    raise exception 'forbidden: ดูโควตาของบัญชีอื่นไม่ได้' using errcode = '42501';
  end if;

  select count(*) into v_count from shops where owner_id = p_owner and status <> 'closed';
  if v_count = 0 then return jsonb_build_object('allowed', true); end if;

  select p.max_companies, p.name into v_cap, v_plan
  from shops s join plans p on p.code = s.plan
  where s.owner_id = p_owner and s.status = 'active'
  order by p.price_monthly desc, p.included_replies desc limit 1;

  if v_cap is null then return jsonb_build_object('allowed', true); end if;
  return jsonb_build_object('allowed', v_count < v_cap, 'used', v_count, 'cap', v_cap, 'plan', v_plan);
end $function$;

create or replace function public.check_slip_quota(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_owner uuid;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  v_cap int; v_used int;
begin
  perform public.assert_shop_access(p_shop_id);
  select owner_id into v_owner from shops where id = p_shop_id;
  if v_owner is null then return jsonb_build_object('allowed', false); end if;

  select p.slip_quota into v_cap
  from shops s join plans p on p.code = s.plan
  where s.owner_id = v_owner and s.status = 'active'
  order by p.price_monthly desc, p.included_replies desc limit 1;

  if v_cap is null then return jsonb_build_object('allowed', true, 'used', null, 'cap', null); end if;

  select count(*) into v_used from fin_payments fp join shops s on s.id = fp.shop_id
  where s.owner_id = v_owner and fp.slip_trans_ref is not null and fp.created_at >= v_month_start;

  return jsonb_build_object('allowed', v_used < v_cap, 'used', v_used, 'cap', v_cap);
end $function$;

create or replace function public.get_ai_quota_status(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_owner uuid;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  v_daily_cap int; v_monthly_cap int; v_override int;
  v_used_today int; v_used_month int;
  v_pct numeric := 0; v_allowed boolean := true; v_reason text := null;
begin
  if auth.uid() is not null and not public.is_shop_member(p_shop_id) then return null; end if;

  select owner_id into v_owner from shops where id = p_shop_id;
  if v_owner is null then return null; end if;

  select p.daily_reply_cap, nullif(p.included_replies, 0) into v_daily_cap, v_monthly_cap
  from shops s join plans p on p.code = s.plan
  where s.owner_id = v_owner and s.status = 'active'
  order by p.price_monthly desc, p.included_replies desc limit 1;

  select max(ai_quota_override) into v_override from shops where owner_id = v_owner;
  if v_override is not null then v_daily_cap := v_override; end if;

  select count(*) into v_used_today from ai_usage_logs l join shops s on s.id = l.shop_id
  where s.owner_id = v_owner and l.purpose in ('assistant', 'ocr') and l.created_at >= v_day_start;

  select count(*) into v_used_month from ai_usage_logs l join shops s on s.id = l.shop_id
  where s.owner_id = v_owner and l.purpose in ('assistant', 'ocr') and l.created_at >= v_month_start;

  if v_daily_cap is not null and v_daily_cap > 0 then
    v_pct := greatest(v_pct, v_used_today::numeric / v_daily_cap);
    if v_used_today >= v_daily_cap then v_allowed := false; v_reason := 'daily'; end if;
  end if;
  if v_monthly_cap is not null and v_monthly_cap > 0 then
    v_pct := greatest(v_pct, v_used_month::numeric / v_monthly_cap);
    if v_used_month >= v_monthly_cap then v_allowed := false; v_reason := 'monthly'; end if;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed, 'reason', v_reason,
    'used_today', v_used_today, 'cap_today', v_daily_cap,
    'used_month', v_used_month, 'cap_month', v_monthly_cap,
    'pct', least(1, round(v_pct, 4))
  );
end $function$;

create or replace function public.consume_ai_quota(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_owner uuid; v_status jsonb; v_pct numeric;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  v_title text;
begin
  perform public.assert_shop_access(p_shop_id);
  select owner_id into v_owner from shops where id = p_shop_id;
  if v_owner is null then return jsonb_build_object('allowed', false, 'reason', 'no_shop'); end if;
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || v_owner::text));

  v_status := public.get_ai_quota_status(p_shop_id);
  v_pct := coalesce((v_status->>'pct')::numeric, 0);

  if (v_status->>'allowed')::boolean and v_pct >= 0.8 then
    v_title := case when v_pct >= 0.95 then 'โควตา AI ใกล้หมด (เกิน 95%)' else 'โควตา AI ใช้ไปเกิน 80% แล้ว' end;
    if not exists (select 1 from notifications
      where shop_id = p_shop_id and type = 'low_credit' and title = v_title and created_at >= v_day_start) then
      insert into notifications (shop_id, type, title, body)
      values (p_shop_id, 'low_credit', v_title,
        'ใช้งาน AI ไป ' || round(v_pct * 100) || '% ของแพ็กเกจแล้ว (นับรวมทุกกิจการของบัญชีคุณ) — เติมเครดิตหรืออัปเกรดล่วงหน้าเพื่อให้งานไม่สะดุด');
    end if;
  end if;

  return v_status;
end $function$;

create or replace function public.consume_guest_ai_quota(
  p_guest uuid, p_ip_hash text,
  p_guest_limit integer default 3, p_ip_daily integer default 15, p_platform_daily integer default 300)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_day_ago timestamptz := now() - interval '24 hours';
  v_guest_used int; v_ip_used int; v_platform_used int;
begin
  perform pg_advisory_xact_lock(hashtext('guest_ai:' || p_guest::text));

  select count(*) into v_guest_used from guest_ai_usage where guest_id = p_guest;
  if v_guest_used >= p_guest_limit then
    return jsonb_build_object('allowed', false, 'reason', 'guest', 'tries_left', 0);
  end if;

  select count(*) into v_ip_used from guest_ai_usage where ip_hash = p_ip_hash and created_at >= v_day_ago;
  if v_ip_used >= p_ip_daily then
    return jsonb_build_object('allowed', false, 'reason', 'ip', 'tries_left', greatest(0, p_guest_limit - v_guest_used));
  end if;

  select count(*) into v_platform_used from guest_ai_usage where created_at >= v_day_ago;
  if v_platform_used >= p_platform_daily then
    return jsonb_build_object('allowed', false, 'reason', 'platform', 'tries_left', greatest(0, p_guest_limit - v_guest_used));
  end if;

  insert into guest_ai_usage (guest_id, ip_hash) values (p_guest, p_ip_hash);
  return jsonb_build_object('allowed', true, 'tries_left', greatest(0, p_guest_limit - v_guest_used - 1));
end $function$;

-- สิทธิ์: ฟังก์ชันที่ฝั่งเซิร์ฟเวอร์เราเรียกเท่านั้น ห้าม anon ยิงตรง (บทเรียนจาก 082/083)
revoke execute on function public.consume_guest_ai_quota(uuid, text, integer, integer, integer) from public, anon;

-- ============================================================
--  ส่วนที่ 6 — ข้อมูลตั้งต้นขั้นต่ำ (อัตรา VAT ต้องมีอย่างน้อย 1 แถว ไม่งั้นทั้งระบบคิดภาษีไม่ได้)
-- ============================================================
insert into public.vat_rates (id, rate, effective_from, effective_to, note)
values (1, 0.07, '2000-01-01', null, 'อัตราตั้งต้น — ตรวจประกาศ พ.ร.ฎ. ลดอัตราแล้วอัปเดตช่วงวันที่ให้ตรงจริง')
on conflict (id) do nothing;
