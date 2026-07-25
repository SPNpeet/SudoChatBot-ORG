-- 067: ตัวนับ rate limit กลาง ใช้กับ endpoint สาธารณะ (สมัครสมาชิก ฯลฯ)
-- เก็บเฉพาะ HMAC ของ IP ไม่เก็บ IP ดิบ (PDPA) · atomic ใน RPC เดียว กันยิงพร้อมกัน
create table if not exists public_rate_counters (
  bucket_key text not null,
  ip_hash text not null,
  window_start timestamptz not null,
  n int not null default 1,
  primary key (bucket_key, ip_hash, window_start)
);
alter table public_rate_counters enable row level security;

create or replace function public.consume_public_rate(
  p_bucket text, p_ip_hash text, p_limit int, p_window_secs int default 3600
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(1, p_window_secs)) * greatest(1, p_window_secs));
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || p_ip_hash));
  insert into public_rate_counters (bucket_key, ip_hash, window_start, n)
    values (p_bucket, p_ip_hash, v_start, 1)
    on conflict (bucket_key, ip_hash, window_start) do update set n = public_rate_counters.n + 1
    returning n into v_n;
  return jsonb_build_object('allowed', v_n <= greatest(1, p_limit), 'used', v_n, 'limit', p_limit);
end $$;

revoke all on function public.consume_public_rate(text, text, int, int) from public, anon, authenticated;
grant execute on function public.consume_public_rate(text, text, int, int) to service_role;

select cron.schedule('cleanup_public_rate', '0 19 * * *',
  $$ delete from public.public_rate_counters where window_start < now() - interval '2 days'; $$);
