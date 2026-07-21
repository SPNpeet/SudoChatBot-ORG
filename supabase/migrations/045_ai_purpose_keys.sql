-- 045: แยกคีย์ AI ตามงาน — 'assistant' (ผู้จัดการร้าน AI) / 'chat' (บอทตอบลูกค้า)
-- เหตุผล: กันโควตา/rate limit ชนกัน (assistant ใช้หนักต้องไม่เบียดบอทตอบลูกค้า)
-- + เลือกค่าย/โมเดลต่างกันได้ (assistant ใช้โมเดลฉลาด บอทลูกค้าใช้ตัวเร็ว/ถูก)
-- ไม่ตั้ง = fallback ไปคีย์รวม (ai_provider_keys) เหมือนเดิม — opt-in ล้วนๆ

create table if not exists ai_purpose_keys (
  purpose text primary key check (purpose in ('assistant','chat')),
  provider text not null check (provider in ('anthropic','google','openai','deepseek','qwen','zhipu','moonshot','mistral')),
  model text,               -- null = ใช้โมเดลเริ่มต้นของค่าย
  secret_id uuid not null,  -- vault
  key_last4 text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table ai_purpose_keys enable row level security; -- ไม่มี policy = service role เท่านั้น (ตั้งใจ)

create or replace function public.store_purpose_ai_key(p_purpose text, p_provider text, p_model text, p_key text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_existing uuid; v_new uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if p_purpose not in ('assistant','chat') then raise exception 'unknown purpose'; end if;
  if p_provider not in ('anthropic','google','openai','deepseek','qwen','zhipu','moonshot','mistral') then raise exception 'unknown provider'; end if;
  if length(coalesce(p_key,'')) < 10 then raise exception 'key สั้นเกินไป'; end if;
  select secret_id into v_existing from ai_purpose_keys where purpose = p_purpose;
  if v_existing is not null then
    perform vault.update_secret(v_existing, p_key);
    update ai_purpose_keys set provider = p_provider, model = nullif(trim(coalesce(p_model,'')),''),
      key_last4 = right(p_key,4), updated_by = (select auth.uid()), updated_at = now()
      where purpose = p_purpose;
  else
    select vault.create_secret(p_key, 'ai_key_purpose_' || p_purpose) into v_new;
    insert into ai_purpose_keys (purpose, provider, model, secret_id, key_last4, updated_by)
      values (p_purpose, p_provider, nullif(trim(coalesce(p_model,'')),''), v_new, right(p_key,4), (select auth.uid()));
  end if;
  insert into audit_logs (actor_type, actor_id, action, resource_type, resource_id, details)
    values ('user', (select auth.uid())::text, 'ai_purpose_key_updated', 'ai_purpose_keys', p_purpose,
      jsonb_build_object('provider', p_provider, 'last4', right(p_key,4)));
end $$;

create or replace function public.delete_purpose_ai_key(p_purpose text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_secret uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select secret_id into v_secret from ai_purpose_keys where purpose = p_purpose;
  delete from ai_purpose_keys where purpose = p_purpose;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
  insert into audit_logs (actor_type, actor_id, action, resource_type, resource_id)
    values ('user', (select auth.uid())::text, 'ai_purpose_key_deleted', 'ai_purpose_keys', p_purpose);
end $$;

create or replace function public.get_purpose_ai_key(p_purpose text)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select jsonb_build_object('provider', k.provider, 'model', k.model, 'key', ds.decrypted_secret)
  from ai_purpose_keys k join vault.decrypted_secrets ds on ds.id = k.secret_id
  where k.purpose = p_purpose;
$$;

-- get = ความลับจริง service role เท่านั้น · store/delete เช็ค admin ภายในแต่ต้องเรียกด้วย JWT ผู้ใช้
revoke all on function public.get_purpose_ai_key(text) from public, anon, authenticated;
grant execute on function public.get_purpose_ai_key(text) to service_role;
revoke all on function public.store_purpose_ai_key(text, text, text, text) from public, anon;
revoke all on function public.delete_purpose_ai_key(text) from public, anon;
grant execute on function public.store_purpose_ai_key(text, text, text, text) to authenticated;
grant execute on function public.delete_purpose_ai_key(text) to authenticated;
