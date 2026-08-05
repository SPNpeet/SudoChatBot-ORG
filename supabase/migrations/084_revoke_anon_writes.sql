-- 084: ตัดสิทธิ์เขียนของ role anon ที่ไม่มีเหตุผลต้องมี (5 ส.ค. 2569) — apply บน production แล้ว
--
-- วัดจริงก่อนแก้: has_table_privilege('anon','shops','UPDATE') = true
-- แปลว่า role ที่คนทั้งอินเทอร์เน็ตถืออยู่ (anon key อยู่ใน bundle ฝั่ง client)
-- มีสิทธิ์ UPDATE ระดับตารางบน shops ครบทุกคอลัมน์ รวม plan / owner_id / status / ai_quota_override
-- วันนี้ยังเจาะไม่ได้เพราะ RLS ไม่มี policy ให้ anon — แต่นั่นคือเกราะชั้นเดียว
-- วันไหนมีใครเพิ่ม policy กว้างไปนิดเดียว = แจกแพ็กสูงสุดฟรีทั้งอินเทอร์เน็ต หรือยึดกิจการคนอื่น
-- หลักการ: anon ควรมีสิทธิ์เท่าที่จำเป็นจริง ๆ เท่านั้น (อ่านข้อมูลสาธารณะ) ไม่ใช่พึ่ง RLS ชั้นเดียว
revoke insert, update, delete on public.shops from anon;
revoke insert, update, delete on public.shop_members from anon;
revoke insert, update, delete on public.wallets from anon;
revoke insert, update, delete on public.topups from anon;
revoke insert, update, delete on public.wallet_transactions from anon;
revoke insert, update, delete on public.plans from anon;
revoke insert, update, delete on public.platform_admins from anon;
revoke insert, update, delete on public.platform_billing_settings from anon;
