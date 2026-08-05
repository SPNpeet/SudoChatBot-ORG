-- 086: ตัวตรวจ "ยกเลิกแล้วไม่มีรายการกลับบัญชี" ขึ้นธงแดงเท็จ (5 ส.ค. 2569) — apply บน production แล้ว
--
-- ⚠️ นี่คือการแก้ "ตัวตรวจ" ไม่ใช่การแก้ตัวเลขบัญชี — ไม่มีข้อมูลบัญชีใดถูกแตะ
--
-- หลักฐานว่าเป็นธงเท็จจริง (จาก audit_logs ของ production):
--   17:05:21 fin_doc_created EXP-2026-0002 {"total":779,"status":"draft"}
--   17:05:36 fin_doc_voided  EXP-2026-0002
-- เอกสารร่างไม่เคยลงสมุดรายวัน (ระบบลงบัญชีตอน "ออก" ไม่ใช่ตอนสร้างร่าง)
-- พอกดยกเลิกร่าง -> status=void, total=779, journal_entries=0
-- เงื่อนไขเดิมยกเว้นเฉพาะ total=0 -> ใบนี้จึงติด critical ค้างตลอดไป
-- และแก้ทางไหนไม่ได้เลย: ยกเลิกซ้ำก็ไม่ได้ (void แล้ว) แก้ DB ตรง ๆ ก็ผิดกติกาข้อ 7
-- ผลคือลูกค้าเห็นคำว่า "critical" บนหน้ารายงานของตัวเองตลอดไปจากการกดปุ่มปกติ 15 วินาที
--
-- หลักบัญชีที่ถูกต้อง: "กลับรายการ" มีความหมายก็ต่อเมื่อ "เคยลงรายการ" มาก่อน
-- เอกสารที่ไม่เคยมีใบสำคัญเลย (je = 0) จึงไม่มีอะไรให้กลับ ไม่ใช่ความผิดพลาดทางบัญชี
-- ส่วนใบที่เคยลงบัญชีแล้วยกเลิกโดยไม่กลับรายการ (je = 1) ยังติดธงเหมือนเดิม — ซึ่งคือของจริงที่ต้องจับ
-- (ปลอดภัยเพราะเส้นออกเอกสารลงบัญชีแบบ atomic: postJournalOrThrow โยน = เอกสารไม่ถูกออก
--  ดังนั้น "ออกแล้ว" ย่อมมีใบสำคัญเสมอ ใบที่ je=0 จึงเป็นร่างที่ถูกยกเลิกเท่านั้น)
--
-- วัดผลหลัง apply: ธงเท็จ 1 -> 0 · ไม่มีธงจริงตัวไหนถูกกลบ (missing_jv ยังเป็น 0 เท่าเดิม)
--
-- ข้อ 5 (missing_jv) เติมเงื่อนไขยกเว้นยอด 0 ด้วยเหตุผลเดียวกัน — เดิมเติมให้ข้อ 6 อย่างเดียว
create or replace function public.accounting_integrity(p_shop_id uuid default null)
returns table(code text, severity text, title text, bad_count bigint, detail text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_admin boolean := coalesce(public.is_platform_admin(), false);
begin
  if p_shop_id is not null and not v_admin
     and not exists (select 1 from shop_members m
                     where m.shop_id = p_shop_id and m.user_id = auth.uid()) then
    return;
  end if;
  if p_shop_id is null and not v_admin then
    return;
  end if;

  return query
  select 'doc_total'::text, 'critical'::text,
         'ยอดเอกสารไม่ลงตัว (ก่อนภาษี + VAT ≠ ยอดรวม)'::text,
         count(*), coalesce(string_agg(doc_number, ', ' order by doc_number), '')
  from fin_docs d
  where (p_shop_id is null or d.shop_id = p_shop_id)
    and d.status not in ('draft','void')
    and round((d.total - d.vat_amount) + d.vat_amount - d.total, 2) <> 0

  union all
  select 'vat_rate', 'critical',
         'ยอด VAT ไม่ตรงอัตราที่มีผล ณ วันออกเอกสาร',
         count(*), coalesce(string_agg(doc_number, ', ' order by doc_number), '')
  from fin_docs d
  where (p_shop_id is null or d.shop_id = p_shop_id)
    and d.status not in ('draft','void')
    and (
      (coalesce(d.vat_mode,'none') = 'exclusive'
        and abs(d.vat_amount - round((d.total - d.vat_amount) * vat_rate_on(d.issue_date), 2)) > 0.01)
      or (d.vat_mode = 'inclusive'
        and abs(d.vat_amount - round(d.total * vat_rate_on(d.issue_date) / (1 + vat_rate_on(d.issue_date)), 2)) > 0.01)
      or (coalesce(d.vat_mode,'none') = 'none' and d.vat_amount <> 0)
    )

  union all
  select 'wht_base', 'critical',
         'ฐานหัก ณ ที่จ่ายคิดผิด (ต้องคิดจากยอดก่อน VAT)',
         count(*), coalesce(string_agg(doc_number, ', ' order by doc_number), '')
  from fin_docs d
  where (p_shop_id is null or d.shop_id = p_shop_id)
    and d.status not in ('draft','void') and d.wht_rate > 0
    and abs(d.wht_amount - round((d.total - d.vat_amount) * d.wht_rate / 100, 2)) > 0.01

  union all
  select 'jv_balance', 'critical',
         'ใบสำคัญที่เดบิตไม่เท่าเครดิต',
         count(*), coalesce(string_agg(entry_number, ', ' order by entry_number), '')
  from (
    select e.entry_number
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where (p_shop_id is null or e.shop_id = p_shop_id)
    group by e.id, e.entry_number
    having round(sum(l.debit) - sum(l.credit), 2) <> 0
  ) x

  union all
  select 'missing_jv', 'critical',
         'เอกสารที่ออกแล้วแต่ไม่มีรายการในสมุดรายวัน',
         count(*), coalesce(string_agg(doc_number, ', ' order by doc_number), '')
  from fin_docs d
  where (p_shop_id is null or d.shop_id = p_shop_id)
    and d.status not in ('draft','void') and d.doc_type <> 'quotation'
    and coalesce(d.total,0) <> 0
    and not (d.doc_type = 'receipt' and d.ref_doc_id is not null)
    and not exists (select 1 from journal_entries je where je.source_id = d.id)

  union all
  select 'void_no_reversal', 'critical',
         'เอกสารที่ยกเลิกแต่ไม่มีรายการกลับบัญชี',
         count(*), coalesce(string_agg(doc_number, ', ' order by doc_number), '')
  from fin_docs d
  where (p_shop_id is null or d.shop_id = p_shop_id)
    and d.status = 'void' and d.doc_type <> 'quotation'
    and (select count(*) from journal_entries je where je.source_id = d.id) = 1

  union all
  select 'dup_doc_number', 'critical',
         'เลขที่เอกสารซ้ำในกิจการเดียวกัน',
         count(*), coalesce(string_agg(doc_number, ', ' order by doc_number), '')
  from (
    select d.doc_number from fin_docs d
    where (p_shop_id is null or d.shop_id = p_shop_id)
    group by d.shop_id, d.doc_number having count(*) > 1
  ) y

  union all
  select 'vat_report_vs_gl', 'critical',
         'ภาษีขายในรายงานไม่ตรงกับสมุดรายวัน',
         count(*), coalesce(string_agg(m, ', ' order by m), '')
  from (
    select coalesce(r.m, g.m) as m
    from (
      select to_char(issue_date,'YYYY-MM') m,
             sum(case when doc_type = 'credit_note' then -vat_amount else vat_amount end) v
      from fin_docs
      where (p_shop_id is null or shop_id = p_shop_id)
        and status not in ('draft','void') and coalesce(vat_mode,'none') <> 'none' and vat_amount > 0
        and (
              (doc_type = 'invoice' and coalesce(tax_point,'delivery') <> 'payment')
           or (doc_type = 'receipt' and ref_doc_id is null)
           or  doc_type in ('credit_note','debit_note')
            )
      group by 1
    ) r
    full join (
      select to_char(e.entry_date,'YYYY-MM') m, sum(l.credit - l.debit) v
      from journal_lines l join journal_entries e on e.id = l.entry_id
      join chart_of_accounts a on a.id = l.account_id
      where a.code = '2030' and (p_shop_id is null or e.shop_id = p_shop_id)
      group by 1
    ) g on r.m = g.m
    where abs(coalesce(r.v,0) - coalesce(g.v,0)) > 0.004
  ) z

  union all
  select 'odd_date', 'warning',
         'เอกสารลงวันที่ในอนาคตไกลผิดปกติ (น่าจะกรอก พ.ศ. ลงช่อง ค.ศ.)',
         count(*), coalesce(string_agg(doc_number || ' = ' || issue_date, ', '), '')
  from fin_docs d
  where (p_shop_id is null or d.shop_id = p_shop_id)
    and d.status not in ('draft','void')
    and d.issue_date > (now() at time zone 'Asia/Bangkok')::date + 90

  union all
  select 'wht_bad_taxid', 'warning',
         'คู่ค้าที่หักภาษี ณ ที่จ่ายไว้ แต่เลขผู้เสียภาษีไม่ถูกต้อง',
         count(distinct contact_name), coalesce(string_agg(distinct contact_name, ', '), '')
  from fin_docs d
  where (p_shop_id is null or d.shop_id = p_shop_id)
    and d.status not in ('draft','void') and d.doc_type = 'expense' and d.wht_amount > 0
    and not valid_thai_tax_id(d.contact_tax_id)

  union all
  select 'vat_rate_expired', 'warning',
         'อัตรา VAT ที่ระบบใช้เลยวันสิ้นสุดตามประกาศแล้ว',
         count(*), coalesce(string_agg(effective_to::text, ', '), '')
  from vat_rates
  where effective_to is not null
    and effective_to < (now() at time zone 'Asia/Bangkok')::date
    and not exists (
      select 1 from vat_rates v2
      where v2.effective_from > vat_rates.effective_to
    );
end $function$;
