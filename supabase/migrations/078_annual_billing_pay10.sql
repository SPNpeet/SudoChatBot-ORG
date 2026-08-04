-- 078: รายปีจ่าย 10 เดือน ใช้ 12 เดือน (5 ส.ค. 2569) — apply บน production แล้ว
-- topups.plan_period บอกว่ารายการซื้อแพ็กเป็นรายเดือนหรือรายปี
-- ต้องเป็นคอลัมน์ ไม่เดาจากยอดเงิน — ราคาแพ็กเปลี่ยนได้ระหว่างสร้าง QR กับสลิปผ่าน
alter table topups add column if not exists plan_period text
  check (plan_period is null or plan_period in ('monthly','yearly'));

create or replace function public.apply_plan_purchase(p_topup_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_t record; v_price numeric; v_plan_name text; v_bal numeric;
  v_period text; v_months int; v_note text;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select * into v_t from topups where id = p_topup_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'topup not found'); end if;
  if v_t.plan_code is null then return jsonb_build_object('ok', true, 'skipped', 'not a plan purchase'); end if;
  if v_t.status <> 'paid' then return jsonb_build_object('ok', false, 'error', 'topup not paid'); end if;
  if v_t.plan_applied_at is not null then return jsonb_build_object('ok', true, 'skipped', 'already applied'); end if;

  -- แถวเก่าก่อนมีคอลัมน์ = รายเดือนเสมอ
  v_period := coalesce(v_t.plan_period, 'monthly');
  v_months := case when v_period = 'yearly' then 12 else 1 end;

  -- รายปี = จ่าย 10 เดือน ใช้ 12 เดือน (ราคาการตลาดที่เจ้าของเคาะ 5 ส.ค. 2569)
  select case when v_period = 'yearly' then price_monthly * 10 else price_monthly end, name
    into v_price, v_plan_name from plans where code = v_t.plan_code and active;
  if v_price is null then return jsonb_build_object('ok', false, 'error', 'unknown plan'); end if;

  v_note := 'ค่าแพ็กเกจ ' || v_plan_name
    || case when v_period = 'yearly' then ' รายปี — จ่าย 10 เดือน ใช้ 12 เดือน' else ' (ชำระตรง)' end;

  select balance into v_bal from wallets where shop_id = v_t.shop_id for update;

  if coalesce(v_bal, 0) >= v_price then
    -- ตัดค่าแพ็กทันทีจากเครดิตที่เพิ่งเข้า -> เปิดแพ็ก + รอบบิลถัดไปตามงวดที่ซื้อ
    update wallets set balance = balance - v_price, updated_at = now()
      where shop_id = v_t.shop_id returning balance into v_bal;
    insert into wallet_transactions (shop_id, type, amount, balance_after, ref_type, note)
      values (v_t.shop_id, 'debit', -v_price, v_bal, 'plan_fee', v_note);
    update shops set plan = v_t.plan_code, plan_since = v_today,
      next_bill_at = (v_today + make_interval(months => v_months))::date, billing_overdue = false
      where id = v_t.shop_id;
  else
    -- เครดิตไม่พอ (เคสประหลาด — ปกติ credit_wallet เข้าก่อนเรียกฟังก์ชันนี้เสมอ)
    -- เปิดแพ็กและให้ cron รอบบิลจัดการตามกติกาเดิม
    update shops set plan = v_t.plan_code, plan_since = v_today,
      next_bill_at = v_today, billing_overdue = false
      where id = v_t.shop_id;
  end if;

  update topups set plan_applied_at = now() where id = p_topup_id;
  insert into audit_logs (shop_id, actor_type, action, resource_type, resource_id, details)
    values (v_t.shop_id, 'system', 'plan_purchased', 'shops', v_t.shop_id::text,
      jsonb_build_object('plan', v_t.plan_code, 'amount', v_t.amount, 'topup_id', p_topup_id, 'period', v_period));
  return jsonb_build_object('ok', true, 'plan', v_t.plan_code, 'period', v_period);
end $function$;
