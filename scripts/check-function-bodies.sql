-- ============================================================
--  ตรวจว่าไม่มีฟังก์ชันของเราตัวไหน body อ้างถึงของที่ถูกลบไปแล้ว
--
--  ⚠️ ทำไมต้องมี (เกิดจริง 6 ส.ค. 2569)
--  migration 093 ลบคอลัมน์ payment_gateway ทิ้ง แต่ platform_billing_public()
--  ยัง select คอลัมน์นั้นอยู่ใน body — Postgres ไม่ผูก dependency กับ body
--  ของฟังก์ชัน LANGUAGE sql (ผูกเฉพาะแบบ BEGIN ATOMIC) จึง drop ผ่านฉลุย
--  ฟังก์ชันเลยพัง "ตอนมีคนเรียก" ไม่ใช่ตอนถูกทำให้พัง
--  = ไม่มีใครรู้จนกว่าลูกค้าจะเป็นคนเจอ ซึ่งเป็นบั๊กที่แพงที่สุดแบบหนึ่ง
--
--  วิธีตรวจ: สั่งสร้างฟังก์ชันทุกตัวใหม่จากนิยามเดิม (CREATE OR REPLACE)
--  Postgres จะ parse body ตอนสร้าง ตัวไหนอ้างของที่ไม่มีแล้วจะ error ทันที
--
--  ⚠️ ต้องกรองเอา "ฟังก์ชันของ extension" ออก (pg_trgm, vector, pgcrypto ฯลฯ)
--  พวกนั้นเขียนด้วยภาษา C สร้างใหม่ไม่ได้ และไม่ใช่ของเรา
--  รอบแรกที่เขียนด่านนี้ไม่ได้กรอง เลยได้ผลบวกปลอม 145 ตัว — ด่านที่ดังเกินจริง
--  คือด่านที่คนจะเลิกอ่านแล้วกลายเป็นไร้ประโยชน์
-- ============================================================
do $chk$
declare r record; n int := 0; bad int := 0;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where ns.nspname = 'public'
      and p.prokind = 'f'
      and l.lanname in ('sql', 'plpgsql')
      -- ไม่ใช่ของ extension
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e'
      )
  loop
    n := n + 1;
    begin
      execute r.def;
    exception when others then
      bad := bad + 1;
      raise warning 'body พัง: %() -> %', r.proname, sqlerrm;
    end;
  end loop;
  raise notice '    ฟังก์ชันของเรา % ตัว · body อ้างของที่ไม่มีแล้ว % ตัว', n, bad;
  if bad > 0 then
    raise exception 'มีฟังก์ชัน body พัง % ตัว — ดู WARNING ด้านบน', bad;
  end if;
end $chk$;
