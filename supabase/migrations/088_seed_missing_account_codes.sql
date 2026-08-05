-- 088: เติมรหัสบัญชีที่โค้ดใช้จริงแต่ผังบัญชีตั้งต้นไม่มีให้ (5 ส.ค. 2569) — apply บน production แล้ว
--
-- ⚠️ เพิ่มบัญชีเปล่าอย่างเดียว ไม่มีตัวเลข ไม่มีรายการบัญชีใดถูกแตะ (ยอดทุกบัญชีใหม่ = 0)
--
-- วัดจริงก่อนแก้: 18 จาก 24 กิจการไม่มีรหัส 2035 · 17 ไม่มี 4190 · 18 ไม่มี 1210/1290/5210
-- ทั้งที่ src/lib/finance-server.ts ประกาศและเรียกใช้ทุกตัว:
--   2035 = ภาษีขายรอเรียกเก็บ  -> ใบแจ้งหนี้บริการ จุดรับผิดเมื่อรับเงิน (ม.78/1)
--   4190 = รับคืน/ส่วนลดจ่าย   -> ใบลดหนี้ (ม.86/10)
--   1210/1290/5210             -> ทะเบียนทรัพย์สินและค่าเสื่อมราคา
--
-- ความเสียหายที่เกิดเมื่อผู้ใช้กดใช้จริง (พิสูจน์จากลำดับโค้ด):
-- เอกสารถูก insert ก่อน แล้วค่อยลงบัญชี พอ postJournal หารหัสไม่เจอจะโยน
-- => เอกสาร "ออกแล้ว" กินเลขที่ไปหนึ่งใบโดยไม่มีใบสำคัญ ผู้ใช้เห็นแค่ "บันทึกไม่สำเร็จ" แล้วกดซ้ำ
-- กรณีใบลดหนี้ยิ่งหนัก: รายงาน VAT นับใบลดหนี้ (072) แต่สมุดรายวันไม่เคยกลับ = ยื่นภาษีผิด
--
-- วัดหลัง apply: ทั้ง 24 กิจการมีครบทุกรหัสแล้ว (ชื่อบัญชีของกิจการที่มีอยู่เดิมไม่ถูกเขียนทับ)

-- 1) แก้ที่ต้นทาง: กิจการที่เปิดใหม่ต้องได้ครบตั้งแต่แรก
create or replace function public.seed_chart_of_accounts(p_shop_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.chart_of_accounts (shop_id, code, name, type, is_system)
  values
    (p_shop_id, '1010', 'เงินสด', 'asset', true),
    (p_shop_id, '1020', 'เงินฝากธนาคาร', 'asset', true),
    (p_shop_id, '1130', 'ลูกหนี้การค้า', 'asset', true),
    (p_shop_id, '1154', 'ภาษีซื้อ', 'asset', true),
    (p_shop_id, '1155', 'ภาษีถูกหัก ณ ที่จ่าย', 'asset', true),
    (p_shop_id, '1160', 'สินค้าคงเหลือ', 'asset', true),
    (p_shop_id, '1210', 'ที่ดิน อาคารและอุปกรณ์', 'asset', true),
    (p_shop_id, '1290', 'ค่าเสื่อมราคาสะสม', 'asset', true),
    (p_shop_id, '2010', 'เจ้าหนี้การค้า', 'liability', true),
    (p_shop_id, '2030', 'ภาษีขาย', 'liability', true),
    (p_shop_id, '2035', 'ภาษีขายรอเรียกเก็บ', 'liability', true),
    (p_shop_id, '2045', 'ภาษีหัก ณ ที่จ่ายค้างนำส่ง', 'liability', true),
    (p_shop_id, '3010', 'ส่วนของเจ้าของ', 'equity', true),
    (p_shop_id, '3020', 'กำไรสะสม', 'equity', true),
    (p_shop_id, '4010', 'รายได้จากการขาย/บริการ', 'income', true),
    (p_shop_id, '4090', 'รายได้อื่น', 'income', true),
    (p_shop_id, '4190', 'รับคืนและส่วนลดจ่าย', 'income', true),
    (p_shop_id, '5010', 'ต้นทุนขาย/ซื้อสินค้า', 'expense', true),
    (p_shop_id, '5110', 'เงินเดือน/ค่าจ้าง', 'expense', true),
    (p_shop_id, '5120', 'ค่าเช่า', 'expense', true),
    (p_shop_id, '5130', 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต', 'expense', true),
    (p_shop_id, '5140', 'ค่าขนส่ง/เดินทาง', 'expense', true),
    (p_shop_id, '5150', 'การตลาด/โฆษณา', 'expense', true),
    (p_shop_id, '5160', 'ค่าธรรมเนียม/บริการ', 'expense', true),
    (p_shop_id, '5170', 'วัสดุ/อุปกรณ์สำนักงาน', 'expense', true),
    (p_shop_id, '5180', 'ภาษี/ประกันสังคม', 'expense', true),
    (p_shop_id, '5210', 'ค่าเสื่อมราคา', 'expense', true),
    (p_shop_id, '5990', 'ค่าใช้จ่ายอื่น', 'expense', true)
  on conflict (shop_id, code) do nothing;
$function$;

-- 2) เติมย้อนหลังให้กิจการที่มีอยู่แล้วทุกราย (on conflict do nothing = ของเดิมไม่ถูกแตะ)
do $$
declare r record;
begin
  for r in select id from shops loop
    perform public.seed_chart_of_accounts(r.id);
  end loop;
end $$;
