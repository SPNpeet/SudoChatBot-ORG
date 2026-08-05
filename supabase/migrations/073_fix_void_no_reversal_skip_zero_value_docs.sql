-- ============================================================
--  073 — แก้ธงเท็จ void_no_reversal (4 ส.ค. 2569)
--
--  อาการ: เอกสารยอด 0 ที่ถูกยกเลิก ถูกฟ้องเป็น critical
--  "เอกสารที่ยกเลิกแต่ไม่มีรายการกลับบัญชี" พร้อมข้อความห้ามใช้ตัวเลขยื่นภาษี
--
--  ทำไมเป็นธงเท็จ: เอกสารยอด 0 ลงสมุดรายวันไม่ได้ตั้งแต่แรก (ไม่มีบรรทัดให้ลง)
--  จึงไม่เคยมีรายการบัญชี พอยกเลิกก็ไม่มีอะไรให้กลับรายการ
--  งบไม่ได้เพี้ยนเลยสักบาท แต่แผงความถูกต้องขึ้นแดง = คนใช้เลิกเชื่อแผงนี้
--  ซึ่งอันตรายกว่าไม่มีแผง เพราะวันที่มีปัญหาจริงเขาจะไม่สนใจแล้ว
--
--  ยกเว้นเฉพาะ "ยอด 0 และไม่เคยมีรายการบัญชี" เท่านั้น
--  เอกสารที่มียอดจริงแล้วยกเลิกโดยไม่มีรายการกลับ ยังต้องฟ้องเหมือนเดิม (ของจริง)
--
--  ต้นเหตุที่ทำให้มีเอกสารยอด 0 ถูกปิดไปแล้วที่ commit 9d8b63b
--  (ด่านกันยอด 0 ทั้งฝั่งฟอร์มและ server) เคสนี้จึงเกิดใหม่ไม่ได้อีก
-- ============================================================
do $mig$
declare
  src text;
  old_block text := $old$    and d.status = 'void' and d.doc_type <> 'quotation'
    and (select count(*) from journal_entries je where je.source_id = d.id) < 2$old$;
  new_block text := $new$    and d.status = 'void' and d.doc_type <> 'quotation'
    and (select count(*) from journal_entries je where je.source_id = d.id) < 2
    -- ยอด 0 ที่ไม่เคยลงบัญชี = ไม่มีอะไรให้กลับรายการ ไม่ใช่ความผิดพลาดทางบัญชี
    and not (coalesce(d.total,0) = 0
             and (select count(*) from journal_entries je2 where je2.source_id = d.id) = 0)$new$;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'accounting_integrity';

  if src is null then
    -- เหตุผลเดียวกับ 072: แพตช์ต้องข้ามได้ ไม่ใช่ทำให้ migration ทั้งชุดตายบน clone ใหม่
    -- ฟังก์ชันฉบับเต็มถูกสร้างโดย 086/089 ซึ่งอยู่หลังไฟล์นี้
    raise notice 'ข้ามแพตช์ void_no_reversal: ยังไม่มีฟังก์ชัน accounting_integrity (จะถูกสร้างโดย migration รุ่นหลัง)';
    return;
  end if;
  if position(old_block in src) = 0 then
    raise notice 'ข้ามการแก้ void_no_reversal: หาบล็อกเดิมไม่เจอ';
    return;
  end if;

  execute replace(src, old_block, new_block);
end
$mig$;
