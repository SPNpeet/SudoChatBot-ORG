-- ตรวจว่าระบบที่กู้มา "ใช้งานได้จริง" ไม่ใช่แค่มีแถวครบ
select '    ข้อมูล: กิจการ ' || (select count(*) from shops)
    || ' · เอกสาร ' || (select count(*) from fin_docs)
    || ' · ใบสำคัญ ' || (select count(*) from journal_entries)
    || ' · บรรทัดบัญชี ' || (select count(*) from journal_lines);
select '    บัญชี: เดบิต ' || to_char((select sum(debit) from journal_lines),'FM999,999,999.00')
    || ' = เครดิต ' || to_char((select sum(credit) from journal_lines),'FM999,999,999.00')
    || ' · ใบไม่สมดุล ' || (select count(*) from (select e.id from journal_lines l join journal_entries e on e.id=l.entry_id group by e.id having round(sum(l.debit)-sum(l.credit),2)<>0) x)
    || ' · อัตรา VAT ' || (vat_rate_on(current_date))::text;
