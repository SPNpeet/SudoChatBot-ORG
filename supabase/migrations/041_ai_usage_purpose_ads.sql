-- 041: เพิ่ม purpose 'ads' ให้ ai_usage_logs (ใช้นับโควตาแชท AI Ads Agent 30 ข้อความ/วัน/ร้าน)
alter table ai_usage_logs drop constraint if exists ai_usage_logs_purpose_check;
alter table ai_usage_logs add constraint ai_usage_logs_purpose_check
  check (purpose = any (array['reply','embedding','ocr','slip_verify','summarize','classify','ads']));
