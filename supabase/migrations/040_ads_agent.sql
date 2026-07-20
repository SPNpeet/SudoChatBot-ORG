-- 040: AI Ads Agent — ร้านต่อ ad account Meta ของตัวเอง (จ่ายค่าแอดตรงกับ Meta ไม่ผ่านแพลตฟอร์ม)
-- หลักรัดกุม: AI เสนอได้อย่างเดียว (ad_proposals) ร้านกดยืนยันเอง + เพดานงบ 2 ชั้นบังคับฝั่ง server

create table if not exists ad_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  platform text not null default 'meta' check (platform in ('meta')),
  ad_account_id text not null,          -- act_xxxx
  account_name text,
  currency text,
  page_id text,                          -- เพจที่ใช้เป็น identity ของแอด (CTM)
  status text not null default 'active' check (status in ('active','disconnected','token_expired')),
  daily_cap_per_campaign numeric not null default 300,   -- บาท/วัน/แคมเปญ สูงสุดที่ agent เสนอได้
  daily_cap_total numeric not null default 1000,         -- บาท/วัน รวมทุกแคมเปญ (watchdog auto-pause)
  connected_by uuid,
  connected_at timestamptz not null default now(),
  token_expires_at timestamptz,
  unique (shop_id, platform, ad_account_id)
);
alter table ad_accounts enable row level security;
drop policy if exists ad_accounts_member_read on ad_accounts;
create policy ad_accounts_member_read on ad_accounts for select to authenticated
  using (public.is_shop_member(shop_id));
drop policy if exists ad_accounts_admin_write on ad_accounts;
create policy ad_accounts_admin_write on ad_accounts for all to authenticated
  using (public.has_shop_role(shop_id, array['owner','admin']))
  with check (public.has_shop_role(shop_id, array['owner','admin']));

-- cache แคมเปญ (sync จาก Meta ตอนเปิดหน้า/agent เรียก/watchdog)
create table if not exists ad_campaigns (
  campaign_id text primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  ad_account_id text not null,
  name text not null,
  objective text,
  status text,                           -- ACTIVE / PAUSED / ...
  daily_budget numeric,                  -- บาท
  spend_today numeric not null default 0,
  insights jsonb not null default '{}'::jsonb,
  created_via text not null default 'agent',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table ad_campaigns enable row level security;
drop policy if exists ad_campaigns_member_read on ad_campaigns;
create policy ad_campaigns_member_read on ad_campaigns for select to authenticated
  using (public.is_shop_member(shop_id));
create index if not exists ad_campaigns_shop_idx on ad_campaigns (shop_id, created_at desc);

-- ข้อเสนอจาก AI — ร้านต้องกดยืนยันก่อน execute เสมอ (การใช้เงินทุกกรณี)
create table if not exists ad_proposals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  type text not null check (type in ('create_campaign','update_budget','resume_campaign')),
  payload jsonb not null,                -- สเปคเต็มที่จะยิง Graph API
  summary text not null,                 -- สรุปภาษาคนให้ร้านอ่านก่อนกดยืนยัน
  status text not null default 'pending' check (status in ('pending','executed','rejected','expired','failed')),
  error text,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table ad_proposals enable row level security;
drop policy if exists ad_proposals_member_read on ad_proposals;
create policy ad_proposals_member_read on ad_proposals for select to authenticated
  using (public.is_shop_member(shop_id));
create index if not exists ad_proposals_shop_idx on ad_proposals (shop_id, created_at desc);

-- Vault RPC สำหรับ ads token (pattern เดียวกับ store/get_channel_token)
create or replace function public.store_ad_token(p_ad_account_row_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_name text := 'ad_token_' || p_ad_account_row_id::text;
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = v_name;
  if v_id is not null then
    perform vault.update_secret(v_id, p_token);
  else
    perform vault.create_secret(p_token, v_name);
  end if;
end $$;
revoke all on function public.store_ad_token(uuid, text) from public, anon, authenticated;
grant execute on function public.store_ad_token(uuid, text) to service_role;

create or replace function public.get_ad_token(p_ad_account_row_id uuid)
returns text
language sql
security definer
set search_path to 'public'
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'ad_token_' || p_ad_account_row_id::text;
$$;
revoke all on function public.get_ad_token(uuid) from public, anon, authenticated;
grant execute on function public.get_ad_token(uuid) to service_role;
