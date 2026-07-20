-- 038: หน้า admin/logs ใหม่ query audit_logs ทั้งระบบเรียงตาม created_at โดยไม่กรอง shop_id
-- index เดิม (shop_id, created_at) ช่วยไม่ได้กับ query แบบนี้ — เพิ่ม index เฉพาะ created_at
create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
