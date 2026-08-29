-- ============================================================
--  risk detection: จับคู่เอกสารที่น่าจะเป็นการออกซ้ำ (เพิ่ม 28 ส.ค. 2569 ตามมอคอัพ
--  Sudo Financial OS — "Sudo สังเกตเห็น: ยอด VAT ใบ X อาจซ้ำกับใบ Y")
--
--  ⚠️ ทำไมต้องมีทั้งที่ saveDoc มีด่านกันออกซ้ำอยู่แล้ว (src/app/dashboard/finance/actions.ts)
--  ด่านเดิมเช็คเฉพาะ "ตอนกำลังจะสร้างใหม่" เทียบกับของเดิม — ไม่ครอบคลุมคู่ที่หลุดผ่านไปแล้ว
--  ก่อนด่านนี้จะมี (เอกสารเก่า) หรือคู่ที่ผู้ใช้กด "ยืนยันออกซ้ำ" ไปแล้วจริง ๆ แต่ที่จริงพิมพ์ผิด
--  ฟังก์ชันนี้จึงสแกนย้อนหลังแบบอ่านอย่างเดียว ไม่บล็อกอะไร แค่เตือนให้ไปตรวจเอง
--
--  ต่อยอดจาก shop_data_health ที่มีอยู่แล้ว (migration ก่อนหน้า) เพราะมันถูกเดินสายเข้า
--  กระดิ่งแจ้งเตือนแล้ว (src/lib/notices.ts) — ต่อของเดิมแทนสร้างระบบแจ้งเตือนใหม่อีกชุด
-- ============================================================
create or replace function public.shop_data_health(p_shop_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_shop     record;
  v_bad_ptr  int;
  v_names    text;
  v_odd      int;
  v_odd_list text;
  v_dup      int;
  v_dup_list text;
begin
  if not exists (
    select 1 from shop_members m
    where m.shop_id = p_shop_id and m.user_id = auth.uid()
  ) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select tax_id, billing_address into v_shop from shops where id = p_shop_id;

  select count(distinct contact_name),
         string_agg(distinct contact_name, ' · ' order by contact_name)
    into v_bad_ptr, v_names
  from fin_docs
  where shop_id = p_shop_id and doc_type = 'expense' and wht_amount > 0
    and status not in ('draft', 'void')
    and not valid_thai_tax_id(contact_tax_id);

  select count(*), string_agg(doc_number || ' = ' || issue_date, ' · ')
    into v_odd, v_odd_list
  from (
    select doc_number, issue_date from fin_docs
    where shop_id = p_shop_id and status not in ('draft', 'void')
      and issue_date > (now() at time zone 'Asia/Bangkok')::date + 90
    order by issue_date desc limit 3
  ) x;

  -- คู่เอกสารที่ยอดรวมเท่ากัน ชนิดเดียวกัน คู่ค้าชื่อเดียวกัน วันที่ห่างกันไม่เกิน 3 วัน
  -- และไม่ใช่ต้นทาง-ปลายทางของกันเอง (ref_doc_id) เพราะใบเสนอราคา->ใบแจ้งหนี้ยอดเท่ากัน
  -- เป็นเรื่องปกติ ไม่ใช่ของซ้ำ
  select count(*), string_agg(a.doc_number || ' = ' || b.doc_number, ' · ')
    into v_dup, v_dup_list
  from fin_docs a
  join fin_docs b on b.shop_id = a.shop_id
    and b.doc_type = a.doc_type
    and b.total = a.total
    and lower(btrim(b.contact_name)) = lower(btrim(a.contact_name))
    and b.id > a.id
    and abs(b.issue_date - a.issue_date) <= 3
    and b.ref_doc_id is distinct from a.id
    and a.ref_doc_id is distinct from b.id
  where a.shop_id = p_shop_id
    and a.status not in ('draft', 'void') and b.status not in ('draft', 'void')
    and coalesce(btrim(a.contact_name), '') <> ''
    and a.total > 0;

  return jsonb_build_object(
    'tax_id_ok',      valid_thai_tax_id(v_shop.tax_id),
    'address_ok',     coalesce(btrim(v_shop.billing_address), '') <> '',
    'bad_partners',   coalesce(v_bad_ptr, 0),
    'partner_names',  left(coalesce(v_names, ''), 120),
    'odd_dates',      coalesce(v_odd, 0),
    'odd_list',       left(coalesce(v_odd_list, ''), 120),
    'dup_docs',       coalesce(v_dup, 0),
    'dup_list',       left(coalesce(v_dup_list, ''), 120)
  );
end $function$;
