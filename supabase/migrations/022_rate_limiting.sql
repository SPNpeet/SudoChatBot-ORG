-- ============================================================
--  022 — Rate limiting ต่อร้าน (กัน abuse เมื่อ scale)
--  จำกัดจำนวนครั้งที่บอทตอบ ต่อร้าน ต่อนาที/ต่อวัน ตามแพ็กเกจ
-- ============================================================

alter table public.plans add column if not exists rate_limit_per_min int not null default 30;
alter table public.plans add column if not exists rate_limit_per_day int not null default 3000;

create table if not exists public.rate_limit_counters (
  shop_id uuid not null references public.shops(id) on delete cascade,
  bucket timestamptz not null,   -- date_trunc นาที หรือ วัน
  granularity text not null,     -- 'minute' | 'day'
  n int not null default 0,
  primary key (shop_id, granularity, bucket)
);
alter table public.rate_limit_counters enable row level security; -- deny-all: ใช้ผ่าน function เท่านั้น

-- true = ยังอยู่ในลิมิต (และนับ 1 ครั้ง) · false = เกินลิมิต ให้ข้ามการตอบ
create or replace function public.check_shop_rate_limit(p_shop_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_min int; v_day int; v_lim_min int := 30; v_lim_day int := 3000;
begin
  select p.rate_limit_per_min, p.rate_limit_per_day into v_lim_min, v_lim_day
    from shops s join plans p on p.code = s.plan where s.id = p_shop_id;
  v_lim_min := coalesce(v_lim_min, 30); v_lim_day := coalesce(v_lim_day, 3000);

  insert into rate_limit_counters (shop_id, granularity, bucket, n)
    values (p_shop_id, 'minute', date_trunc('minute', now()), 1)
    on conflict (shop_id, granularity, bucket) do update set n = rate_limit_counters.n + 1
    returning n into v_min;
  insert into rate_limit_counters (shop_id, granularity, bucket, n)
    values (p_shop_id, 'day', date_trunc('day', now() at time zone 'Asia/Bangkok'), 1)
    on conflict (shop_id, granularity, bucket) do update set n = rate_limit_counters.n + 1
    returning n into v_day;

  if v_min > v_lim_min or v_day > v_lim_day then
    -- บันทึก audit ครั้งแรกของนาทีที่เกิน (กัน log ท่วม)
    if v_min = v_lim_min + 1 or v_day = v_lim_day + 1 then
      insert into audit_logs (shop_id, actor_type, action, resource_type, details)
        values (p_shop_id, 'system', 'rate_limit_exceeded', 'shops',
                jsonb_build_object('per_min', v_min, 'lim_min', v_lim_min, 'per_day', v_day, 'lim_day', v_lim_day));
    end if;
    return false;
  end if;
  return true;
end $$;
revoke execute on function public.check_shop_rate_limit(uuid) from anon, authenticated, public;
grant execute on function public.check_shop_rate_limit(uuid) to service_role;

-- ล้าง counter เก่า ทุกวัน 02:00 ไทย (19:00 UTC)
select cron.schedule('cleanup_rate_limit_counters', '0 19 * * *', $CRON$
  delete from public.rate_limit_counters
  where (granularity = 'minute' and bucket < now() - interval '2 hours')
     or (granularity = 'day' and bucket < now() - interval '3 days');
$CRON$);
