-- 066: ปิดช่องโหว่ที่ Supabase security advisor ตรวจเจอ
-- (1) seed_chart_of_accounts / seed_expense_categories เป็น SECURITY DEFINER รับ shop_id ตรงๆ
--     ไม่เช็คสิทธิ์ และ anon เรียกผ่าน REST ได้ => ยัดข้อมูลใส่ร้านคนอื่นได้
-- (2) ฟังก์ชัน trigger ไม่ควรโผล่เป็น RPC
-- (3) normalize_email ไม่ได้ล็อก search_path
-- trigger ยังทำงานปกติ เพราะรันด้วยสิทธิ์เจ้าของฟังก์ชัน ไม่ต้องพึ่ง grant
revoke all on function public.seed_chart_of_accounts(uuid) from public, anon, authenticated;
revoke all on function public.seed_expense_categories(uuid) from public, anon, authenticated;
revoke all on function public.tg_seed_chart_of_accounts() from public, anon, authenticated;
revoke all on function public.tg_seed_expense_categories() from public, anon, authenticated;
revoke all on function public._bump_platform_ai_daily() from public, anon, authenticated;
revoke all on function public.enforce_shop_signup() from public, anon, authenticated;
alter function public.normalize_email(text) set search_path to 'public';
