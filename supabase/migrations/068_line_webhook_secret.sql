-- 068: เก็บ Channel secret ของ Messaging API ไว้ตรวจลายเซ็น webhook
-- (คนละตัวกับ LINE Login secret — ตัวนี้ยืนยันว่า event ที่ยิงเข้ามาเป็นของ LINE จริง)
alter table platform_billing_settings
  add column if not exists line_oa_channel_secret text;
