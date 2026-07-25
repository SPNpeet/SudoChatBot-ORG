-- 064: เชื่อม LINE ด้วยการล็อกอินคลิกเดียว ผ่าน OA กลางของแพลตฟอร์ม
alter table platform_billing_settings
  add column if not exists line_login_channel_id text,
  add column if not exists line_login_channel_secret text,
  add column if not exists line_oa_token text,
  add column if not exists line_oa_basic_id text;

alter table shop_notify_settings
  add column if not exists link_source text not null default 'own',
  add column if not exists line_display_name text,
  add column if not exists linked_at timestamptz;

do $$ begin
  alter table shop_notify_settings add constraint shop_notify_link_source_chk
    check (link_source in ('platform','own'));
exception when duplicate_object then null; end $$;
