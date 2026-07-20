-- ============================================================
-- 000_baseline_schema.sql — สแนปช็อตโครงสร้างทั้งหมดจาก DB จริง (generated 2026-07-21)
-- ใช้สำหรับ Disaster Recovery / ย้ายโปรเจกต์เท่านั้น: apply กับ DB เปล่าก่อน migration 017+
-- สร้างอัตโนมัติจาก pg_catalog — ห้าม apply ทับ DB ที่มีข้อมูลอยู่แล้ว
-- หมายเหตุ: ไม่รวม auth.* / vault secrets / cron jobs (ดู migrations 023,042) / edge functions (ดู supabase/functions/)
-- ============================================================

-- ============ Extensions (6) ============

create extension if not exists "pg_cron";
create extension if not exists "pg_net";
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";
create extension if not exists "pgmq";
create extension if not exists "vector";

-- ============ Tables (38) ============

create table if not exists public.ad_accounts (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  platform text not null default 'meta'::text,
  ad_account_id text not null,
  account_name text,
  currency text,
  page_id text,
  status text not null default 'active'::text,
  daily_cap_per_campaign numeric not null default 300,
  daily_cap_total numeric not null default 1000,
  connected_by uuid,
  connected_at timestamp with time zone not null default now(),
  token_expires_at timestamp with time zone
);
create table if not exists public.ad_campaigns (
  campaign_id text not null,
  shop_id uuid not null,
  ad_account_id text not null,
  name text not null,
  objective text,
  status text,
  daily_budget numeric,
  spend_today numeric not null default 0,
  insights jsonb not null default '{}'::jsonb,
  created_via text not null default 'agent'::text,
  synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);
create table if not exists public.ad_proposals (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  type text not null,
  payload jsonb not null,
  summary text not null,
  status text not null default 'pending'::text,
  error text,
  created_at timestamp with time zone not null default now(),
  executed_at timestamp with time zone,
  expires_at timestamp with time zone not null default (now() + '24:00:00'::interval)
);
create table if not exists public.ai_provider_keys (
  provider text not null,
  secret_id uuid,
  key_last4 text,
  test_status text,
  test_message text,
  tested_at timestamp with time zone,
  updated_by uuid,
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.ai_settings (
  purpose text not null,
  tier text not null default 'standard'::text,
  provider text not null,
  model text not null,
  enabled boolean not null default true,
  updated_by uuid,
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.ai_usage_logs (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  conversation_id uuid,
  message_id uuid,
  purpose text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.audit_logs (
  id uuid not null default gen_random_uuid(),
  shop_id uuid,
  actor_type text not null,
  actor_id text,
  action text not null,
  resource_type text,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.bot_settings (
  shop_id uuid not null,
  enabled boolean not null default true,
  persona_name text not null default 'แอดมิน'::text,
  greeting text,
  tone text not null default 'friendly'::text,
  language text not null default 'th'::text,
  custom_instructions text,
  auto_close_sale boolean not null default true,
  upsell_enabled boolean not null default true,
  handoff_keywords text[] not null default ARRAY['คุยกับคน'::text, 'ติดต่อแอดมิน'::text, 'ขอสายแอดมิน'::text],
  working_hours jsonb,
  fallback_message text not null default 'ขออภัยค่ะ เดี๋ยวแอดมินจะรีบมาตอบนะคะ'::text,
  model_tier text not null default 'standard'::text,
  updated_at timestamp with time zone not null default now(),
  comment_reply_enabled boolean not null default false,
  comment_public_reply text default 'ตอบใน DM แล้วนะคะ ❤️'::text,
  comment_keywords text[] not null default '{}'::text[]
);
create table if not exists public.channels (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  platform text not null,
  platform_page_id text not null,
  page_name text,
  avatar_url text,
  token_secret_id uuid,
  token_expires_at timestamp with time zone,
  webhook_secret text,
  status text not null default 'pending'::text,
  connected_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.comment_replies (
  comment_id text not null,
  shop_id uuid not null,
  channel_id uuid,
  post_id text,
  commenter_id text not null,
  comment_text text,
  dm_text text,
  dm_sent boolean not null default false,
  public_replied boolean not null default false,
  status text not null default 'processing'::text,
  error text,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.conversations (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  channel_id uuid not null,
  customer_id uuid not null,
  status text not null default 'bot'::text,
  bot_enabled boolean not null default true,
  assigned_to uuid,
  summary text,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.customers (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  channel_id uuid not null,
  platform_user_id text not null,
  display_name text,
  avatar_url text,
  phone text,
  address jsonb,
  tags text[] not null default '{}'::text[],
  first_seen_at timestamp with time zone not null default now(),
  last_active_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.daily_analytics (
  shop_id uuid not null,
  date date not null,
  messages_in integer not null default 0,
  messages_out integer not null default 0,
  conversations_new integer not null default 0,
  customers_new integer not null default 0,
  orders_created integer not null default 0,
  orders_paid integer not null default 0,
  orders_closed_by_bot integer not null default 0,
  revenue numeric(14,2) not null default 0,
  ai_cost_usd numeric(10,4) not null default 0,
  avg_response_ms integer
);
create table if not exists public.feedback (
  id uuid not null default gen_random_uuid(),
  shop_id uuid,
  user_id uuid not null,
  message text not null,
  page text,
  created_at timestamp with time zone not null default now(),
  status text not null default 'open'::text
);
create table if not exists public.invoice_counters (
  period text not null,
  n integer not null default 0
);
create table if not exists public.knowledge_chunks (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  shop_id uuid not null,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.knowledge_documents (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  title text not null,
  source_type text not null,
  storage_path text,
  raw_text text,
  file_size bigint,
  mime_type text,
  status text not null default 'pending'::text,
  error text,
  ocr_provider text not null default 'google_document_ai'::text,
  page_count integer,
  chunk_count integer not null default 0,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  conversation_id uuid not null,
  direction text not null,
  sender_type text not null,
  content_type text not null default 'text'::text,
  content text,
  attachments jsonb not null default '[]'::jsonb,
  platform_message_id text,
  status text not null default 'received'::text,
  error text,
  ai_model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  type text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.order_items (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  shop_id uuid not null,
  product_id uuid,
  variant_id uuid,
  product_name text not null,
  variant_name text,
  unit_price numeric(12,2) not null,
  quantity integer not null,
  total numeric(12,2) not null,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.orders (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  conversation_id uuid,
  customer_id uuid,
  channel_id uuid,
  order_number text not null,
  status text not null default 'draft'::text,
  subtotal numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency text not null default 'THB'::text,
  shipping_name text,
  shipping_phone text,
  shipping_address jsonb,
  shipping_method text,
  tracking_number text,
  note text,
  closed_by text,
  paid_at timestamp with time zone,
  cancelled_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.payments (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  shop_id uuid not null,
  method text not null default 'promptpay'::text,
  amount numeric(12,2) not null,
  status text not null default 'pending'::text,
  slip_storage_path text,
  slip_data jsonb,
  slip_trans_ref text,
  verified_by text,
  verified_at timestamp with time zone,
  verifier_id uuid,
  error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.plans (
  code text not null,
  name text not null,
  price_monthly numeric(10,2) not null default 0,
  included_replies integer not null default 0,
  price_per_extra_reply numeric(10,4) not null default 0,
  max_channels integer not null default 1,
  max_members integer not null default 2,
  features jsonb not null default '[]'::jsonb,
  sort integer not null default 0,
  active boolean not null default true,
  rate_limit_per_min integer not null default 30,
  rate_limit_per_day integer not null default 3000
);
create table if not exists public.platform_admins (
  user_id uuid not null,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.platform_billing_settings (
  id boolean not null default true,
  promptpay_id text,
  account_name text,
  slip_provider text not null default 'manual'::text,
  slip_api_secret_id uuid,
  updated_at timestamp with time zone not null default now(),
  payment_gateway text not null default 'promptpay_slip'::text,
  omise_public_key text,
  company_name text,
  company_address text,
  tax_id text,
  tax_branch text not null default 'สำนักงานใหญ่'::text,
  vat_registered boolean not null default false,
  low_credit_threshold numeric not null default 50,
  email_from text
);
create table if not exists public.product_variants (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  shop_id uuid not null,
  name text not null,
  sku text,
  price numeric(12,2),
  stock integer not null default 0,
  attributes jsonb not null default '{}'::jsonb,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.products (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  sku text,
  name text not null,
  description text,
  category text,
  price numeric(12,2) not null default 0,
  compare_at_price numeric(12,2),
  cost numeric(12,2),
  stock integer not null default 0,
  track_stock boolean not null default true,
  status text not null default 'active'::text,
  images jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  weight_grams integer,
  embedding vector(1536),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.profiles (
  id uuid not null,
  display_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.rate_limit_counters (
  shop_id uuid not null,
  bucket timestamp with time zone not null,
  granularity text not null,
  n integer not null default 0
);
create table if not exists public.shop_counters (
  shop_id uuid not null,
  order_seq bigint not null default 0
);
create table if not exists public.shop_members (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  user_id uuid not null,
  role text not null default 'agent'::text,
  invited_by uuid,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.shop_payment_settings (
  shop_id uuid not null,
  promptpay_id text,
  promptpay_type text,
  account_name text,
  bank_name text,
  slip_provider text not null default 'manual'::text,
  slip_api_secret_id uuid,
  shipping_options jsonb not null default '[]'::jsonb,
  payment_expire_minutes integer not null default 1440,
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.shops (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  description text,
  logo_url text,
  plan text not null default 'free'::text,
  status text not null default 'active'::text,
  timezone text not null default 'Asia/Bangkok'::text,
  currency text not null default 'THB'::text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  plan_since date not null default CURRENT_DATE,
  next_bill_at date,
  billing_overdue boolean not null default false,
  billing_name text,
  billing_address text,
  tax_id text
);
create table if not exists public.topups (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  amount numeric(10,2) not null,
  method text not null default 'promptpay'::text,
  status text not null default 'pending'::text,
  qr_path text,
  slip_path text,
  slip_data jsonb,
  slip_trans_ref text,
  verified_by text,
  verifier_id uuid,
  error text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  paid_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  gateway text not null default 'promptpay_slip'::text,
  charge_id text,
  invoice_number text
);
create table if not exists public.usage_monthly (
  shop_id uuid not null,
  period text not null,
  replies_count integer not null default 0,
  billed_replies integer not null default 0,
  billed_amount numeric(12,4) not null default 0,
  ai_cost_usd numeric(12,6) not null default 0
);
create table if not exists public.wallet_transactions (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  type text not null,
  amount numeric(12,4) not null,
  balance_after numeric(12,4) not null,
  ref_type text,
  ref_id text,
  note text,
  created_by uuid,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.wallets (
  shop_id uuid not null,
  balance numeric(12,4) not null default 0,
  lifetime_topup numeric(12,2) not null default 0,
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.webhook_events (
  id uuid not null default gen_random_uuid(),
  platform text not null,
  channel_id uuid,
  shop_id uuid,
  event_type text,
  payload jsonb not null,
  headers jsonb,
  signature_valid boolean,
  status text not null default 'received'::text,
  error text,
  retry_count integer not null default 0,
  received_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone
);

-- ============ Primary keys / unique / checks (90) ============

alter table only ad_accounts add constraint ad_accounts_pkey PRIMARY KEY (id);
alter table only ad_accounts add constraint ad_accounts_platform_check CHECK ((platform = 'meta'::text));
alter table only ad_accounts add constraint ad_accounts_shop_id_platform_ad_account_id_key UNIQUE (shop_id, platform, ad_account_id);
alter table only ad_accounts add constraint ad_accounts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disconnected'::text, 'token_expired'::text])));
alter table only ad_campaigns add constraint ad_campaigns_pkey PRIMARY KEY (campaign_id);
alter table only ad_proposals add constraint ad_proposals_pkey PRIMARY KEY (id);
alter table only ad_proposals add constraint ad_proposals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'executed'::text, 'rejected'::text, 'expired'::text, 'failed'::text])));
alter table only ad_proposals add constraint ad_proposals_type_check CHECK ((type = ANY (ARRAY['create_campaign'::text, 'update_budget'::text, 'resume_campaign'::text])));
alter table only ai_provider_keys add constraint ai_provider_keys_pkey PRIMARY KEY (provider);
alter table only ai_provider_keys add constraint ai_provider_keys_provider_check CHECK ((provider = ANY (ARRAY['anthropic'::text, 'google'::text, 'openai'::text, 'deepseek'::text, 'qwen'::text, 'zhipu'::text, 'moonshot'::text, 'mistral'::text])));
alter table only ai_provider_keys add constraint ai_provider_keys_test_status_check CHECK ((test_status = ANY (ARRAY['ok'::text, 'failed'::text])));
alter table only ai_settings add constraint ai_settings_pkey PRIMARY KEY (purpose, tier);
alter table only ai_settings add constraint ai_settings_provider_check CHECK ((provider = ANY (ARRAY['anthropic'::text, 'google'::text, 'openai'::text, 'deepseek'::text, 'qwen'::text, 'zhipu'::text, 'moonshot'::text, 'mistral'::text])));
alter table only ai_settings add constraint ai_settings_purpose_check CHECK ((purpose = ANY (ARRAY['chat'::text, 'embedding'::text])));
alter table only ai_usage_logs add constraint ai_usage_logs_pkey PRIMARY KEY (id);
alter table only ai_usage_logs add constraint ai_usage_logs_purpose_check CHECK ((purpose = ANY (ARRAY['reply'::text, 'embedding'::text, 'ocr'::text, 'slip_verify'::text, 'summarize'::text, 'classify'::text, 'ads'::text])));
alter table only audit_logs add constraint audit_logs_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'bot'::text, 'system'::text, 'webhook'::text])));
alter table only audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table only bot_settings add constraint bot_settings_model_tier_check CHECK ((model_tier = ANY (ARRAY['economy'::text, 'standard'::text, 'premium'::text])));
alter table only bot_settings add constraint bot_settings_pkey PRIMARY KEY (shop_id);
alter table only bot_settings add constraint bot_settings_tone_check CHECK ((tone = ANY (ARRAY['friendly'::text, 'formal'::text, 'playful'::text])));
alter table only channels add constraint channels_pkey PRIMARY KEY (id);
alter table only channels add constraint channels_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'instagram'::text, 'line'::text, 'tiktok'::text])));
alter table only channels add constraint channels_platform_platform_page_id_key UNIQUE (platform, platform_page_id);
alter table only channels add constraint channels_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'disconnected'::text, 'error'::text])));
alter table only comment_replies add constraint comment_replies_pkey PRIMARY KEY (comment_id);
alter table only comment_replies add constraint comment_replies_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'replied'::text, 'skipped'::text, 'failed'::text])));
alter table only conversations add constraint conversations_pkey PRIMARY KEY (id);
alter table only conversations add constraint conversations_status_check CHECK ((status = ANY (ARRAY['bot'::text, 'human'::text, 'closed'::text])));
alter table only customers add constraint customers_channel_id_platform_user_id_key UNIQUE (channel_id, platform_user_id);
alter table only customers add constraint customers_pkey PRIMARY KEY (id);
alter table only daily_analytics add constraint daily_analytics_pkey PRIMARY KEY (shop_id, date);
alter table only feedback add constraint feedback_message_check CHECK (((char_length(message) >= 3) AND (char_length(message) <= 2000)));
alter table only feedback add constraint feedback_pkey PRIMARY KEY (id);
alter table only feedback add constraint feedback_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'dismissed'::text])));
alter table only invoice_counters add constraint invoice_counters_pkey PRIMARY KEY (period);
alter table only knowledge_chunks add constraint knowledge_chunks_pkey PRIMARY KEY (id);
alter table only knowledge_documents add constraint knowledge_documents_pkey PRIMARY KEY (id);
alter table only knowledge_documents add constraint knowledge_documents_source_type_check CHECK ((source_type = ANY (ARRAY['pdf'::text, 'image'::text, 'text'::text, 'url'::text, 'faq'::text])));
alter table only knowledge_documents add constraint knowledge_documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text])));
alter table only messages add constraint messages_content_type_check CHECK ((content_type = ANY (ARRAY['text'::text, 'image'::text, 'sticker'::text, 'file'::text, 'audio'::text, 'video'::text, 'location'::text, 'template'::text])));
alter table only messages add constraint messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
alter table only messages add constraint messages_pkey PRIMARY KEY (id);
alter table only messages add constraint messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['customer'::text, 'bot'::text, 'agent'::text, 'system'::text])));
alter table only messages add constraint messages_status_check CHECK ((status = ANY (ARRAY['received'::text, 'queued'::text, 'processing'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'skipped'::text])));
alter table only notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table only order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table only order_items add constraint order_items_quantity_check CHECK ((quantity > 0));
alter table only orders add constraint orders_closed_by_check CHECK ((closed_by = ANY (ARRAY['bot'::text, 'human'::text])));
alter table only orders add constraint orders_pkey PRIMARY KEY (id);
alter table only orders add constraint orders_shop_id_order_number_key UNIQUE (shop_id, order_number);
alter table only orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_payment'::text, 'paid'::text, 'confirmed'::text, 'shipped'::text, 'completed'::text, 'cancelled'::text, 'expired'::text])));
alter table only payments add constraint payments_method_check CHECK ((method = ANY (ARRAY['promptpay'::text, 'bank_transfer'::text, 'cod'::text, 'other'::text])));
alter table only payments add constraint payments_pkey PRIMARY KEY (id);
alter table only payments add constraint payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'verifying'::text, 'verified'::text, 'rejected'::text, 'refunded'::text, 'expired'::text])));
alter table only payments add constraint payments_verified_by_check CHECK ((verified_by = ANY (ARRAY['auto'::text, 'manual'::text])));
alter table only plans add constraint plans_pkey PRIMARY KEY (code);
alter table only platform_admins add constraint platform_admins_pkey PRIMARY KEY (user_id);
alter table only platform_billing_settings add constraint platform_billing_settings_id_check CHECK (id);
alter table only platform_billing_settings add constraint platform_billing_settings_payment_gateway_check CHECK ((payment_gateway = ANY (ARRAY['promptpay_slip'::text, 'omise'::text])));
alter table only platform_billing_settings add constraint platform_billing_settings_pkey PRIMARY KEY (id);
alter table only platform_billing_settings add constraint platform_billing_settings_slip_provider_check CHECK ((slip_provider = ANY (ARRAY['easyslip'::text, 'slipok'::text, 'manual'::text])));
alter table only product_variants add constraint product_variants_pkey PRIMARY KEY (id);
alter table only product_variants add constraint product_variants_shop_id_sku_key UNIQUE (shop_id, sku);
alter table only product_variants add constraint product_variants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])));
alter table only products add constraint products_pkey PRIMARY KEY (id);
alter table only products add constraint products_shop_id_sku_key UNIQUE (shop_id, sku);
alter table only products add constraint products_status_check CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])));
alter table only profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table only rate_limit_counters add constraint rate_limit_counters_pkey PRIMARY KEY (shop_id, granularity, bucket);
alter table only shop_counters add constraint shop_counters_pkey PRIMARY KEY (shop_id);
alter table only shop_members add constraint shop_members_pkey PRIMARY KEY (id);
alter table only shop_members add constraint shop_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'agent'::text, 'viewer'::text])));
alter table only shop_members add constraint shop_members_shop_id_user_id_key UNIQUE (shop_id, user_id);
alter table only shop_payment_settings add constraint shop_payment_settings_pkey PRIMARY KEY (shop_id);
alter table only shop_payment_settings add constraint shop_payment_settings_promptpay_type_check CHECK ((promptpay_type = ANY (ARRAY['phone'::text, 'citizen_id'::text, 'ewallet'::text])));
alter table only shop_payment_settings add constraint shop_payment_settings_slip_provider_check CHECK ((slip_provider = ANY (ARRAY['easyslip'::text, 'slipok'::text, 'manual'::text])));
alter table only shops add constraint shops_pkey PRIMARY KEY (id);
alter table only shops add constraint shops_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text, 'enterprise'::text])));
alter table only shops add constraint shops_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'closed'::text])));
alter table only topups add constraint topups_amount_check CHECK ((amount >= (20)::numeric));
alter table only topups add constraint topups_pkey PRIMARY KEY (id);
alter table only topups add constraint topups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'verifying'::text, 'paid'::text, 'rejected'::text, 'expired'::text])));
alter table only topups add constraint topups_verified_by_check CHECK ((verified_by = ANY (ARRAY['auto'::text, 'manual'::text])));
alter table only usage_monthly add constraint usage_monthly_pkey PRIMARY KEY (shop_id, period);
alter table only wallet_transactions add constraint wallet_transactions_pkey PRIMARY KEY (id);
alter table only wallet_transactions add constraint wallet_transactions_type_check CHECK ((type = ANY (ARRAY['topup'::text, 'debit'::text, 'refund'::text, 'adjust'::text, 'bonus'::text])));
alter table only wallets add constraint wallets_pkey PRIMARY KEY (shop_id);
alter table only webhook_events add constraint webhook_events_pkey PRIMARY KEY (id);
alter table only webhook_events add constraint webhook_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'queued'::text, 'processed'::text, 'failed'::text, 'skipped'::text, 'duplicate'::text])));

-- ============ Foreign keys (59) ============

alter table only ad_accounts add constraint ad_accounts_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only ad_campaigns add constraint ad_campaigns_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only ad_proposals add constraint ad_proposals_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only ai_provider_keys add constraint ai_provider_keys_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
alter table only ai_settings add constraint ai_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
alter table only ai_usage_logs add constraint ai_usage_logs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only audit_logs add constraint audit_logs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;
alter table only bot_settings add constraint bot_settings_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only channels add constraint channels_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES profiles(id);
alter table only channels add constraint channels_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only comment_replies add constraint comment_replies_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;
alter table only comment_replies add constraint comment_replies_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only conversations add constraint conversations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id);
alter table only conversations add constraint conversations_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
alter table only conversations add constraint conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table only conversations add constraint conversations_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only customers add constraint customers_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
alter table only customers add constraint customers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only daily_analytics add constraint daily_analytics_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only feedback add constraint feedback_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;
alter table only knowledge_chunks add constraint knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE;
alter table only knowledge_chunks add constraint knowledge_chunks_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only knowledge_documents add constraint knowledge_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table only knowledge_documents add constraint knowledge_documents_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only messages add constraint messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table only messages add constraint messages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only notifications add constraint notifications_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table only order_items add constraint order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table only order_items add constraint order_items_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only order_items add constraint order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
alter table only orders add constraint orders_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;
alter table only orders add constraint orders_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
alter table only orders add constraint orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table only orders add constraint orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only payments add constraint payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table only payments add constraint payments_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only payments add constraint payments_verifier_id_fkey FOREIGN KEY (verifier_id) REFERENCES profiles(id);
alter table only platform_admins add constraint platform_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only product_variants add constraint product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table only product_variants add constraint product_variants_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only products add constraint products_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only rate_limit_counters add constraint rate_limit_counters_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only shop_counters add constraint shop_counters_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only shop_members add constraint shop_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id);
alter table only shop_members add constraint shop_members_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only shop_members add constraint shop_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only shop_payment_settings add constraint shop_payment_settings_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only shops add constraint shops_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);
alter table only topups add constraint topups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table only topups add constraint topups_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only topups add constraint topups_verifier_id_fkey FOREIGN KEY (verifier_id) REFERENCES profiles(id);
alter table only usage_monthly add constraint usage_monthly_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only wallet_transactions add constraint wallet_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table only wallet_transactions add constraint wallet_transactions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only wallets add constraint wallets_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
alter table only webhook_events add constraint webhook_events_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;
alter table only webhook_events add constraint webhook_events_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;

-- ============ Functions (56) ============

CREATE OR REPLACE FUNCTION public.admin_confirm_topup(p_topup_id uuid, p_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_t record; v_bal numeric;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select * into v_t from topups where id = p_topup_id for update;
  if not found then raise exception 'topup not found'; end if;
  if v_t.status = 'paid' then return jsonb_build_object('ok', false, 'message', 'รายการนี้ยืนยันแล้ว'); end if;

  if p_approve then
    update topups set status='paid', verified_by='manual', verifier_id=(select auth.uid()), paid_at=now() where id=p_topup_id;
    v_bal := credit_wallet(v_t.shop_id, v_t.amount, 'topup', 'topup', p_topup_id::text, 'เติมเงิน PromptPay', (select auth.uid()));
    insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id, details)
      values (v_t.shop_id, 'user', (select auth.uid())::text, 'topup_confirmed', 'topups', p_topup_id::text, jsonb_build_object('amount', v_t.amount, 'balance', v_bal));
    return jsonb_build_object('ok', true, 'balance', v_bal);
  else
    update topups set status='rejected', verified_by='manual', verifier_id=(select auth.uid()) where id=p_topup_id;
    insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id)
      values (v_t.shop_id, 'user', (select auth.uid())::text, 'topup_rejected', 'topups', p_topup_id::text);
    return jsonb_build_object('ok', true, 'rejected', true);
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_shops(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; v_total int;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select count(*) into v_total from shops s
    where p_search is null or p_search = '' or s.name ilike '%'||p_search||'%';
  select jsonb_build_object(
    'total', v_total,
    'rows', coalesce(jsonb_agg(row), '[]'::jsonb)
  ) into v
  from (
    select jsonb_build_object(
      'id', s.id, 'name', s.name, 'plan', s.plan, 'status', s.status, 'created_at', s.created_at,
      'owner_email', (select u.email from shop_members sm join auth.users u on u.id = sm.user_id
                      where sm.shop_id = s.id and sm.role = 'owner' limit 1)
    ) as row
    from shops s
    where p_search is null or p_search = '' or s.name ilike '%'||p_search||'%'
    order by s.created_at desc
    limit p_limit offset p_offset
  ) t;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_mark_feedback(p_feedback_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if p_status not in ('open','resolved','dismissed') then
    return jsonb_build_object('ok', false, 'message', 'สถานะไม่ถูกต้อง');
  end if;
  update feedback set status = p_status where id = p_feedback_id;
  if not found then return jsonb_build_object('ok', false, 'message', 'ไม่พบรายการนี้'); end if;
  return jsonb_build_object('ok', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_shop_plan(p_shop_id uuid, p_plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if not exists (select 1 from plans where code = p_plan) then
    return jsonb_build_object('ok', false, 'message', 'แพ็กไม่ถูกต้อง');
  end if;
  update shops set plan = p_plan, plan_since = current_date, updated_at = now() where id = p_shop_id;
  if not found then return jsonb_build_object('ok', false, 'message', 'ไม่พบร้านนี้'); end if;
  insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id, details)
    values (p_shop_id, 'user', (select auth.uid())::text, 'admin_shop_plan_changed', 'shops', p_shop_id::text, jsonb_build_object('plan', p_plan));
  return jsonb_build_object('ok', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_shop_status(p_shop_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if p_status not in ('active','suspended','closed') then
    return jsonb_build_object('ok', false, 'message', 'สถานะไม่ถูกต้อง');
  end if;
  update shops set status = p_status, updated_at = now() where id = p_shop_id;
  if not found then return jsonb_build_object('ok', false, 'message', 'ไม่พบร้านนี้'); end if;
  insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id, details)
    values (p_shop_id, 'user', (select auth.uid())::text, 'admin_shop_status_changed', 'shops', p_shop_id::text, jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.bill_bot_reply(p_shop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_period text := current_period();
  v_plan record; v_used int; v_bal numeric; v_price numeric; v_allowed boolean; v_reason text;
begin
  select p.* into v_plan from shops s join plans p on p.code = s.plan where s.id = p_shop_id;
  if not found then
    select * into v_plan from plans where code = 'free';
  end if;

  insert into usage_monthly (shop_id, period, replies_count) values (p_shop_id, v_period, 0)
    on conflict (shop_id, period) do nothing;
  select replies_count into v_used from usage_monthly where shop_id = p_shop_id and period = v_period for update;

  if v_used < v_plan.included_replies then
    -- ยังอยู่ในโควตาฟรี
    update usage_monthly set replies_count = replies_count + 1 where shop_id = p_shop_id and period = v_period;
    return jsonb_build_object('allowed', true, 'billed', false, 'remaining_free', v_plan.included_replies - v_used - 1);
  end if;

  -- เกินโควตา -> หักจาก wallet
  v_price := v_plan.price_per_extra_reply;
  select balance into v_bal from wallets where shop_id = p_shop_id for update;
  if coalesce(v_bal,0) >= v_price then
    update wallets set balance = balance - v_price, updated_at = now() where shop_id = p_shop_id returning balance into v_bal;
    update usage_monthly set replies_count = replies_count + 1, billed_replies = billed_replies + 1,
      billed_amount = billed_amount + v_price where shop_id = p_shop_id and period = v_period;
    insert into wallet_transactions (shop_id, type, amount, balance_after, ref_type, note)
      values (p_shop_id, 'debit', -v_price, v_bal, 'bot_reply', 'ค่าบอทตอบเกินโควตา');
    return jsonb_build_object('allowed', true, 'billed', true, 'charged', v_price, 'balance', v_bal);
  else
    return jsonb_build_object('allowed', false, 'reason', 'insufficient_credit',
      'message', 'เครดิตหมดและใช้เกินโควตาแพ็กเกจแล้ว กรุณาเติมเงินหรืออัปเกรดแพ็กเกจ');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.billing_summary(p_shop_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'balance', coalesce((select balance from wallets where shop_id = p_shop_id), 0),
    'plan', (select to_jsonb(p) from plans p join shops s on s.plan = p.code where s.id = p_shop_id),
    'usage', coalesce((select to_jsonb(u) from usage_monthly u where shop_id = p_shop_id and period = current_period()),
      jsonb_build_object('replies_count',0,'billed_replies',0,'billed_amount',0))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.check_shop_rate_limit(p_shop_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_min int; v_day int; v_lim_min int := 30; v_lim_day int := 3000;
begin
  select p.rate_limit_per_min, p.rate_limit_per_day into v_lim_min, v_lim_day
    from shops s join plans p on p.code = s.plan where s.id = p_shop_id;
  v_lim_min := coalesce(v_lim_min, 30); v_lim_day := coalesce(v_lim_day, 3000);

  insert into rate_limit_counters (shop_id, granularity, bucket, n)
    values (p_shop_id, 'minute', date_trunc('minute', now()), 1)
    on conflict (shop_id, granularity, bucket) do update set n = rate_limit_counters.n + 1
    returning n into v_min;
  insert into rate_limit_counters (shop_id, granularity, bucket, n)
    values (p_shop_id, 'day', date_trunc('day', now() at time zone 'Asia/Bangkok'), 1)
    on conflict (shop_id, granularity, bucket) do update set n = rate_limit_counters.n + 1
    returning n into v_day;

  if v_min > v_lim_min or v_day > v_lim_day then
    -- บันทึก audit ครั้งแรกของนาทีที่เกิน (กัน log ท่วม)
    if v_min = v_lim_min + 1 or v_day = v_lim_day + 1 then
      insert into audit_logs (shop_id, actor_type, action, resource_type, details)
        values (p_shop_id, 'system', 'rate_limit_exceeded', 'shops',
                jsonb_build_object('per_min', v_min, 'lim_min', v_lim_min, 'per_day', v_day, 'lim_day', v_lim_day));
    end if;
    return false;
  end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_platform_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (select auth.uid()) is null then return false; end if;
  if exists (select 1 from platform_admins) then return false; end if;
  insert into platform_admins (user_id) values ((select auth.uid()));
  insert into audit_logs (actor_type, actor_id, action, resource_type)
    values ('user', (select auth.uid())::text, 'platform_admin_claimed', 'platform_admins');
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.credit_wallet(p_shop_id uuid, p_amount numeric, p_type text, p_ref_type text DEFAULT NULL::text, p_ref_id text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_bal numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  insert into wallets (shop_id, balance) values (p_shop_id, 0) on conflict (shop_id) do nothing;
  update wallets set balance = balance + p_amount,
    lifetime_topup = lifetime_topup + case when p_type in ('topup') then p_amount else 0 end,
    updated_at = now()
  where shop_id = p_shop_id returning balance into v_bal;
  insert into wallet_transactions (shop_id, type, amount, balance_after, ref_type, ref_id, note, created_by)
    values (p_shop_id, p_type, p_amount, v_bal, p_ref_type, p_ref_id, p_note, p_actor);
  return v_bal;
end $function$
;

CREATE OR REPLACE FUNCTION public.current_period()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM');
$function$
;

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_variant_id uuid, p_qty integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_ok boolean := false;
begin
  if p_qty = 0 then return false; end if;

  if p_qty < 0 then
    -- คืนสต๊อก (refund/ยกเลิกออเดอร์) — บวกกลับ ไม่ต้องเช็คขั้นต่ำ
    if p_variant_id is not null then
      update product_variants set stock = stock - p_qty where id = p_variant_id
      returning true into v_ok;
    else
      update products set stock = stock - p_qty where id = p_product_id
      returning true into v_ok;
    end if;
    return coalesce(v_ok, false);
  end if;

  -- ตัดสต๊อก (ห้ามติดลบ)
  if p_variant_id is not null then
    update product_variants set stock = stock - p_qty
    where id = p_variant_id and stock >= p_qty
    returning true into v_ok;
  else
    update products set stock = stock - p_qty
    where id = p_product_id and (not track_stock or stock >= p_qty)
    returning true into v_ok;
  end if;
  return coalesce(v_ok, false);
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_channel_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_max int; v_cnt int;
begin
  select p.max_channels into v_max from shops s join plans p on p.code=s.plan where s.id=new.shop_id;
  select count(*) into v_cnt from channels where shop_id=new.shop_id and status <> 'disconnected';
  if v_cnt >= coalesce(v_max,1) then
    raise exception 'เกินจำนวนช่องทางของแพ็กเกจ (สูงสุด % ช่องทาง) กรุณาอัปเกรดแพ็กเกจ', v_max
      using errcode='check_violation';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_member_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_max int; v_cnt int;
begin
  select count(*) into v_cnt from shop_members where shop_id=new.shop_id;
  if v_cnt = 0 then return new; end if;  -- owner คนแรกผ่านเสมอ
  select p.max_members into v_max from shops s join plans p on p.code=s.plan where s.id=new.shop_id;
  if v_cnt >= coalesce(v_max,2) then
    raise exception 'เกินจำนวนสมาชิกของแพ็กเกจ (สูงสุด % คน) กรุณาอัปเกรดแพ็กเกจ', v_max
      using errcode='check_violation';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_ad_token(p_ad_account_row_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'ad_token_' || p_ad_account_row_id::text;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ai_key(p_provider text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ds.decrypted_secret
  from ai_provider_keys k join vault.decrypted_secrets ds on ds.id = k.secret_id
  where k.provider = p_provider;
$function$
;

CREATE OR REPLACE FUNCTION public.get_channel_token(p_channel_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ds.decrypted_secret
  from channels c join vault.decrypted_secrets ds on ds.id = c.token_secret_id
  where c.id = p_channel_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_platform_omise_key()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'platform_omise_secret_key' limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_platform_slip_key()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ds.decrypted_secret from platform_billing_settings s
  join vault.decrypted_secrets ds on ds.id = s.slip_api_secret_id where s.id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_shop_slip_key(p_shop_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ds.decrypted_secret
  from shop_payment_settings sp join vault.decrypted_secrets ds on ds.id = sp.slip_api_secret_id
  where sp.shop_id = p_shop_id;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_shop()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into shop_members (shop_id, user_id, role) values (new.id, new.owner_id, 'owner') on conflict do nothing;
  insert into bot_settings (shop_id) values (new.id) on conflict do nothing;
  insert into shop_payment_settings (shop_id) values (new.id) on conflict do nothing;
  insert into shop_counters (shop_id, order_seq) values (new.id, 0) on conflict do nothing;
  insert into wallets (shop_id, balance) values (new.id, 0) on conflict do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.has_shop_role(p_shop_id uuid, p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = (select auth.uid()) and role = any(p_roles)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from platform_admins where user_id = (select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = (select auth.uid())
  );
$function$
;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(p_shop_id uuid, p_query_embedding vector, p_match_count integer DEFAULT 5, p_min_similarity double precision DEFAULT 0.3)
 RETURNS TABLE(chunk_id uuid, document_id uuid, content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select c.id, c.document_id, c.content,
         1 - (c.embedding <=> p_query_embedding) as similarity
  from knowledge_chunks c
  where c.shop_id = p_shop_id
    and c.embedding is not null
    and 1 - (c.embedding <=> p_query_embedding) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.match_products(p_shop_id uuid, p_query_embedding vector, p_match_count integer DEFAULT 5)
 RETURNS TABLE(product_id uuid, name text, description text, price numeric, stock integer, images jsonb, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select p.id, p.name, p.description, p.price, p.stock, p.images,
         1 - (p.embedding <=> p_query_embedding) as similarity
  from products p
  where p.shop_id = p_shop_id
    and p.status = 'active'
    and p.embedding is not null
  order by p.embedding <=> p_query_embedding
  limit p_match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_period text := to_char(now() at time zone 'Asia/Bangkok', 'YYYYMM'); v_n int;
begin
  insert into invoice_counters (period, n) values (v_period, 1)
    on conflict (period) do update set n = invoice_counters.n + 1
    returning n into v_n;
  return 'INV-' || v_period || '-' || lpad(v_n::text, 4, '0');
end $function$
;

CREATE OR REPLACE FUNCTION public.next_order_number(p_shop_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_seq bigint;
begin
  insert into shop_counters as c (shop_id, order_seq) values (p_shop_id, 1)
  on conflict (shop_id) do update set order_seq = c.order_seq + 1
  returning order_seq into v_seq;
  return 'ORD' || to_char(now() at time zone 'Asia/Bangkok','YYMM') || '-' || lpad(v_seq::text, 5, '0');
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_bot_blocked(p_shop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_name text; v_email text;
begin
  -- dedupe: แจ้งซ้ำไม่เกิน 1 ครั้ง/24 ชม.
  if exists (select 1 from notifications where shop_id = p_shop_id and type = 'bot_blocked'
             and created_at > now() - interval '24 hours') then return; end if;
  select name into v_name from shops where id = p_shop_id;
  insert into notifications (shop_id, type, title, body) values (
    p_shop_id, 'bot_blocked',
    'บอทหยุดตอบลูกค้า — เครดิตหมด',
    'เครดิตของร้าน '||coalesce(v_name,'')||' หมดและใช้เกินโควตาแพ็กเกจแล้ว บอทจะไม่ตอบลูกค้าจนกว่าจะเติมเงินหรืออัปเกรดแพ็กเกจ'
  );
  insert into audit_logs (shop_id, actor_type, action, resource_type, details)
    values (p_shop_id, 'system', 'bot_blocked_notified', 'shops', jsonb_build_object('reason','no_credit'));
  v_email := public.shop_owner_email(p_shop_id);
  perform public.send_platform_email(
    v_email,
    '[SudoChatBot] บอทของร้าน '||coalesce(v_name,'')||' หยุดตอบลูกค้า — เครดิตหมด',
    '<p>เรียนเจ้าของร้าน '||coalesce(v_name,'')||'</p>'
    ||'<p>เครดิตของร้านหมดและใช้เกินโควตาแพ็กเกจแล้ว <b>บอทได้หยุดตอบลูกค้าชั่วคราว</b> ลูกค้าที่ทักเข้ามาจะไม่ได้รับการตอบกลับอัตโนมัติ</p>'
    ||'<p>เติมเงินหรืออัปเกรดแพ็กเกจได้ที่หน้า แพ็กเกจ/เครดิต ใน dashboard เพื่อให้บอทกลับมาทำงานทันที</p>'
    ||'<p>— SudoChatBot</p>'
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_handoff(p_shop_id uuid, p_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_name text; v_customer text;
begin
  -- dedupe ต่อบทสนทนา 1 ชม. (ลูกค้าพิมพ์ซ้ำหลายรอบไม่สแปมอีเมล)
  if exists (select 1 from audit_logs where action = 'handoff_notified'
             and resource_id = p_conversation_id::text and created_at > now() - interval '1 hour') then return; end if;
  select s.name into v_name from shops s where s.id = p_shop_id;
  select coalesce(c.display_name, 'ลูกค้า') into v_customer
    from conversations cv left join customers c on c.id = cv.customer_id where cv.id = p_conversation_id;
  insert into notifications (shop_id, type, title, body) values (
    p_shop_id, 'handoff',
    '🙋 '||v_customer||' รอคุยกับแอดมิน',
    'บอทส่งต่อบทสนทนาให้คุณแล้ว — เข้าไปตอบที่หน้า แชท โดยเร็วเพื่อไม่ให้ลูกค้ารอนาน'
  );
  insert into audit_logs (shop_id, actor_type, action, resource_type, resource_id)
    values (p_shop_id, 'system', 'handoff_notified', 'conversations', p_conversation_id::text);
  perform public.send_platform_email(
    public.shop_owner_email(p_shop_id),
    '[SudoChatBot] 🙋 ลูกค้ารอคุยกับแอดมิน — ร้าน '||coalesce(v_name,''),
    '<p>เรียนเจ้าของร้าน '||coalesce(v_name,'')||'</p>'
    ||'<p><b>'||v_customer||'</b> ต้องการคุยกับแอดมิน บอทหยุดตอบในบทสนทนานี้แล้วเพื่อรอคุณ</p>'
    ||'<p>เข้าไปตอบได้ที่หน้า แชท ใน dashboard</p><p>— SudoChatBot</p>'
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_low_credit()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_threshold numeric; n int := 0;
begin
  select coalesce(low_credit_threshold, 50) into v_threshold from platform_billing_settings where id = true;
  for r in
    select s.id, s.name, w.balance from shops s
    join wallets w on w.shop_id = s.id
    where s.status = 'active' and w.balance > 0 and w.balance <= v_threshold
      and not exists (select 1 from notifications nt where nt.shop_id = s.id
                      and nt.type = 'low_credit' and nt.created_at > now() - interval '3 days')
  loop
    insert into notifications (shop_id, type, title, body) values (
      r.id, 'low_credit',
      'เครดิตใกล้หมด — เหลือ '||to_char(r.balance,'FM999,999,990.00')||' บาท',
      'เมื่อเครดิตหมดและใช้เกินโควตาแพ็กเกจ บอทจะหยุดตอบลูกค้าอัตโนมัติ แนะนำให้เติมเงินล่วงหน้า'
    );
    perform public.send_platform_email(
      public.shop_owner_email(r.id),
      '[SudoChatBot] เครดิตร้าน '||coalesce(r.name,'')||' ใกล้หมด (เหลือ '||to_char(r.balance,'FM999,999,990.00')||' บาท)',
      '<p>เรียนเจ้าของร้าน '||coalesce(r.name,'')||'</p>'
      ||'<p>เครดิตคงเหลือ <b>'||to_char(r.balance,'FM999,999,990.00')||' บาท</b> — เมื่อเครดิตหมดและใช้เกินโควตา บอทจะหยุดตอบลูกค้าอัตโนมัติ</p>'
      ||'<p>เติมเงินได้ที่หน้า แพ็กเกจ/เครดิต ใน dashboard</p><p>— SudoChatBot</p>'
    );
    n := n + 1;
  end loop;
  return jsonb_build_object('notified', n, 'ran_at', now());
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_order_paid(p_shop_id uuid, p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_name text; v_num text; v_total numeric;
begin
  -- กันแจ้งซ้ำต่อออเดอร์
  if exists (select 1 from audit_logs where action = 'order_paid_notified' and resource_id = p_order_id::text) then return; end if;
  select name into v_name from shops where id = p_shop_id;
  select order_number, total into v_num, v_total from orders where id = p_order_id;
  if v_num is null then return; end if;
  insert into notifications (shop_id, type, title, body) values (
    p_shop_id, 'order_paid',
    '💰 บอทปิดการขายได้! ออเดอร์ '||v_num||' ชำระแล้ว '||to_char(v_total,'FM999,999,990.00')||' บาท',
    'ลูกค้าชำระเงินและระบบตรวจสลิปผ่านแล้ว เตรียมแพ็กของส่งได้เลย — ดูรายละเอียดที่หน้า ออเดอร์'
  );
  insert into audit_logs (shop_id, actor_type, action, resource_type, resource_id)
    values (p_shop_id, 'system', 'order_paid_notified', 'orders', p_order_id::text);
  perform public.send_platform_email(
    public.shop_owner_email(p_shop_id),
    '[SudoChatBot] 💰 ออเดอร์ใหม่ชำระแล้ว '||v_num||' ('||to_char(v_total,'FM999,999,990.00')||' บาท) — ร้าน '||coalesce(v_name,''),
    '<p>เรียนเจ้าของร้าน '||coalesce(v_name,'')||'</p>'
    ||'<p>บอทปิดการขายสำเร็จ! ออเดอร์ <b>'||v_num||'</b> ยอด <b>'||to_char(v_total,'FM999,999,990.00')||' บาท</b> ลูกค้าชำระเงินและตรวจสลิปผ่านแล้ว</p>'
    ||'<p>เข้าไปดูที่อยู่จัดส่งและเตรียมแพ็กของได้ที่หน้า ออเดอร์ ใน dashboard</p><p>— SudoChatBot</p>'
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.on_plan_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_price numeric;
begin
  if new.plan is distinct from old.plan then
    select price_monthly into v_price from plans where code = new.plan;
    if coalesce(v_price,0) > 0 then
      new.next_bill_at := coalesce(new.next_bill_at, (current_date + interval '1 month')::date);
      new.plan_since := current_date;
    else
      new.next_bill_at := null; new.billing_overdue := false;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.on_topup_paid_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') and new.invoice_number is null then
    new.invoice_number := public.next_invoice_number();
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.platform_billing_public()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'promptpay_id', promptpay_id,
    'account_name', account_name,
    'payment_gateway', payment_gateway,
    'omise_public_key', omise_public_key
  ) from platform_billing_settings where id = true;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_revenue()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when public.is_platform_admin() then jsonb_build_object(
    'total_shops', (select count(*) from shops),
    'active_shops', (select count(*) from shops where status='active'),
    'total_topup', coalesce((select sum(amount) from topups where status='paid'),0),
    'topup_30d', coalesce((select sum(amount) from topups where status='paid' and paid_at > now()-interval '30 days'),0),
    'pending_topups', (select count(*) from topups where status in ('pending','verifying')),
    'wallet_outstanding', coalesce((select sum(balance) from wallets),0),
    'plan_breakdown', coalesce((select jsonb_object_agg(plan, c) from (select plan, count(*) c from shops group by plan) x),'{}'::jsonb)
  ) else jsonb_build_object('error','forbidden') end;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select jsonb_build_object(
    'users', (select jsonb_build_object(
        'total', count(*),
        'new_today', count(*) filter (where created_at >= date_trunc('day', now())),
        'new_7d', count(*) filter (where created_at >= now() - interval '7 days'),
        'active_24h', count(*) filter (where last_sign_in_at >= now() - interval '24 hours')
      ) from auth.users),
    'shops', (select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'new_7d', count(*) filter (where created_at >= now() - interval '7 days'),
        'by_plan', (select coalesce(jsonb_object_agg(plan, c), '{}'::jsonb)
                    from (select plan, count(*) c from shops group by plan) t)
      ) from shops),
    'revenue', jsonb_build_object(
        'topups_paid_total', coalesce((select sum(amount) from topups where status = 'paid'), 0),
        'topups_paid_30d', coalesce((select sum(amount) from topups where status = 'paid' and created_at >= now() - interval '30 days'), 0),
        'billed_this_month', coalesce((select sum(billed_amount) from usage_monthly where period = current_period()), 0),
        'credit_outstanding', coalesce((select sum(balance) from wallets), 0),
        'pending_topups', (select count(*) from topups where status in ('pending', 'verifying'))
      ),
    'usage', jsonb_build_object(
        'messages_total', (select count(*) from messages),
        'messages_today', (select count(*) from messages where created_at >= date_trunc('day', now())),
        'bot_replies_month', coalesce((select sum(replies_count) from usage_monthly where period = current_period()), 0),
        'ai_cost_month_usd', coalesce((select round(sum(cost_usd)::numeric, 4) from ai_usage_logs where created_at >= date_trunc('month', now())), 0),
        'active_conversations_15m', (select count(*) from conversations where last_message_at >= now() - interval '15 minutes')
      ),
    'orders', jsonb_build_object(
        'total', (select count(*) from orders),
        'paid_month', (select count(*) from orders where status in ('paid', 'confirmed', 'shipped', 'completed') and created_at >= date_trunc('month', now())), 
        'gmv_month', coalesce((select sum(total) from orders where status in ('paid', 'confirmed', 'shipped', 'completed') and created_at >= date_trunc('month', now())), 0)
      ),
    'health', jsonb_build_object(
        'webhook_failed_24h', (select count(*) from webhook_events where status = 'failed' and received_at >= now() - interval '24 hours'),
        'client_errors_7d', (select count(*) from audit_logs where action = 'client_error' and created_at >= now() - interval '7 days'),
        'shops_blocked', (select count(*) from shops s
          where s.status = 'active'
            and exists (select 1 from usage_monthly u join plans p on p.code = s.plan
                        where u.shop_id = s.id and u.period = current_period() and u.replies_count >= p.included_replies)
            and coalesce((select balance from wallets w where w.shop_id = s.id), 0) <= 0)
      ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
          'd', to_char(d, 'MM-DD'),
          'users', (select count(*) from auth.users u where u.created_at >= d and u.created_at < d + interval '1 day'),
          'msgs', (select count(*) from messages m where m.created_at >= d and m.created_at < d + interval '1 day')
        ) order by d), '[]'::jsonb)
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d),
    'recent_shops', (select coalesce(jsonb_agg(r.row), '[]'::jsonb) from (
        select jsonb_build_object('name', s.name, 'plan', s.plan, 'created_at', s.created_at,
          'owner_email', (select u.email from shop_members sm join auth.users u on u.id = sm.user_id
                          where sm.shop_id = s.id and sm.role = 'owner' limit 1)) as row
        from shops s order by s.created_at desc limit 8) r),
    'recent_topups', (select coalesce(jsonb_agg(jsonb_build_object(
          'amount', t.amount, 'status', t.status, 'created_at', t.created_at,
          'shop', (select name from shops where id = t.shop_id))), '[]'::jsonb)
      from (select * from topups order by created_at desc limit 8) t)
  ) into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.queue_archive(p_queue text, p_msg_id bigint)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
  select pgmq.archive(p_queue, p_msg_id);
$function$
;

CREATE OR REPLACE FUNCTION public.queue_delete(p_queue text, p_msg_id bigint)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
  select pgmq.delete(p_queue, p_msg_id);
$function$
;

CREATE OR REPLACE FUNCTION public.queue_read(p_queue text, p_vt integer, p_qty integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
  select msg_id, read_ct, message from pgmq.read(p_queue, p_vt, p_qty);
$function$
;

CREATE OR REPLACE FUNCTION public.queue_send(p_queue text, p_msg jsonb)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
  select pgmq.send(p_queue, p_msg);
$function$
;

CREATE OR REPLACE FUNCTION public.rollup_daily_analytics(p_date date DEFAULT (((now() AT TIME ZONE 'Asia/Bangkok'::text))::date - 1))
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into daily_analytics as d (shop_id, date, messages_in, messages_out, conversations_new, customers_new, orders_created, orders_paid, orders_closed_by_bot, revenue, ai_cost_usd, avg_response_ms)
  select s.id, p_date,
    coalesce(m.msgs_in,0), coalesce(m.msgs_out,0),
    coalesce(c.convs,0), coalesce(cu.custs,0),
    coalesce(o.created,0), coalesce(o.paid,0), coalesce(o.bot_closed,0), coalesce(o.revenue,0),
    coalesce(a.cost,0), m.avg_ms
  from shops s
  left join (
    select shop_id,
      count(*) filter (where direction='inbound') as msgs_in,
      count(*) filter (where direction='outbound') as msgs_out,
      (avg(latency_ms) filter (where latency_ms is not null))::int as avg_ms
    from messages where (created_at at time zone 'Asia/Bangkok')::date = p_date group by shop_id
  ) m on m.shop_id = s.id
  left join (
    select shop_id, count(*) as convs from conversations
    where (created_at at time zone 'Asia/Bangkok')::date = p_date group by shop_id
  ) c on c.shop_id = s.id
  left join (
    select shop_id, count(*) as custs from customers
    where (created_at at time zone 'Asia/Bangkok')::date = p_date group by shop_id
  ) cu on cu.shop_id = s.id
  left join (
    select shop_id, count(*) as created,
      count(*) filter (where status in ('paid','confirmed','shipped','completed')) as paid,
      count(*) filter (where closed_by='bot' and status in ('paid','confirmed','shipped','completed')) as bot_closed,
      coalesce(sum(total) filter (where status in ('paid','confirmed','shipped','completed')),0) as revenue
    from orders where (created_at at time zone 'Asia/Bangkok')::date = p_date group by shop_id
  ) o on o.shop_id = s.id
  left join (
    select shop_id, sum(cost_usd) as cost from ai_usage_logs
    where (created_at at time zone 'Asia/Bangkok')::date = p_date group by shop_id
  ) a on a.shop_id = s.id
  on conflict (shop_id, date) do update set
    messages_in = excluded.messages_in,
    messages_out = excluded.messages_out,
    conversations_new = excluded.conversations_new,
    customers_new = excluded.customers_new,
    orders_created = excluded.orders_created,
    orders_paid = excluded.orders_paid,
    orders_closed_by_bot = excluded.orders_closed_by_bot,
    revenue = excluded.revenue,
    ai_cost_usd = excluded.ai_cost_usd,
    avg_response_ms = excluded.avg_response_ms;
end $function$
;

CREATE OR REPLACE FUNCTION public.run_plan_billing()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record; v_bal numeric; charged int := 0; overdue int := 0; downgraded int := 0;
begin
  for r in
    select s.id, s.plan, s.next_bill_at, s.billing_overdue, p.price_monthly, p.name
    from shops s join plans p on p.code = s.plan
    where p.price_monthly > 0 and s.status='active'
      and s.next_bill_at is not null and s.next_bill_at <= (now() at time zone 'Asia/Bangkok')::date
  loop
    select balance into v_bal from wallets where shop_id = r.id for update;
    if coalesce(v_bal,0) >= r.price_monthly then
      -- ตัดเงินสำเร็จ -> เลื่อนรอบบิล +1 เดือน
      perform 1 from wallets where shop_id=r.id;
      update wallets set balance = balance - r.price_monthly, updated_at=now() where shop_id=r.id returning balance into v_bal;
      insert into wallet_transactions (shop_id,type,amount,balance_after,ref_type,note)
        values (r.id,'debit',-r.price_monthly,v_bal,'plan_fee','ค่าสมาชิกแพ็กเกจ '||r.name);
      update shops set next_bill_at = (r.next_bill_at + interval '1 month')::date, billing_overdue=false where id=r.id;
      insert into audit_logs (shop_id,actor_type,action,resource_type,details)
        values (r.id,'system','plan_billed','shops',jsonb_build_object('amount',r.price_monthly,'balance',v_bal));
      charged := charged + 1;
    else
      -- เครดิตไม่พอ: mark overdue; ถ้าค้างเกิน 7 วัน -> ลดเป็น free
      if r.next_bill_at < (now() at time zone 'Asia/Bangkok')::date - 7 then
        update shops set plan='free', billing_overdue=false, next_bill_at=null where id=r.id;
        insert into audit_logs (shop_id,actor_type,action,resource_type,details)
          values (r.id,'system','plan_downgraded_unpaid','shops',jsonb_build_object('from',r.plan));
        downgraded := downgraded + 1;
      else
        update shops set billing_overdue=true where id=r.id;
        overdue := overdue + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('charged',charged,'overdue',overdue,'downgraded',downgraded,'ran_at',now());
end $function$
;

CREATE OR REPLACE FUNCTION public.search_products(p_shop_id uuid, p_query text, p_limit integer DEFAULT 8)
 RETURNS SETOF products
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select p.* from products p
  where p.shop_id = p_shop_id
    and p.status = 'active'
    and (
      p.name ilike '%' || p_query || '%'
      or p.sku ilike '%' || p_query || '%'
      or coalesce(p.description,'') ilike '%' || p_query || '%'
      or similarity(p.name, p_query) > 0.15
    )
  order by similarity(p.name, p_query) desc nulls last, p.updated_at desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.send_platform_email(p_to text, p_subject text, p_html text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'extensions'
AS $function$
declare v_key text; v_from text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'platform_resend_api_key' limit 1;
  if v_key is null or p_to is null then return; end if;
  select coalesce(email_from, 'SudoChatBot <onboarding@resend.dev>') into v_from
    from platform_billing_settings where id = true;
  perform http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('from', v_from, 'to', jsonb_build_array(p_to), 'subject', p_subject, 'html', p_html)
  );
exception when others then null; -- อีเมลล้มเหลวต้องไม่ล้มงานหลัก
end $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION public.shares_shop_with(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from shop_members a
    join shop_members b on a.shop_id = b.shop_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.shop_owner_email(p_shop_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.email from shop_members m join profiles p on p.id = m.user_id
  where m.shop_id = p_shop_id and m.role = 'owner' and p.email is not null
  order by m.created_at limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.store_ad_token(p_ad_account_row_id uuid, p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_name text := 'ad_token_' || p_ad_account_row_id::text;
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = v_name;
  if v_id is not null then
    perform vault.update_secret(v_id, p_token);
  else
    perform vault.create_secret(p_token, v_name);
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_ai_key(p_provider text, p_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_existing uuid; v_new uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if p_provider not in ('anthropic','google','openai','deepseek','qwen','zhipu','moonshot','mistral') then raise exception 'unknown provider'; end if;
  if length(coalesce(p_key,'')) < 10 then raise exception 'key สั้นเกินไป'; end if;
  select secret_id into v_existing from ai_provider_keys where provider = p_provider;
  if v_existing is not null then
    perform vault.update_secret(v_existing, p_key);
    update ai_provider_keys set key_last4 = right(p_key,4), updated_by = (select auth.uid()),
      updated_at = now(), test_status = null, test_message = null, tested_at = null
      where provider = p_provider;
  else
    select vault.create_secret(p_key, 'ai_key_' || p_provider) into v_new;
    insert into ai_provider_keys (provider, secret_id, key_last4, updated_by)
      values (p_provider, v_new, right(p_key,4), (select auth.uid()))
      on conflict (provider) do update set secret_id = excluded.secret_id,
        key_last4 = excluded.key_last4, updated_by = excluded.updated_by, updated_at = now();
  end if;
  insert into audit_logs (actor_type, actor_id, action, resource_type, resource_id, details)
    values ('user', (select auth.uid())::text, 'ai_key_updated', 'ai_provider_keys', p_provider,
      jsonb_build_object('last4', right(p_key,4)));
end $function$
;

CREATE OR REPLACE FUNCTION public.store_channel_token(p_channel_id uuid, p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_existing uuid; v_new uuid;
begin
  select token_secret_id into v_existing from channels where id = p_channel_id;
  if v_existing is not null then
    perform vault.update_secret(v_existing, p_token);
  else
    select vault.create_secret(p_token, 'channel_token_' || p_channel_id::text) into v_new;
    update channels set token_secret_id = v_new where id = p_channel_id;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_platform_omise_key(p_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select id into v_id from vault.secrets where name = 'platform_omise_secret_key';
  if v_id is not null then
    perform vault.update_secret(v_id, p_key);
  else
    perform vault.create_secret(p_key, 'platform_omise_secret_key');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_platform_resend_key(p_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select id into v_id from vault.secrets where name = 'platform_resend_api_key';
  if v_id is not null then perform vault.update_secret(v_id, p_key);
  else perform vault.create_secret(p_key, 'platform_resend_api_key'); end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_platform_slip_key(p_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_existing uuid; v_new uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  select slip_api_secret_id into v_existing from platform_billing_settings where id;
  if v_existing is not null then perform vault.update_secret(v_existing, p_key);
  else
    select vault.create_secret(p_key, 'platform_slip_key') into v_new;
    update platform_billing_settings set slip_api_secret_id = v_new where id;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_shop_slip_key(p_shop_id uuid, p_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_existing uuid; v_new uuid;
begin
  select slip_api_secret_id into v_existing from shop_payment_settings where shop_id = p_shop_id;
  if v_existing is not null then
    perform vault.update_secret(v_existing, p_key);
  else
    select vault.create_secret(p_key, 'slip_key_' || p_shop_id::text) into v_new;
    update shop_payment_settings set slip_api_secret_id = v_new where shop_id = p_shop_id;
  end if;
end $function$
;


-- ============ Indexes (61) ============

CREATE INDEX ad_campaigns_shop_idx ON public.ad_campaigns USING btree (shop_id, created_at DESC);
CREATE INDEX ad_proposals_shop_idx ON public.ad_proposals USING btree (shop_id, created_at DESC);
CREATE INDEX ai_provider_keys_updated_by_idx ON public.ai_provider_keys USING btree (updated_by);
CREATE INDEX ai_settings_updated_by_idx ON public.ai_settings USING btree (updated_by);
CREATE INDEX ai_usage_logs_shop_idx ON public.ai_usage_logs USING btree (shop_id, created_at);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX audit_logs_shop_idx ON public.audit_logs USING btree (shop_id, created_at DESC);
CREATE INDEX channels_connected_by_idx ON public.channels USING btree (connected_by);
CREATE INDEX channels_shop_idx ON public.channels USING btree (shop_id);
CREATE INDEX comment_replies_shop_idx ON public.comment_replies USING btree (shop_id, created_at DESC);
CREATE INDEX conversations_assigned_to_idx ON public.conversations USING btree (assigned_to);
CREATE INDEX conversations_channel_idx ON public.conversations USING btree (channel_id);
CREATE INDEX conversations_customer_idx ON public.conversations USING btree (customer_id);
CREATE UNIQUE INDEX conversations_one_active_per_customer ON public.conversations USING btree (customer_id) WHERE (status <> 'closed'::text);
CREATE INDEX conversations_shop_idx ON public.conversations USING btree (shop_id, last_message_at DESC);
CREATE INDEX customers_shop_idx ON public.customers USING btree (shop_id, last_active_at DESC);
CREATE INDEX feedback_created_at_idx ON public.feedback USING btree (created_at DESC);
CREATE INDEX feedback_shop_id_idx ON public.feedback USING btree (shop_id);
CREATE INDEX feedback_status_idx ON public.feedback USING btree (status, created_at DESC);
CREATE INDEX knowledge_chunks_document_idx ON public.knowledge_chunks USING btree (document_id);
CREATE INDEX knowledge_chunks_embedding_idx ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX knowledge_chunks_shop_idx ON public.knowledge_chunks USING btree (shop_id);
CREATE INDEX knowledge_documents_created_by_idx ON public.knowledge_documents USING btree (created_by);
CREATE INDEX knowledge_documents_shop_idx ON public.knowledge_documents USING btree (shop_id);
CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);
CREATE UNIQUE INDEX messages_platform_dedupe ON public.messages USING btree (platform_message_id) WHERE (platform_message_id IS NOT NULL);
CREATE INDEX messages_shop_idx ON public.messages USING btree (shop_id, created_at DESC);
CREATE INDEX notifications_shop_unread_idx ON public.notifications USING btree (shop_id, read, created_at DESC);
CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX order_items_product_idx ON public.order_items USING btree (product_id);
CREATE INDEX order_items_shop_idx ON public.order_items USING btree (shop_id);
CREATE INDEX order_items_variant_idx ON public.order_items USING btree (variant_id);
CREATE INDEX orders_channel_id_idx ON public.orders USING btree (channel_id);
CREATE INDEX orders_conversation_idx ON public.orders USING btree (conversation_id);
CREATE INDEX orders_customer_idx ON public.orders USING btree (customer_id);
CREATE INDEX orders_shop_created_idx ON public.orders USING btree (shop_id, created_at DESC);
CREATE INDEX orders_shop_status_idx ON public.orders USING btree (shop_id, status);
CREATE INDEX payments_order_idx ON public.payments USING btree (order_id);
CREATE INDEX payments_shop_status_idx ON public.payments USING btree (shop_id, status);
CREATE UNIQUE INDEX payments_slip_ref_dedupe ON public.payments USING btree (slip_trans_ref) WHERE (slip_trans_ref IS NOT NULL);
CREATE INDEX payments_verifier_id_idx ON public.payments USING btree (verifier_id);
CREATE INDEX product_variants_product_idx ON public.product_variants USING btree (product_id);
CREATE INDEX products_embedding_idx ON public.products USING hnsw (embedding vector_cosine_ops);
CREATE INDEX products_name_trgm_idx ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX products_shop_status_idx ON public.products USING btree (shop_id, status);
CREATE INDEX shop_members_invited_by_idx ON public.shop_members USING btree (invited_by);
CREATE INDEX shop_members_user_idx ON public.shop_members USING btree (user_id);
CREATE INDEX shops_owner_idx ON public.shops USING btree (owner_id);
CREATE UNIQUE INDEX topups_charge_id_key ON public.topups USING btree (charge_id) WHERE (charge_id IS NOT NULL);
CREATE INDEX topups_created_by_idx ON public.topups USING btree (created_by);
CREATE UNIQUE INDEX topups_invoice_number_key ON public.topups USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);
CREATE INDEX topups_shop_idx ON public.topups USING btree (shop_id, created_at DESC);
CREATE UNIQUE INDEX topups_slip_ref_dedupe ON public.topups USING btree (slip_trans_ref) WHERE (slip_trans_ref IS NOT NULL);
CREATE INDEX topups_status_idx ON public.topups USING btree (status, created_at);
CREATE INDEX topups_verifier_id_idx ON public.topups USING btree (verifier_id);
CREATE INDEX wallet_transactions_created_by_idx ON public.wallet_transactions USING btree (created_by);
CREATE INDEX wallet_tx_shop_idx ON public.wallet_transactions USING btree (shop_id, created_at DESC);
CREATE INDEX webhook_events_channel_idx ON public.webhook_events USING btree (channel_id);
CREATE INDEX webhook_events_platform_idx ON public.webhook_events USING btree (platform, received_at DESC);
CREATE INDEX webhook_events_shop_idx ON public.webhook_events USING btree (shop_id);
CREATE INDEX webhook_events_status_idx ON public.webhook_events USING btree (status, received_at);

-- ============ Enable RLS (38) ============

alter table public.ad_accounts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_proposals enable row level security;
alter table public.ai_provider_keys enable row level security;
alter table public.ai_settings enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.bot_settings enable row level security;
alter table public.channels enable row level security;
alter table public.comment_replies enable row level security;
alter table public.conversations enable row level security;
alter table public.customers enable row level security;
alter table public.daily_analytics enable row level security;
alter table public.feedback enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.plans enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_billing_settings enable row level security;
alter table public.product_variants enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.shop_counters enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_payment_settings enable row level security;
alter table public.shops enable row level security;
alter table public.topups enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallets enable row level security;
alter table public.webhook_events enable row level security;

-- ============ Policies (95) ============

create policy ad_accounts_admin_write on public.ad_accounts for all to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy ad_accounts_member_read on public.ad_accounts for select to authenticated using (is_shop_member(shop_id));
create policy ad_campaigns_member_read on public.ad_campaigns for select to authenticated using (is_shop_member(shop_id));
create policy ad_proposals_member_read on public.ad_proposals for select to authenticated using (is_shop_member(shop_id));
create policy aikeys_admin_delete on public.ai_provider_keys for delete to authenticated using (is_platform_admin());
create policy aikeys_admin_insert on public.ai_provider_keys for insert to authenticated with check (is_platform_admin());
create policy aikeys_admin_select on public.ai_provider_keys for select to authenticated using (is_platform_admin());
create policy aikeys_admin_update on public.ai_provider_keys for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy aisettings_admin_delete on public.ai_settings for delete to authenticated using (is_platform_admin());
create policy aisettings_admin_insert on public.ai_settings for insert to authenticated with check (is_platform_admin());
create policy aisettings_admin_select on public.ai_settings for select to authenticated using (is_platform_admin());
create policy aisettings_admin_update on public.ai_settings for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy ai_usage_logs_member_select on public.ai_usage_logs for select to authenticated using (is_shop_member(shop_id));
create policy audit_logs_member_select on public.audit_logs for select to authenticated using (is_shop_member(shop_id));
create policy bot_settings_admin_del on public.bot_settings for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy bot_settings_admin_ins on public.bot_settings for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy bot_settings_admin_upd on public.bot_settings for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy bot_settings_member_select on public.bot_settings for select to authenticated using (is_shop_member(shop_id));
create policy channels_admin_del on public.channels for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy channels_admin_ins on public.channels for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy channels_admin_upd on public.channels for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy channels_member_select on public.channels for select to authenticated using (is_shop_member(shop_id));
create policy comment_replies_member_read on public.comment_replies for select to authenticated using (is_shop_member(shop_id));
create policy conversations_agent_del on public.conversations for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy conversations_agent_ins on public.conversations for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy conversations_agent_upd on public.conversations for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy conversations_member_select on public.conversations for select to authenticated using (is_shop_member(shop_id));
create policy customers_agent_del on public.customers for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy customers_agent_ins on public.customers for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy customers_agent_upd on public.customers for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy customers_member_select on public.customers for select to authenticated using (is_shop_member(shop_id));
create policy daily_analytics_member_select on public.daily_analytics for select to authenticated using (is_shop_member(shop_id));
create policy feedback_admin_read on public.feedback for select to authenticated using (is_platform_admin());
create policy feedback_insert on public.feedback for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_shop_member(shop_id)));
create policy knowledge_chunks_admin_del on public.knowledge_chunks for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy knowledge_chunks_admin_ins on public.knowledge_chunks for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy knowledge_chunks_admin_upd on public.knowledge_chunks for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy knowledge_chunks_member_select on public.knowledge_chunks for select to authenticated using (is_shop_member(shop_id));
create policy knowledge_documents_admin_del on public.knowledge_documents for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy knowledge_documents_admin_ins on public.knowledge_documents for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy knowledge_documents_admin_upd on public.knowledge_documents for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy knowledge_documents_member_select on public.knowledge_documents for select to authenticated using (is_shop_member(shop_id));
create policy messages_agent_del on public.messages for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy messages_agent_ins on public.messages for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy messages_agent_upd on public.messages for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy messages_member_select on public.messages for select to authenticated using (is_shop_member(shop_id));
create policy notifications_select on public.notifications for select to authenticated using (is_shop_member(shop_id));
create policy notifications_update on public.notifications for update to authenticated using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));
create policy order_items_agent_del on public.order_items for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy order_items_agent_ins on public.order_items for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy order_items_agent_upd on public.order_items for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy order_items_member_select on public.order_items for select to authenticated using (is_shop_member(shop_id));
create policy orders_agent_del on public.orders for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy orders_agent_ins on public.orders for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy orders_agent_upd on public.orders for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy orders_member_select on public.orders for select to authenticated using (is_shop_member(shop_id));
create policy payments_agent_del on public.payments for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy payments_agent_ins on public.payments for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy payments_agent_upd on public.payments for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text, 'agent'::text]));
create policy payments_member_select on public.payments for select to authenticated using (is_shop_member(shop_id));
create policy plans_read_all on public.plans for select to authenticated using (true);
create policy padmin_delete on public.platform_admins for delete to authenticated using (is_platform_admin());
create policy padmin_insert on public.platform_admins for insert to authenticated with check (is_platform_admin());
create policy padmin_select on public.platform_admins for select to authenticated using (is_platform_admin());
create policy padmin_update on public.platform_admins for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy pbs_read_admin on public.platform_billing_settings for select to authenticated using (is_platform_admin());
create policy product_variants_admin_del on public.product_variants for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy product_variants_admin_ins on public.product_variants for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy product_variants_admin_upd on public.product_variants for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy product_variants_member_select on public.product_variants for select to authenticated using (is_shop_member(shop_id));
create policy products_admin_del on public.products for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy products_admin_ins on public.products for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy products_admin_upd on public.products for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy products_member_select on public.products for select to authenticated using (is_shop_member(shop_id));
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((id = ( SELECT auth.uid() AS uid)));
create policy profiles_select on public.profiles for select to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR shares_shop_with(id)));
create policy profiles_update_own on public.profiles for update to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy shop_counters_member_select on public.shop_counters for select to authenticated using (is_shop_member(shop_id));
create policy shop_members_delete on public.shop_members for delete to authenticated using ((has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]) OR (user_id = ( SELECT auth.uid() AS uid))));
create policy shop_members_insert_admin on public.shop_members for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy shop_members_select on public.shop_members for select to authenticated using (is_shop_member(shop_id));
create policy shop_members_update_admin on public.shop_members for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy shop_payment_settings_admin_del on public.shop_payment_settings for delete to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy shop_payment_settings_admin_ins on public.shop_payment_settings for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy shop_payment_settings_admin_upd on public.shop_payment_settings for update to authenticated using (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy shop_payment_settings_member_select on public.shop_payment_settings for select to authenticated using (is_shop_member(shop_id));
create policy shops_delete_owner on public.shops for delete to authenticated using (has_shop_role(id, ARRAY['owner'::text]));
create policy shops_insert_own on public.shops for insert to authenticated with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy shops_select_member on public.shops for select to authenticated using (is_shop_member(id));
create policy shops_update_admin on public.shops for update to authenticated using (has_shop_role(id, ARRAY['owner'::text, 'admin'::text])) with check (has_shop_role(id, ARRAY['owner'::text, 'admin'::text]));
create policy topups_admin_insert on public.topups for insert to authenticated with check (has_shop_role(shop_id, ARRAY['owner'::text, 'admin'::text]));
create policy topups_member_read on public.topups for select to authenticated using (is_shop_member(shop_id));
create policy usage_member_read on public.usage_monthly for select to authenticated using (is_shop_member(shop_id));
create policy wallet_tx_member_read on public.wallet_transactions for select to authenticated using (is_shop_member(shop_id));
create policy wallets_member_read on public.wallets for select to authenticated using (is_shop_member(shop_id));

-- ============ Triggers (19) ============

CREATE TRIGGER on_shop_created AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION handle_new_shop();
CREATE TRIGGER set_updated_at_bot_settings BEFORE UPDATE ON public.bot_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_channels BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_conversations BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_knowledge_documents BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_product_variants BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_shop_payment_settings BEFORE UPDATE ON public.shop_payment_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_shops BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_topups BEFORE UPDATE ON public.topups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_wallets BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_channel_limit BEFORE INSERT ON public.channels FOR EACH ROW EXECUTE FUNCTION enforce_channel_limit();
CREATE TRIGGER trg_member_limit BEFORE INSERT ON public.shop_members FOR EACH ROW EXECUTE FUNCTION enforce_member_limit();
CREATE TRIGGER trg_on_plan_change BEFORE UPDATE OF plan ON public.shops FOR EACH ROW EXECUTE FUNCTION on_plan_change();
CREATE TRIGGER trg_topup_invoice BEFORE UPDATE OF status ON public.topups FOR EACH ROW EXECUTE FUNCTION on_topup_paid_invoice();

-- ============ pgmq queues (5) ============

select pgmq.create('comment_events');
select pgmq.create('document_processing');
select pgmq.create('incoming_messages');
select pgmq.create('outbound_messages');
select pgmq.create('slip_verification');

-- ============ Storage buckets (4) ============

insert into storage.buckets (id, name, public) values ('knowledge', 'knowledge', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('shop-assets', 'shop-assets', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('slips', 'slips', false) on conflict (id) do nothing;

-- ============ Seed: plans (4) ============

insert into plans (code, name, price_monthly, included_replies, price_per_extra_reply, max_channels, max_members, features, sort, active, rate_limit_per_min, rate_limit_per_day) values ('enterprise', 'องค์กร', 0.00, 0, 0.2500, 999, 999, '["ไม่จำกัดช่องทาง", "ราคาต่อข้อความถูกสุด", "ดูแลเฉพาะทาง", "SLA"]', 3, 't', 30, 3000) on conflict (code) do nothing;
insert into plans (code, name, price_monthly, included_replies, price_per_extra_reply, max_channels, max_members, features, sort, active, rate_limit_per_min, rate_limit_per_day) values ('free', 'ทดลองใช้', 0.00, 100, 0.7900, 1, 2, '["บอทปิดการขายอัตโนมัติ", "1 ช่องทาง", "ตอบฟรี 100 ข้อความ/เดือน"]', 0, 't', 30, 3000) on conflict (code) do nothing;
insert into plans (code, name, price_monthly, included_replies, price_per_extra_reply, max_channels, max_members, features, sort, active, rate_limit_per_min, rate_limit_per_day) values ('pro', 'โปร', 990.00, 5000, 0.3500, 10, 15, '["ทุกอย่างในเริ่มต้น", "10 ช่องทาง", "ตอบฟรี 5,000 ข้อความ/เดือน", "เลือกโมเดล AI ระดับพรีเมียม", "รายงานเชิงลึก"]', 2, 't', 30, 3000) on conflict (code) do nothing;
insert into plans (code, name, price_monthly, included_replies, price_per_extra_reply, max_channels, max_members, features, sort, active, rate_limit_per_min, rate_limit_per_day) values ('starter', 'เริ่มต้น', 390.00, 1500, 0.4900, 3, 5, '["ทุกอย่างในทดลองใช้", "3 ช่องทาง", "ตอบฟรี 1,500 ข้อความ/เดือน", "ตรวจสลิปอัตโนมัติ"]', 1, 't', 30, 3000) on conflict (code) do nothing;
