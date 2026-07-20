-- 042: cron เฝ้างบโฆษณาทุก 30 นาที (ads-watchdog: spend เกินเพดานรวม -> auto-pause + แจ้งเตือน)
-- หมายเหตุ: Authorization ใช้ anon key (public) แบบเดียวกับ cron kick อื่นๆ — ตัวฟังก์ชันตรวจ JWT เอง
select cron.schedule(
  'kick_ads_watchdog',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://uafnpbawajgonarvlurj.supabase.co/functions/v1/ads-watchdog',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    body := '{}'::jsonb
  );
  $$
);
