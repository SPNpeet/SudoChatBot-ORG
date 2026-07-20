-- 034: เพิ่มสถานะให้ feedback เพื่อให้แอดมินไล่ปิดงานได้ (เดิมอ่านได้อย่างเดียว ไม่มี workflow)
alter table feedback add column if not exists status text not null default 'open'
  check (status in ('open','resolved','dismissed'));
create index if not exists feedback_status_idx on feedback (status, created_at desc);

create or replace function public.admin_mark_feedback(p_feedback_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if p_status not in ('open','resolved','dismissed') then
    return jsonb_build_object('ok', false, 'message', 'สถานะไม่ถูกต้อง');
  end if;
  update feedback set status = p_status where id = p_feedback_id;
  if not found then return jsonb_build_object('ok', false, 'message', 'ไม่พบรายการนี้'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.admin_mark_feedback(uuid, text) from public;
grant execute on function public.admin_mark_feedback(uuid, text) to authenticated;
