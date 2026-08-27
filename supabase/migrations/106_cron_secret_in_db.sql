-- ============================================================
--  106: งานตามเวลาไม่ต้องรอใครไปตั้ง env อีก
--
--  ⚠️ ทำไมต้องมี (28 ส.ค. 2569)
--  /api/cron/backup กับ /api/cron/weekly-digest เป็น fail-closed ด้วย CRON_SECRET
--  ซึ่งเป็น env ของ Vercel ที่ยังไม่มีใครตั้ง ผลคือทั้งสองเส้นไม่เคยทำงานเลยสักครั้ง
--  ค้างมาหลายสัปดาห์ และไม่มีอะไรทำให้มันเดินได้นอกจากรอเจ้าของว่าง
--
--  migration 100 เจอบทเรียนเดียวกันแล้วเขียนไว้เองว่า
--  "ทางเดียวที่สำรองได้ ไม่ควรผูกกับสิ่งที่คนต้องไปตั้งเอง"
--  ไฟล์นี้เอาบทเรียนนั้นมาใช้กับอีกสองเส้นที่เหลือ
--
--  ⚠️ ไม่ได้ผ่อนด่านความปลอดภัยลงแม้แต่นิดเดียว
--  ยังเป็นความลับร่วมแบบเดิม ยังต้องส่ง Authorization: Bearer <secret> เหมือนเดิม
--  ยังตอบ 503 ถ้าไม่มีความลับทั้งสองทาง ต่างกันแค่ความลับเก็บไว้ใน Vault
--  ซึ่งอ่านได้เฉพาะ service_role แทนที่จะรอคนไปวางใน Vercel
--  ถ้าวันหนึ่งเจ้าของตั้ง env CRON_SECRET ขึ้นมา ฝั่งโค้ดใช้ env ก่อนเสมอ
--  ของเดิมจึงไม่เปลี่ยนพฤติกรรมเลย
--
--  เวลาที่เลือก: สำรอง 03:00 ไทย (20:00 UTC) — ก่อน snapshot ของ migration 100
--  ที่ 04:00 หนึ่งชั่วโมง จะได้ไม่ชนกัน · สรุปรายสัปดาห์ จันทร์ 08:00 ไทย (01:00 UTC)
-- ============================================================

-- ---------- เก็บ/อ่านความลับ ----------
create or replace function public.store_cron_secret(p_key text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from vault.secrets where name = 'platform_cron_secret';
  if p_key is not null and length(trim(p_key)) > 0 then
    perform vault.create_secret(trim(p_key), 'platform_cron_secret');
  end if;
end;
$$;
revoke execute on function public.store_cron_secret(text) from anon, authenticated, public;
grant execute on function public.store_cron_secret(text) to service_role;

create or replace function public.get_cron_secret()
returns text
language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'platform_cron_secret' limit 1;
$$;
revoke execute on function public.get_cron_secret() from anon, authenticated, public;
grant execute on function public.get_cron_secret() to service_role;

-- ---------- ตัวเรียกงานตามเวลา ----------
-- อ่านความลับจาก Vault แล้วยิงไปที่ endpoint ของเว็บด้วย pg_net
-- ไม่ฝังความลับไว้ในตัวงาน cron เพราะ cron.job อ่านได้ง่ายกว่า Vault มาก
create or replace function public.run_cron_endpoint(p_path text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_secret text := public.get_cron_secret();
  v_id bigint;
begin
  if v_secret is null then
    raise notice 'ยังไม่มี platform_cron_secret ใน Vault — ข้ามงานนี้';
    return null;
  end if;
  select net.http_get(
    url := 'https://sudochatbot.online' || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  ) into v_id;
  return v_id;
end;
$$;
revoke execute on function public.run_cron_endpoint(text) from anon, authenticated, public;
grant execute on function public.run_cron_endpoint(text) to service_role;

-- ---------- ตั้งเวลา ----------
select cron.unschedule('daily_offsite_backup') where exists (select 1 from cron.job where jobname = 'daily_offsite_backup');
select cron.unschedule('weekly_digest') where exists (select 1 from cron.job where jobname = 'weekly_digest');

select cron.schedule('daily_offsite_backup', '0 20 * * *', $CRON$ select public.run_cron_endpoint('/api/cron/backup'); $CRON$);
select cron.schedule('weekly_digest', '0 1 * * 1', $CRON$ select public.run_cron_endpoint('/api/cron/weekly-digest'); $CRON$);
