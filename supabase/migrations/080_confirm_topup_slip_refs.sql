-- 080: อนุมัติมือก็ต้องลงทะเบียนกลางกันสลิปซ้ำ (5 ส.ค. 2569) — apply บน production แล้ว
-- route อัปสลิปอ่าน mini-QR แล้วเก็บ transRef ไว้บน topups ตั้งแต่ตอนอัป
-- พออนุมัติ (มือหรือออโต้) เลขนั้นต้องเข้าตาราง slip_refs เพื่อกันใช้ซ้ำทั้งแพลตฟอร์ม
create or replace function public.admin_confirm_topup(p_topup_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_t record; v_bal numeric;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select * into v_t from topups where id = p_topup_id for update;
  if not found then raise exception 'topup not found'; end if;
  if v_t.status = 'paid' then return jsonb_build_object('ok', false, 'message', 'รายการนี้ยืนยันแล้ว'); end if;

  if p_approve then
    update topups set status='paid', verified_by='manual', verifier_id=(select auth.uid()), paid_at=now() where id=p_topup_id;
    v_bal := credit_wallet(v_t.shop_id, v_t.amount, 'topup', 'topup', p_topup_id::text, 'เติมเงิน PromptPay', (select auth.uid()));
    -- ลงทะเบียนกลางกันสลิปซ้ำ — มีเลขเมื่ออ่าน mini-QR จากสลิปออก (ไม่มีก็ข้าม ไม่ใช่เงื่อนไขการอนุมัติ)
    if v_t.slip_trans_ref is not null then
      insert into slip_refs (trans_ref, shop_id, source) values (v_t.slip_trans_ref, v_t.shop_id, 'topup')
      on conflict (trans_ref) do nothing;
    end if;
    insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id, details)
      values (v_t.shop_id, 'user', (select auth.uid())::text, 'topup_confirmed', 'topups', p_topup_id::text, jsonb_build_object('amount', v_t.amount, 'balance', v_bal));
    return jsonb_build_object('ok', true, 'balance', v_bal);
  else
    update topups set status='rejected', verified_by='manual', verifier_id=(select auth.uid()) where id=p_topup_id;
    insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id)
      values (v_t.shop_id, 'user', (select auth.uid())::text, 'topup_rejected', 'topups', p_topup_id::text);
    return jsonb_build_object('ok', true, 'rejected', true);
  end if;
end $function$;
