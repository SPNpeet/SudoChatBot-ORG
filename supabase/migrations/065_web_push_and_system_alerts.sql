-- 065: Web Push (แจ้งเตือนบนเครื่อง ฟรี ไม่มีเพดานเหมือน LINE OA) + ประกาศสถานะระบบ
alter table platform_billing_settings
  add column if not exists vapid_public_key text,
  add column if not exists vapid_private_key text;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid references shops(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists idx_push_sub_shop on push_subscriptions (shop_id);
create index if not exists idx_push_sub_user on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;

create table if not exists system_alerts (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info',
  title text not null,
  body text,
  active boolean not null default true,
  pushed boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  ends_at timestamptz
);
do $$ begin
  alter table system_alerts add constraint system_alerts_level_chk check (level in ('info','warning','critical'));
exception when duplicate_object then null; end $$;
create index if not exists idx_system_alerts_active on system_alerts (active, created_at desc);
alter table system_alerts enable row level security;

drop policy if exists system_alerts_read on system_alerts;
create policy system_alerts_read on system_alerts
  for select to authenticated
  using (active and (ends_at is null or ends_at > now()));
