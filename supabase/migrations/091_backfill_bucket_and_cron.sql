-- 091: เก็บของสองอย่างสุดท้ายที่มีบน production แต่ไม่มีใน repo (5 ส.ค. 2569)
--
-- ตรวจแบบเทียบทีละชิ้นแล้ว (ไม่ใช่เดา): ตาราง 71/71 · ฟังก์ชัน 83/83 มี DDL ใน repo ครบแล้ว
-- เหลือ 2 อย่างนี้ที่ยังขาด
--
-- (1) bucket db-backups — ผมสร้างผ่าน SQL Editor ตอนทำระบบสำรองอัตโนมัติ แล้วลืมเขียนเป็น migration
--     ถ้าไม่มี: cron สำรองข้อมูลรายวันจะอัปโหลดล้มทุกวัน และรู้ตัวก็ตอนที่ต้องกู้ข้อมูลจริง
--     ซึ่งเป็นวินาทีที่แย่ที่สุดที่จะรู้ว่าไม่เคยมีไฟล์สำรองเลย
--     ⚠️ ต้อง private เสมอ — ข้างในคือข้อมูลทั้งฐานของลูกค้าทุกราย path เดาได้จากชื่อตาราง
--     ที่อยู่ใน src/lib/backup-tables.mjs ซึ่งอยู่ใน repo สาธารณะ
insert into storage.buckets (id, name, public)
values ('db-backups', 'db-backups', false)
on conflict (id) do nothing;

-- (2) cron สรุปสถิติรายวัน — ตัวเดียวใน 10 ตัวที่ไม่มีในไฟล์ไหนเลย
--     ถ้าไม่มี: daily_analytics ไม่ถูกสรุป -> กราฟ/สถิติบนแดชบอร์ดแอดมินว่างเปล่าโดยไม่มี error
--     17:15 UTC = 00:15 เวลาไทย (สรุปของเมื่อวานหลังเที่ยงคืน)
select cron.schedule('rollup_daily_analytics_nightly', '15 17 * * *', 'select public.rollup_daily_analytics();')
where not exists (select 1 from cron.job where jobname = 'rollup_daily_analytics_nightly');
