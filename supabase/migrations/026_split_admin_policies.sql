-- ============================================================
--  026 — แยก policy 'for all' เป็นราย insert/update/delete
--  แก้ advisor WARN multiple_permissive_policies (SELECT ถูกเช็ค 2 policy ซ้อน)
--  สิทธิ์เท่าเดิมทุกประการ: platform admin เท่านั้น
-- ============================================================

-- ai_provider_keys
drop policy if exists aikeys_admin_write on public.ai_provider_keys;
create policy aikeys_admin_insert on public.ai_provider_keys for insert to authenticated with check (is_platform_admin());
create policy aikeys_admin_update on public.ai_provider_keys for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy aikeys_admin_delete on public.ai_provider_keys for delete to authenticated using (is_platform_admin());

-- ai_settings
drop policy if exists aisettings_admin_write on public.ai_settings;
create policy aisettings_admin_insert on public.ai_settings for insert to authenticated with check (is_platform_admin());
create policy aisettings_admin_update on public.ai_settings for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy aisettings_admin_delete on public.ai_settings for delete to authenticated using (is_platform_admin());

-- platform_admins
drop policy if exists padmin_write on public.platform_admins;
create policy padmin_insert on public.platform_admins for insert to authenticated with check (is_platform_admin());
create policy padmin_update on public.platform_admins for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy padmin_delete on public.platform_admins for delete to authenticated using (is_platform_admin());
