-- ============================================================
--  100: จุดกู้คืนรายวันในฐานข้อมูลเอง (ไม่พึ่ง env ของ Vercel)
--
--  ⚠️ ทำไมต้องมี (ตรวจพบ 11 ส.ค. 2569):
--  ระบบสำรองข้อมูลลง Storage มีอยู่แล้วและเขียนไว้ดี แต่ **ไม่เคยทำงานเลยสักครั้ง**
--  เพราะ /api/cron/backup เป็น fail-closed ด้วย CRON_SECRET ซึ่งยังไม่ได้ตั้งใน Vercel
--  วัดจริงตอนตรวจ: bucket db-backups = 0 ไฟล์ ทั้งที่มีกิจการใช้งานจริงหลายสิบราย
--  และ Supabase แพ็กฟรีไม่มี backup/PITR ให้เลย = ข้อมูลบัญชีลูกค้าไม่มีชั้นสำรองใด ๆ
--
--  บทเรียนเชิงโครงสร้าง: "ทางเดียวที่สำรองได้" ไม่ควรผูกกับสิ่งที่คนต้องไปตั้งเอง
--  ชั้นนี้อยู่ในฐานข้อมูลล้วน ๆ จึงทำงานได้ทันทีโดยไม่ต้องรอใคร
--
--  ครอบคลุมอะไร: migration พลาด · ลบผิด · ตารางเสีย · ข้อมูลถูกเขียนทับ
--  ไม่ครอบคลุมอะไร: ทั้งโปรเจกต์หาย (snapshot อยู่ฐานเดียวกัน)
--    -> ของแท้ยังต้องเป็น `npm run backup` ออกนอกเครื่อง + Supabase Pro (PITR)
--    ชั้นนี้คือ "มีดีกว่าไม่มี" ที่ทำงานเองได้ ไม่ใช่ตัวแทนของสองอย่างนั้น
--
--  ขนาดจริงที่วัดได้: 1 snapshot = ~1.5 MB · เก็บ 7 วัน = ~10 MB
--  (ฐานข้อมูลตอนนี้ 65 MB จากเพดานแพ็กฟรี 500 MB — ปลอดภัย)
-- ============================================================

create or replace function public.create_db_snapshot(p_keep_days int default 7)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sch text := 'snapshot_' || to_char(now() at time zone 'Asia/Bangkok', 'YYYY_MM_DD');
  v_cut text := 'snapshot_' || to_char((now() at time zone 'Asia/Bangkok') - make_interval(days => p_keep_days), 'YYYY_MM_DD');
  r record;
  v_tables int := 0;
begin
  execute format('drop schema if exists %I cascade', v_sch);   -- รันซ้ำวันเดียวกัน = เขียนทับของเดิม
  execute format('create schema %I', v_sch);

  for r in
    select tablename from pg_tables
    where schemaname = 'public'
      -- คีย์ขอออกใหม่ได้เสมอ แต่รั่วแล้วเสียหายทันที (กติกาเดียวกับ SECRET_TABLES ใน backup-tables.mjs)
      and tablename not in ('ai_provider_keys', 'ai_purpose_keys')
    order by tablename
  loop
    execute format('create table %I.%I as select * from public.%I', v_sch, r.tablename, r.tablename);
    v_tables := v_tables + 1;
  end loop;

  -- ห้ามให้ client แตะเด็ดขาด — snapshot ไม่มี RLS จึงต้องปิดที่ระดับสิทธิ์แทน
  -- (schema นอก public ไม่ถูก PostgREST เปิดอยู่แล้ว นี่คือชั้นที่สอง)
  execute format('revoke all on schema %I from anon, authenticated, public', v_sch);
  execute format('revoke all on all tables in schema %I from anon, authenticated, public', v_sch);

  -- ลบ snapshot ที่เก่ากว่ากำหนด (เทียบด้วยชื่อได้เพราะรูปแบบวันที่เรียงตามตัวอักษรได้)
  for r in
    select nspname from pg_namespace
    where nspname like 'snapshot\_%' and nspname < v_cut
  loop
    execute format('drop schema if exists %I cascade', r.nspname);
  end loop;

  return jsonb_build_object('schema', v_sch, 'tables', v_tables, 'created_at', now());
end $$;

-- service_role เท่านั้น — ผู้ใช้ที่ล็อกอินไม่มีเหตุต้องเรียกฟังก์ชันที่สร้าง schema ได้
revoke execute on function public.create_db_snapshot(int) from anon, authenticated, public;
grant execute on function public.create_db_snapshot(int) to service_role;

-- ทุกวัน 04:00 เวลาไทย (21:00 UTC) — เลี่ยงชนกับงานล้างข้อมูลที่กระจุกช่วง 19:00-20:00 UTC
select cron.schedule('daily_db_snapshot', '0 21 * * *', $CRON$ select public.create_db_snapshot(7); $CRON$);

-- สถานะ snapshot สำหรับการ์ดในหน้าแอดมิน (อ่านอย่างเดียว ไม่เปิดเผยข้อมูลในนั้น)
create or replace function public.snapshot_status()
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'latest', (select max(nspname) from pg_namespace where nspname like 'snapshot\_%'),
    'count',  (select count(*) from pg_namespace where nspname like 'snapshot\_%'),
    'tables', (select count(*) from pg_tables
               where schemaname = (select max(nspname) from pg_namespace where nspname like 'snapshot\_%'))
  );
$$;
revoke execute on function public.snapshot_status() from anon, authenticated, public;
grant execute on function public.snapshot_status() to service_role;
