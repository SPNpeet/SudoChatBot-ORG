-- 031: RPC สถิติแพลตฟอร์มสำหรับแดชบอร์ดแอดมิน — เรียกได้เฉพาะ platform admin
create or replace function public.platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select jsonb_build_object(
    'users', (select jsonb_build_object(
        'total', count(*),
        'new_today', count(*) filter (where created_at >= date_trunc('day', now())),
        'new_7d', count(*) filter (where created_at >= now() - interval '7 days'),
        'active_24h', count(*) filter (where last_sign_in_at >= now() - interval '24 hours')
      ) from auth.users),
    'shops', (select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'new_7d', count(*) filter (where created_at >= now() - interval '7 days'),
        'by_plan', (select coalesce(jsonb_object_agg(plan, c), '{}'::jsonb)
                    from (select plan, count(*) c from shops group by plan) t)
      ) from shops),
    'revenue', jsonb_build_object(
        'topups_paid_total', coalesce((select sum(amount) from topups where status = 'paid'), 0),
        'topups_paid_30d', coalesce((select sum(amount) from topups where status = 'paid' and created_at >= now() - interval '30 days'), 0),
        'billed_this_month', coalesce((select sum(billed_amount) from usage_monthly where period = current_period()), 0),
        'credit_outstanding', coalesce((select sum(balance) from wallets), 0),
        'pending_topups', (select count(*) from topups where status in ('pending', 'verifying'))
      ),
    'usage', jsonb_build_object(
        'messages_total', (select count(*) from messages),
        'messages_today', (select count(*) from messages where created_at >= date_trunc('day', now())),
        'bot_replies_month', coalesce((select sum(replies_count) from usage_monthly where period = current_period()), 0),
        'ai_cost_month_usd', coalesce((select round(sum(cost_usd)::numeric, 4) from ai_usage_logs where created_at >= date_trunc('month', now())), 0),
        'active_conversations_15m', (select count(*) from conversations where last_message_at >= now() - interval '15 minutes')
      ),
    'orders', jsonb_build_object(
        'total', (select count(*) from orders),
        'paid_month', (select count(*) from orders where status in ('paid', 'confirmed', 'shipped', 'completed') and created_at >= date_trunc('month', now())),
        'gmv_month', coalesce((select sum(total) from orders where status in ('paid', 'confirmed', 'shipped', 'completed') and created_at >= date_trunc('month', now())), 0)
      ),
    'health', jsonb_build_object(
        'webhook_failed_24h', (select count(*) from webhook_events where status = 'failed' and received_at >= now() - interval '24 hours'),
        'client_errors_7d', (select count(*) from audit_logs where action = 'client_error' and created_at >= now() - interval '7 days'),
        'shops_blocked', (select count(*) from shops s
          where s.status = 'active'
            and exists (select 1 from usage_monthly u join plans p on p.code = s.plan
                        where u.shop_id = s.id and u.period = current_period() and u.replies_count >= p.included_replies)
            and coalesce((select balance from wallets w where w.shop_id = s.id), 0) <= 0)
      ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
          'd', to_char(d, 'MM-DD'),
          'users', (select count(*) from auth.users u where u.created_at >= d and u.created_at < d + interval '1 day'),
          'msgs', (select count(*) from messages m where m.created_at >= d and m.created_at < d + interval '1 day')
        ) order by d), '[]'::jsonb)
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d),
    'recent_shops', (select coalesce(jsonb_agg(r.row), '[]'::jsonb) from (
        select jsonb_build_object('name', s.name, 'plan', s.plan, 'created_at', s.created_at,
          'owner_email', (select u.email from shop_members sm join auth.users u on u.id = sm.user_id
                          where sm.shop_id = s.id and sm.role = 'owner' limit 1)) as row
        from shops s order by s.created_at desc limit 8) r),
    'recent_topups', (select coalesce(jsonb_agg(jsonb_build_object(
          'amount', t.amount, 'status', t.status, 'created_at', t.created_at,
          'shop', (select name from shops where id = t.shop_id))), '[]'::jsonb)
      from (select * from topups order by created_at desc limit 8) t)
  ) into v;
  return v;
end $$;

revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to authenticated, service_role;
