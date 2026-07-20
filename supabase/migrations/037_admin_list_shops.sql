-- 037: RPC สำหรับหน้าจัดการร้านค้า admin/shops — ค้นหา+แบ่งหน้า พร้อมอีเมลเจ้าของร้าน (ต้อง join auth.users จึงต้องเป็น RPC)
create or replace function public.admin_list_shops(p_search text default null, p_limit int default 30, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
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
end $$;

revoke all on function public.admin_list_shops(text, int, int) from public, anon;
grant execute on function public.admin_list_shops(text, int, int) to authenticated;
