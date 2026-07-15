-- ============================================================
--  017 — ตัดค่าสมาชิกรายเดือนอัตโนมัติจาก wallet (แก้ข้อ 1)
-- ============================================================
alter table public.shops add column if not exists next_bill_at date;
alter table public.shops add column if not exists billing_overdue boolean not null default false;

-- ตั้งวันบิลถัดไปให้ร้านที่มีแพ็กเกจเสียเงินแต่ยังไม่มีวันบิล
update public.shops s set next_bill_at = (s.plan_since + interval '1 month')::date
where next_bill_at is null and exists (select 1 from plans p where p.code=s.plan and p.price_monthly>0);

-- รันตัดรอบบิล (เรียกโดย cron ทุกวัน)
create or replace function public.run_plan_billing() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record; v_bal numeric; charged int := 0; overdue int := 0; downgraded int := 0;
begin
  for r in
    select s.id, s.plan, s.next_bill_at, s.billing_overdue, p.price_monthly, p.name
    from shops s join plans p on p.code = s.plan
    where p.price_monthly > 0 and s.status='active'
      and s.next_bill_at is not null and s.next_bill_at <= (now() at time zone 'Asia/Bangkok')::date
  loop
    select balance into v_bal from wallets where shop_id = r.id for update;
    if coalesce(v_bal,0) >= r.price_monthly then
      -- ตัดเงินสำเร็จ -> เลื่อนรอบบิล +1 เดือน
      perform 1 from wallets where shop_id=r.id;
      update wallets set balance = balance - r.price_monthly, updated_at=now() where shop_id=r.id returning balance into v_bal;
      insert into wallet_transactions (shop_id,type,amount,balance_after,ref_type,note)
        values (r.id,'debit',-r.price_monthly,v_bal,'plan_fee','ค่าสมาชิกแพ็กเกจ '||r.name);
      update shops set next_bill_at = (r.next_bill_at + interval '1 month')::date, billing_overdue=false where id=r.id;
      insert into audit_logs (shop_id,actor_type,action,resource_type,details)
        values (r.id,'system','plan_billed','shops',jsonb_build_object('amount',r.price_monthly,'balance',v_bal));
      charged := charged + 1;
    else
      -- เครดิตไม่พอ: mark overdue; ถ้าค้างเกิน 7 วัน -> ลดเป็น free
      if r.next_bill_at < (now() at time zone 'Asia/Bangkok')::date - 7 then
        update shops set plan='free', billing_overdue=false, next_bill_at=null where id=r.id;
        insert into audit_logs (shop_id,actor_type,action,resource_type,details)
          values (r.id,'system','plan_downgraded_unpaid','shops',jsonb_build_object('from',r.plan));
        downgraded := downgraded + 1;
      else
        update shops set billing_overdue=true where id=r.id;
        overdue := overdue + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('charged',charged,'overdue',overdue,'downgraded',downgraded,'ran_at',now());
end $$;
revoke execute on function public.run_plan_billing() from anon, authenticated, public;
grant execute on function public.run_plan_billing() to service_role;

-- ตั้ง next_bill_at เมื่อเปลี่ยนแพ็กเกจเป็นแบบเสียเงิน (trigger)
create or replace function public.on_plan_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_price numeric;
begin
  if new.plan is distinct from old.plan then
    select price_monthly into v_price from plans where code = new.plan;
    if coalesce(v_price,0) > 0 then
      new.next_bill_at := coalesce(new.next_bill_at, (current_date + interval '1 month')::date);
      new.plan_since := current_date;
    else
      new.next_bill_at := null; new.billing_overdue := false;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_on_plan_change on public.shops;
create trigger trg_on_plan_change before update of plan on public.shops
  for each row execute function public.on_plan_change();

-- cron: ตัดรอบบิลทุกวัน 01:00 ไทย (18:00 UTC) + หมดอายุ topup ค้างเกิน 24 ชม.
select cron.schedule('run_plan_billing_daily','0 18 * * *',$CRON$ select public.run_plan_billing(); $CRON$);
select cron.schedule('expire_stale_topups','30 * * * *',$CRON$
  update public.topups set status='expired'
  where status='pending' and created_at < now() - interval '24 hours';
$CRON$);
