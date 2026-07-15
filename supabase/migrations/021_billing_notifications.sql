-- ============================================================
--  021 — แจ้งเตือนเครดิตใกล้หมด + อีเมลแจ้งเมื่อบอทหยุดเพราะเครดิตหมด
--  อีเมลส่งผ่าน Resend API (key อยู่ Vault) ด้วย pg_net · ไม่มี key = ข้ามอีเมล เหลือแจ้งใน dashboard
-- ============================================================

-- ==== notifications: แจ้งเตือนใน dashboard ====
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  type text not null,               -- low_credit | bot_blocked | ...
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_shop_unread_idx on public.notifications (shop_id, read, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (public.is_shop_member(shop_id));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
-- insert/delete: service_role เท่านั้น (ไม่มี policy = client ทำไม่ได้)

-- ==== ตั้งค่าแพลตฟอร์ม ====
alter table public.platform_billing_settings add column if not exists low_credit_threshold numeric not null default 50;
alter table public.platform_billing_settings add column if not exists email_from text;

-- ==== Vault: Resend API key ====
create or replace function public.store_platform_resend_key(p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select id into v_id from vault.secrets where name = 'platform_resend_api_key';
  if v_id is not null then perform vault.update_secret(v_id, p_key);
  else perform vault.create_secret(p_key, 'platform_resend_api_key'); end if;
end $$;
revoke execute on function public.store_platform_resend_key(text) from anon, public;
grant execute on function public.store_platform_resend_key(text) to authenticated, service_role;

-- ==== ส่งอีเมลผ่าน Resend (fire-and-forget ด้วย pg_net) ====
-- search_path มี net + extensions เผื่อย้าย pg_net ออกจาก public (migration 022)
create or replace function public.send_platform_email(p_to text, p_subject text, p_html text) returns void
language plpgsql security definer set search_path = public, net, extensions as $$
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
end $$;
revoke execute on function public.send_platform_email(text, text, text) from anon, authenticated, public;
grant execute on function public.send_platform_email(text, text, text) to service_role;

-- อีเมลเจ้าของร้าน
create or replace function public.shop_owner_email(p_shop_id uuid) returns text
language sql security definer set search_path = public as $$
  select p.email from shop_members m join profiles p on p.id = m.user_id
  where m.shop_id = p_shop_id and m.role = 'owner' and p.email is not null
  order by m.created_at limit 1;
$$;
revoke execute on function public.shop_owner_email(uuid) from anon, authenticated, public;
grant execute on function public.shop_owner_email(uuid) to service_role;

-- ==== แจ้งเมื่อบอทถูกบล็อกเพราะเครดิต/โควตาหมด (เรียกจาก queue-worker) ====
create or replace function public.notify_bot_blocked(p_shop_id uuid) returns void
language plpgsql security definer set search_path = public as $$
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
end $$;
revoke execute on function public.notify_bot_blocked(uuid) from anon, authenticated, public;
grant execute on function public.notify_bot_blocked(uuid) to service_role;

-- ==== cron: เตือนเครดิตใกล้หมด (ยังไม่หมด แต่ต่ำกว่า threshold) ====
create or replace function public.notify_low_credit() returns jsonb
language plpgsql security definer set search_path = public as $$
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
end $$;
revoke execute on function public.notify_low_credit() from anon, authenticated, public;
grant execute on function public.notify_low_credit() to service_role;

select cron.schedule('notify_low_credit_hourly', '15 * * * *', $CRON$ select public.notify_low_credit(); $CRON$);
