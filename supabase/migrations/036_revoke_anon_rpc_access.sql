-- 036: security_advisors เจอว่า role anon (ผู้ใช้ที่ยังไม่ login) เรียก RPC หลายตัวได้ทั้งที่ระบบนี้ต้อง login ทุกจุด
-- (Postgres/Supabase ให้สิทธิ์ default แก่ anon ตอนสร้างฟังก์ชันใหม่ทุกครั้ง — revoke แค่จาก public ไม่พอ ต้อง revoke จาก anon ตรงๆ)
-- แก้ทั้ง class ไม่ใช่แค่ 3 ฟังก์ชันที่เพิ่งสร้างในไมเกรชันนี้ — รวมของเดิมที่หลุดมาด้วย
revoke execute on function public.admin_set_shop_status(uuid, text) from anon;
revoke execute on function public.admin_set_shop_plan(uuid, text) from anon;
revoke execute on function public.admin_mark_feedback(uuid, text) from anon;
revoke execute on function public.platform_billing_public() from anon;
revoke execute on function public.platform_stats() from anon;
revoke execute on function public.decrement_stock(uuid, uuid, integer) from anon;
revoke execute on function public.match_knowledge_chunks(uuid, vector, integer, double precision) from anon;
revoke execute on function public.match_products(uuid, vector, integer) from anon;
revoke execute on function public.search_products(uuid, text, integer) from anon;
revoke execute on function public.set_updated_at() from anon;

-- กันเกิดซ้ำ: ฟังก์ชันใหม่ในอนาคตจะไม่ auto-grant ให้ anon อีก (ยังคง auto-grant ให้ authenticated/service_role ตามปกติของโปรเจกต์นี้)
alter default privileges in schema public revoke execute on functions from anon;
