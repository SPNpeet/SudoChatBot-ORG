-- ============================================================
--  074 — RPC "ใครใช้งานอยู่ตอนนี้ / ใครเล่นวันนี้บ้าง" (คำขอเจ้าของ 4 ส.ค. 2569)
--
--  เดิมแดชบอร์ดแพลตฟอร์มบอกแค่ตัวเลขรวม "0 คน · 3 กิจการ · ล็อกอินใหม่ 2"
--  เจ้าของตอบไม่ได้ว่าใครคือคนเหล่านั้น จึงตามผู้ใช้จริงไม่ได้
--  (โทรถามคนที่สมัครแล้วเงียบไม่ได้ เพราะไม่รู้ว่าเป็นใคร)
--
--  ⚠️ นับจาก audit_logs ไม่ใช่ last_sign_in_at
--  last_sign_in_at อัปเดตเฉพาะตอนล็อกอินใหม่ ไม่อัปเดตตอน refresh token
--  คนใช้ทั้งวันแต่ไม่ล็อกอินใหม่จะไม่ถูกนับ (วัดจริง 3 ส.ค.: ทำงานจริง 5 คน แต่เดิมโชว์ 3)
--
--  ⚠️ PDPA: คืนอีเมลเฉพาะผู้ดูแลแพลตฟอร์ม (is_platform_admin) ซึ่งเข้าฐานข้อมูลได้อยู่แล้ว
--  ไม่ใช่ผู้ดูแล = คืนศูนย์แถว (fail-closed) และ revoke จาก anon
-- ============================================================
create or replace function public.platform_active_users(p_hours int default 24)
returns table (
  user_id uuid,
  email text,
  shop_name text,
  actions bigint,
  last_action_at timestamptz,
  minutes_ago numeric,
  is_online boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_hours int := greatest(1, least(coalesce(p_hours, 24), 168));
begin
  if not coalesce(public.is_platform_admin(), false) then
    return;
  end if;

  return query
  select
    a.actor_id::uuid,
    u.email::text,
    (array_agg(s.name order by a.created_at desc) filter (where s.name is not null))[1],
    count(*),
    max(a.created_at),
    round(extract(epoch from (now() - max(a.created_at))) / 60.0, 1),
    (now() - max(a.created_at)) < interval '15 minutes'
  from audit_logs a
  left join shops s on s.id = a.shop_id
  left join auth.users u on u.id = a.actor_id::uuid
  where a.created_at > now() - make_interval(hours => v_hours)
    and a.actor_id is not null
    and a.actor_type = 'user'
  group by a.actor_id, u.email
  order by max(a.created_at) desc
  limit 100;
end;
$fn$;

revoke all on function public.platform_active_users(int) from public, anon;
grant execute on function public.platform_active_users(int) to authenticated, service_role;
