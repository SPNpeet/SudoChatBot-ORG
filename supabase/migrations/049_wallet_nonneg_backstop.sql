-- 049: backstop กันยอดกระเป๋าเงินติดลบ (bill_bot_reply กันอยู่แล้วด้วย if v_bal >= v_charge
--      แต่ใส่ CHECK ระดับ DB ไว้เป็นตาข่ายสุดท้าย เผื่อมีทางเขียน balance จากที่อื่นพลาด)
alter table wallets drop constraint if exists wallets_balance_nonneg;
alter table wallets add constraint wallets_balance_nonneg check (balance >= 0);
