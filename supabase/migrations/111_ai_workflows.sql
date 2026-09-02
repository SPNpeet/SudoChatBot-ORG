-- 111: AI Auto Workflow — งานอัตโนมัติที่กิจการตั้งไว้ (เพิ่ม 31 ส.ค. 2569 ตามมอคอัพ Sudo Financial OS)
--
-- กติกาเหล็ก (ดู src/lib/workflows.ts): งานอัตโนมัติทำได้แค่ "เตรียมร่าง + แจ้งเตือน"
-- ห้ามออกเอกสารจริง/ลงสมุดรายวัน/จ่ายเงินเองเด็ดขาด — ร่างต้องมีคนกด "ออกจริง" เสมอ
-- ai_workflow_runs มี dedupe_key unique ต่อ workflow = รันซ้ำวันเดียวกัน/งวดเดียวกันไม่ได้ (idempotent)
create table if not exists public.ai_workflows (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  kind         text not null check (kind in ('overdue_reminder', 'recurring_invoice', 'low_stock')),
  name         text not null check (char_length(name) between 1 and 120),
  config       jsonb not null default '{}'::jsonb,
  active       boolean not null default true,
  source       text not null default 'user' check (source in ('user', 'ai')),
  created_by   uuid references auth.users(id) on delete set null,
  last_run_at  timestamptz,
  last_status  text,
  last_summary text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ai_workflows_shop_idx on public.ai_workflows (shop_id, active);

create table if not exists public.ai_workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references public.ai_workflows(id) on delete cascade,
  shop_id      uuid not null references public.shops(id) on delete cascade,
  dedupe_key   text not null,
  status       text not null check (status in ('ok', 'skipped', 'error')),
  summary      text,
  ran_at       timestamptz not null default now(),
  unique (workflow_id, dedupe_key)
);
create index if not exists ai_workflow_runs_shop_idx on public.ai_workflow_runs (shop_id, ran_at desc);

alter table public.ai_workflows enable row level security;
alter table public.ai_workflow_runs enable row level security;
drop policy if exists ai_workflows_select on public.ai_workflows;
create policy ai_workflows_select on public.ai_workflows
  for select to authenticated using (public.is_shop_member(shop_id));
drop policy if exists ai_workflow_runs_select on public.ai_workflow_runs;
create policy ai_workflow_runs_select on public.ai_workflow_runs
  for select to authenticated using (public.is_shop_member(shop_id));
-- เขียนทุกอย่างผ่าน service role (server action หลัง assertMember / cron หลัง cronRequestAllowed)

-- rollback:
--   drop table if exists public.ai_workflow_runs; drop table if exists public.ai_workflows;
