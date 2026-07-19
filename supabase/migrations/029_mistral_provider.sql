-- 029: เพิ่มค่าย Mistral (OCR + Chat) — idempotent รันซ้ำได้
-- 1) ปลด check constraint เดิมแล้วสร้างใหม่รวม 'mistral'
alter table ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table ai_provider_keys add constraint ai_provider_keys_provider_check
  check (provider = any (array['anthropic','google','openai','deepseek','qwen','zhipu','moonshot','mistral']));

alter table ai_settings drop constraint if exists ai_settings_provider_check;
alter table ai_settings add constraint ai_settings_provider_check
  check (provider = any (array['anthropic','google','openai','deepseek','qwen','zhipu','moonshot','mistral']));

-- 2) ขยาย whitelist ใน store_ai_key (SECURITY DEFINER — โครงเดิมทุกอย่าง เพิ่มแค่ 'mistral')
create or replace function public.store_ai_key(p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
end $function$;
