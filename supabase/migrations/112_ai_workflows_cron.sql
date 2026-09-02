-- 112: ตั้งเวลา AI Auto Workflow ผ่านตัวเรียกงานเดิมของ migration 106 (pg_cron + Vault + pg_net)
--
-- ⚠️ บทเรียน 3 ก.ย. 2569: curl /api/cron/* แบบไม่มี secret แล้วเห็น 503 = ปกติ (fail-closed)
-- ไม่ได้แปลว่า cron ตาย — ตัวยิงจริงคือ run_cron_endpoint ในฐานข้อมูลซึ่งอ่าน secret จาก Vault
-- (พิสูจน์: daily_offsite_backup ยิง 1 ก.ย. 20:00 UTC ได้ 200 {"ok":true}) จึงไม่ต้องรอ Vercel env
-- เวลา 02:30 UTC = 09:30 ไทย หลังร้านเปิด ก่อนคนเปิดแดชบอร์ดส่วนใหญ่ (จุดชนวนฝั่งหน้าเว็บยังทำงานคู่กัน)
select cron.unschedule('ai_workflows_daily') where exists (select 1 from cron.job where jobname = 'ai_workflows_daily');
select cron.schedule('ai_workflows_daily', '30 2 * * *', $CRON$ select public.run_cron_endpoint('/api/cron/workflows'); $CRON$);

-- rollback: select cron.unschedule('ai_workflows_daily');
