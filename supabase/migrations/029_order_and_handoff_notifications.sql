-- ============================================================
-- 029: แจ้งเตือนเจ้าของร้าน — บอทปิดออเดอร์ได้ (เงินเข้า) + ลูกค้าขอคุยกับคน
-- (apply บน Supabase แล้ว 2026-07-19 ผ่าน MCP) — pattern เดียวกับ 021
-- ============================================================
create or replace function public.notify_order_paid(p_shop_id uuid, p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_num text; v_total numeric;
begin
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
end $$;
revoke execute on function public.notify_order_paid(uuid, uuid) from anon, authenticated, public;
grant execute on function public.notify_order_paid(uuid, uuid) to service_role;

create or replace function public.notify_handoff(p_shop_id uuid, p_conversation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_customer text;
begin
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
end $$;
revoke execute on function public.notify_handoff(uuid, uuid) from anon, authenticated, public;
grant execute on function public.notify_handoff(uuid, uuid) to service_role;
