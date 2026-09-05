-- 114: ข้อความฟีเจอร์แพ็กที่ลูกค้าอ่านตอนตัดสินใจซื้อ — ตัดศัพท์นักพัฒนา (5 ก.ย. 2569)
-- "Audit Log" และ "(RLS)" เป็นคำที่คนทำบัญชีไม่รู้จัก ตรวจพบในรอบกวาดข้อความ 171 จุด
-- FALLBACK ใน src/lib/plans.ts แก้คู่กันแล้ว (ต้องตรงกันเสมอ)
update public.plans set features = (
  select jsonb_agg(case when f = 'Audit Log ครบทุกรายการ' then to_jsonb('ประวัติการทำรายการครบทุกรายการ ตรวจย้อนหลังได้'::text) else to_jsonb(f) end)
  from jsonb_array_elements_text(features) f
) where code = 'executive';
update public.plans set features = (
  select jsonb_agg(case when f = 'แยกข้อมูลลูกค้าเด็ดขาด (RLS) + ดูแลเฉพาะทาง' then to_jsonb('แยกข้อมูลแต่ละลูกค้าเด็ดขาด + ดูแลเฉพาะทาง'::text) else to_jsonb(f) end)
  from jsonb_array_elements_text(features) f
) where code = 'agency';
-- rollback: update กลับเป็นข้อความเดิมสองบรรทัดข้างบน (ข้อความอย่างเดียว ไม่แตะโครงสร้าง)
