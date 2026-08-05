-- ============================================================
--  072 — แก้ตัวตรวจ vat_report_vs_gl ที่ฟ้องผิด (4 ส.ค. 2569)
--
--  อาการ: หน้ารายงานขึ้นธงแดง "ภาษีขายในรายงานไม่ตรงกับสมุดรายวัน"
--  พร้อมข้อความ "ห้ามใช้ตัวเลขนี้ยื่นภาษี" ทั้งที่ตัวเลขถูกต้องอยู่แล้ว
--
--  สาเหตุ: ฝั่งเอกสารของตัวตรวจนับเฉพาะ invoice + receipt(ขายสด)
--  **ไม่นับใบลดหนี้/ใบเพิ่มหนี้** แต่สมุดรายวันกลับรายการภาษีขายของใบลดหนี้จริง
--  จึงต่างกันเท่ากับ VAT ของใบลดหนี้ในเดือนนั้นเป๊ะ ๆ ทุกครั้งที่มีการออกใบลดหนี้
--  (วัดจริง กิจการหนึ่ง เดือน 2026-08: เอกสาร 1,340.10 vs สมุดรายวัน 1,184.40 = 155.70)
--
--  ต้นตอเชิงโครงสร้าง: กฎ "ใบไหนนับเป็นภาษีขาย" ถูกเขียนซ้ำสองที่
--  (src/lib/vat-docs.ts กับในฟังก์ชันนี้) แล้วอัปเดตไม่พร้อมกัน
--  ฝั่ง TypeScript รวมใบลดหนี้ถูกแล้ว (selectVatSalesDocs) แต่ฝั่ง SQL ตกหล่น
--
--  แก้: ทำเงื่อนไขให้ตรงกับ selectVatSalesDocs ทุกตัวอักษร
--   · invoice — เฉพาะ tax_point <> 'payment' (ม.78/1 ไปนับตอนรับเงิน)
--   · receipt — เฉพาะขายสด (ไม่ได้แปลงมาจากใบแจ้งหนี้ กันนับซ้ำ)
--   · credit_note (ลบ) / debit_note (บวก) — เข้างวดที่ออก ตาม ม.86/10, 86/9
-- ============================================================
do $mig$
declare
  src text;
  old_block text := $old$      select to_char(issue_date,'YYYY-MM') m, sum(vat_amount) v
      from fin_docs
      where (p_shop_id is null or shop_id = p_shop_id)
        and status not in ('draft','void') and coalesce(vat_mode,'none') <> 'none' and vat_amount > 0
        and coalesce(tax_point,'delivery') <> 'payment'
        and (doc_type = 'invoice' or (doc_type = 'receipt' and ref_doc_id is null))
      group by 1$old$;
  new_block text := $new$      select to_char(issue_date,'YYYY-MM') m,
             sum(case when doc_type = 'credit_note' then -vat_amount else vat_amount end) v
      from fin_docs
      where (p_shop_id is null or shop_id = p_shop_id)
        and status not in ('draft','void') and coalesce(vat_mode,'none') <> 'none' and vat_amount > 0
        and (
              (doc_type = 'invoice' and coalesce(tax_point,'delivery') <> 'payment')
           or (doc_type = 'receipt' and ref_doc_id is null)
           or  doc_type in ('credit_note','debit_note')
            )
      group by 1$new$;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'accounting_integrity';

  if src is null then
    -- ⚠️ ห้าม raise exception ตรงนี้ (แก้ 5 ส.ค. 2569)
    -- ไฟล์นี้เป็น "แพตช์" ที่แก้ข้อความในฟังก์ชันที่มีอยู่แล้ว ไม่ใช่ไฟล์ที่สร้างฟังก์ชัน
    -- บน clone ใหม่ที่ยังไม่มีฟังก์ชัน การโยนจะทำให้ migration ตายกลางทาง
    -- แล้วไฟล์ที่เหลือ (รวม 086/089 ที่ create or replace ฟังก์ชันฉบับเต็ม) ไม่ถูกรันเลย
    -- = สร้างระบบขึ้นมาใหม่จาก repo ไม่ได้ ซึ่งเป็นเรื่องคอขาดบาดตายตอนต้องกู้ระบบ
    raise notice 'ข้ามแพตช์ vat_report_vs_gl: ยังไม่มีฟังก์ชัน accounting_integrity (จะถูกสร้างโดย migration รุ่นหลัง)';
    return;
  end if;
  if position(old_block in src) = 0 then
    -- แก้ไปแล้ว (rerun) หรือฟังก์ชันเปลี่ยนไป — ไม่ทำอะไร ดีกว่าแก้มั่ว
    raise notice 'ข้ามการแก้ vat_report_vs_gl: หาบล็อกเดิมไม่เจอ';
    return;
  end if;

  execute replace(src, old_block, new_block);
end
$mig$;
