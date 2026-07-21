-- 046: (1) แพ็กเกจใหม่ 'มินิ' 190฿ — อุดช่องว่างราคา free(0) → starter(390)
--          ลด friction การจ่ายครั้งแรกของแม่ค้ารายเล็ก (คู่แข่ง ECOUNT 1,700฿ / Zaapi ~890฿)
--      (2) โมเดลพรีเมียมนับ 3 เครดิต/ข้อความ — กัน margin ติดลบ:
--          ต้นทุนตอบด้วยโมเดลพรีเมียม ~0.5-1.3฿/ข้อความ แต่ราคาขายต่อข้อความ
--          ของแพ็ก pro = 990/5000 = 0.198฿ → ถ้านับ 1:1 ขาดทุนทุกข้อความ
--          นับ 3 เครดิต = ราคา effective 0.594฿ + extra 1.05฿ → กำไร/เท่าทุนทุกกรณี
--          (แนะนำ routing premium → gemini-2.5-pro ไม่ใช่ claude-opus — ดู docs/RISK-BLINDSPOTS.md)

-- ---- แพ็กมินิ + จัดลำดับใหม่ ----
update plans set sort = 4 where code = 'enterprise';
update plans set sort = 3 where code = 'pro';
update plans set sort = 2 where code = 'starter';
insert into plans (code, name, sort, active, features, max_members, max_channels,
  price_monthly, included_replies, rate_limit_per_day, rate_limit_per_min, price_per_extra_reply)
values ('mini', 'มินิ', 1, true,
  '["ทุกอย่างในทดลองใช้","2 ช่องทาง","ตอบฟรี 500 ข้อความ/เดือน","ตรวจสลิปอัตโนมัติ"]'::jsonb,
  3, 2, 190, 500, 3000, 30, 0.59)
on conflict (code) do nothing;

-- โน้ตเครดิตพรีเมียมใน features ของ pro (สื่อสารตรงไปตรงมา)
update plans set features =
  '["ทุกอย่างในเริ่มต้น","10 ช่องทาง","ตอบฟรี 5,000 ข้อความ/เดือน","เลือกโมเดล AI ระดับพรีเมียม (นับ 3 เครดิต/ข้อความ)","รายงานเชิงลึก"]'::jsonb
where code = 'pro';

-- ---- bill_bot_reply รับน้ำหนักเครดิต (default 1 — โค้ดเก่าเรียก 2 อาร์กิวเมนต์ได้ต่อ) ----
drop function if exists public.bill_bot_reply(uuid, text);

create or replace function public.bill_bot_reply(p_shop_id uuid, p_ref text default null, p_weight int default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_period text := current_period();
  v_plan record; v_used int; v_bal numeric; v_price numeric;
  v_w int := greatest(1, least(10, coalesce(p_weight, 1)));
  v_free int; v_paid int; v_charge numeric;
begin
  -- idempotency: ref เดิมเคยบิลแล้ว -> อนุญาตให้ทำต่อโดยไม่หักซ้ำ
  if p_ref is not null then
    insert into billed_refs (ref, shop_id) values (p_ref, p_shop_id) on conflict (ref) do nothing;
    if not found then
      return jsonb_build_object('allowed', true, 'billed', false, 'dedup', true);
    end if;
  end if;

  select p.* into v_plan from shops s join plans p on p.code = s.plan where s.id = p_shop_id;
  if not found then
    select * into v_plan from plans where code = 'free';
  end if;

  insert into usage_monthly (shop_id, period, replies_count) values (p_shop_id, v_period, 0)
    on conflict (shop_id, period) do nothing;
  select replies_count into v_used from usage_monthly where shop_id = p_shop_id and period = v_period for update;

  -- แบ่งน้ำหนัก: ส่วนที่ยังอยู่ในโควตาฟรี / ส่วนที่ต้องหักเครดิต
  v_free := greatest(0, least(v_plan.included_replies - v_used, v_w));
  v_paid := v_w - v_free;

  if v_paid = 0 then
    update usage_monthly set replies_count = replies_count + v_w where shop_id = p_shop_id and period = v_period;
    return jsonb_build_object('allowed', true, 'billed', false, 'remaining_free', v_plan.included_replies - v_used - v_w);
  end if;

  v_price := v_plan.price_per_extra_reply;
  v_charge := round((v_price * v_paid)::numeric, 2);
  select balance into v_bal from wallets where shop_id = p_shop_id for update;
  if coalesce(v_bal, 0) >= v_charge then
    update wallets set balance = balance - v_charge, updated_at = now() where shop_id = p_shop_id returning balance into v_bal;
    update usage_monthly set replies_count = replies_count + v_w, billed_replies = billed_replies + v_paid,
      billed_amount = billed_amount + v_charge where shop_id = p_shop_id and period = v_period;
    insert into wallet_transactions (shop_id, type, amount, balance_after, ref_type, ref_id, note)
      values (p_shop_id, 'debit', -v_charge, v_bal, 'bot_reply', p_ref, 'ค่าบอทตอบเกินโควตา');
    return jsonb_build_object('allowed', true, 'billed', true, 'charged', v_charge, 'balance', v_bal);
  else
    -- ปล่อย ref ให้บิลใหม่ได้ถ้ารอบหน้าเครดิตพอ
    if p_ref is not null then delete from billed_refs where ref = p_ref; end if;
    return jsonb_build_object('allowed', false, 'reason', 'insufficient_credit',
      'message', 'เครดิตหมดและใช้เกินโควตาแพ็กเกจแล้ว กรุณาเติมเงินหรืออัปเกรดแพ็กเกจ');
  end if;
end $$;

revoke all on function public.bill_bot_reply(uuid, text, int) from public, anon, authenticated;
grant execute on function public.bill_bot_reply(uuid, text, int) to service_role;
