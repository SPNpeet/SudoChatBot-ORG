-- 044: purpose 'assistant' — log การใช้ AI ของผู้จัดการร้าน (ERP Copilot)
-- แยกจาก playground/ads เพื่อคุมโควตาแยก (100 ข้อความ/วัน/ร้าน เช็คฝั่งแอป)
alter table ai_usage_logs drop constraint if exists ai_usage_logs_purpose_check;
alter table ai_usage_logs add constraint ai_usage_logs_purpose_check
  check (purpose = any (array['reply','embedding','ocr','slip_verify','summarize','classify','ads','comment','assistant']));
