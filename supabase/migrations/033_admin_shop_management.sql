-- 033: จัดการร้านค้าจากฝั่งแอดมินแพลตฟอร์ม — ระงับ/ปิดร้าน (เช่น โกงลูกค้า/ค้างชำระ), เปลี่ยนแพ็กแบบ manual (เคสพิเศษ/ผิดพลาด)
create or replace function public.admin_set_shop_status(p_shop_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
end $$;

revoke all on function public.admin_set_shop_status(uuid, text) from public;
grant execute on function public.admin_set_shop_status(uuid, text) to authenticated;

create or replace function public.admin_set_shop_plan(p_shop_id uuid, p_plan text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
end $$;

revoke all on function public.admin_set_shop_plan(uuid, text) from public;
grant execute on function public.admin_set_shop_plan(uuid, text) to authenticated;
