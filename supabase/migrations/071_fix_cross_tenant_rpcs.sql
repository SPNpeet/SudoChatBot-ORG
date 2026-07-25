-- ============================================================
--  071 — ปิดช่องโหว่ข้ามร้าน (apply บน production แล้ว + ทดสอบเจาะยืนยัน)
--
--  ปัญหาที่พบ: ฟังก์ชัน SECURITY DEFINER 5 ตัวรับ shop_id มาตรง ๆ โดยไม่ถามว่า
--  ผู้เรียกเป็นสมาชิกร้านนั้นหรือเปล่า และ grant ให้ role `authenticated`
--  แปลว่าลูกค้าคนไหนก็ยิงใส่ shop_id ของร้านอื่นได้
--
--  ที่ร้ายแรงที่สุดคือ next_fin_doc_number ซึ่ง "เขียน" — เดินเลขที่เอกสารของ
--  ร้านอื่นทิ้งได้ ทำให้เลขใบกำกับภาษีขาดช่วง ซึ่งเป็นเรื่องที่ต้องชี้แจงสรรพากร
--  รองลงมาคือ consume_ai_quota ที่ insert notifications เข้า dashboard ร้านอื่นได้
--
--  หลักที่ใช้ (assert_shop_access): ผ่านได้ 3 กรณีเท่านั้น
--   1) auth.uid() is null = เรียกจาก service_role ฝั่งเซิร์ฟเวอร์เราเอง
--      ปลอดภัยเพราะ anon ไม่มีสิทธิ์ EXECUTE ฟังก์ชันกลุ่มนี้อยู่แล้ว
--   2) เป็นสมาชิกร้านนั้นจริง (shop_members)
--   3) เป็นผู้ดูแลแพลตฟอร์ม
--
--  ทดสอบแล้ว: สวมรอยเป็นผู้ใช้ล็อกอินที่ไม่ใช่สมาชิก ยิงทั้ง 4 ตัว ถูกปฏิเสธหมด
--  และเส้นทางปกติของแอป (service_role / สมาชิกจริง) ยังทำงานได้ตามเดิม
--
--  ดูตัวฟังก์ชันฉบับเต็มได้จาก pg_get_functiondef บน production
--  ไฟล์นี้บันทึกไว้เพื่อให้ตรวจย้อนหลังได้ว่าแก้อะไรไปเมื่อไหร่และทำไม
-- ============================================================

create or replace function public.assert_shop_access(p_shop_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if (select auth.uid()) is null then return; end if;
  if public.is_platform_admin() then return; end if;
  if exists (select 1 from shop_members
              where shop_id = p_shop_id and user_id = (select auth.uid())) then return; end if;
  raise exception 'forbidden: ไม่ใช่สมาชิกของกิจการนี้' using errcode = '42501';
end $$;

revoke all on function public.assert_shop_access(uuid) from public, anon;
grant execute on function public.assert_shop_access(uuid) to authenticated, service_role;

-- ฟังก์ชันเหล่านี้เพิ่ม perform public.assert_shop_access(p_shop_id); เป็นบรรทัดแรก:
--   billing_summary, check_slip_quota, consume_ai_quota, next_fin_doc_number
-- can_create_company เช็คว่า p_owner ตรงกับ auth.uid() หรือเป็น platform admin

-- ออกเลขเอกสารควรเรียกจากฝั่งเซิร์ฟเวอร์เราเท่านั้น client ไม่มีเหตุต้องเรียกตรง
revoke all on function public.next_fin_doc_number(uuid, text) from public, anon, authenticated;
grant execute on function public.next_fin_doc_number(uuid, text) to service_role;
