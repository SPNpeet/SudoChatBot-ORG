-- 087: ทำให้เส้นกู้เงินของแอดมินใช้ได้จริง (5 ส.ค. 2569) — apply บน production แล้ว
--
-- ปัญหาที่ 1 — กดยืนยันแล้วพังถาวร:
-- credit_wallet ไม่มี exception block ถ้าชน unique wallet_tx_topup_once (= รายการนี้เครดิตไปแล้ว)
-- ทั้งฟังก์ชัน SECURITY DEFINER จะ abort -> update status ถูก rollback ไปด้วย
-- แอดมินกดกี่ครั้งก็ error เดิม แถวค้าง verifying ตลอดไป และแพ็กไม่มีวันเปิด
-- แก้: ดัก unique_violation แล้วถือว่า "เครดิตเข้าไปแล้ว" = สำเร็จ เดินต่อให้จบ
--
-- ปัญหาที่ 2 — สลิปที่ถูกปฏิเสธถูกเผาทิ้งถาวร:
-- ทางปฏิเสธไม่ล้าง slip_trans_ref ทิ้ง แต่ index topups_slip_ref_dedupe กันเลขซ้ำทั้งตาราง
-- ลูกค้าที่โอนเงินจริงแล้วโดนปฏิเสธเพราะเหตุอื่น (เช่นแนบผิดรายการ) จะสร้างรายการใหม่
-- แล้วใช้สลิปใบเดิมไม่ได้อีกเลย = เงินจริงที่โอนไปแล้วใช้ยืนยันไม่ได้ตลอดกาล
-- แก้: ปฏิเสธแล้วล้างเลขอ้างอิงคืน ให้สลิปใบนั้นกลับมาใช้ได้
create or replace function public.admin_confirm_topup(p_topup_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_t record; v_bal numeric; v_already boolean := false;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  select * into v_t from topups where id = p_topup_id for update;
  if not found then raise exception 'topup not found'; end if;
  if v_t.status = 'paid' then return jsonb_build_object('ok', false, 'message', 'รายการนี้ยืนยันแล้ว'); end if;

  if p_approve then
    update topups set status='paid', verified_by='manual', verifier_id=(select auth.uid()), paid_at=now() where id=p_topup_id;
    begin
      v_bal := credit_wallet(v_t.shop_id, v_t.amount, 'topup', 'topup', p_topup_id::text, 'เติมเงิน PromptPay', (select auth.uid()));
    exception when unique_violation then
      -- เครดิตของรายการนี้เข้าไปแล้วจากอีกเส้น (ตาข่าย wallet_tx_topup_once)
      -- ไม่ใช่ความผิดพลาด ให้ถือว่าสำเร็จแล้วเดินต่อ ไม่งั้นแถวค้างในคิวตลอดไป
      v_already := true;
      select balance into v_bal from wallets where shop_id = v_t.shop_id;
    end;
    if v_t.slip_trans_ref is not null then
      insert into slip_refs (trans_ref, shop_id, source) values (v_t.slip_trans_ref, v_t.shop_id, 'topup')
      on conflict (trans_ref) do nothing;
    end if;
    insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id, details)
      values (v_t.shop_id, 'user', (select auth.uid())::text, 'topup_confirmed', 'topups', p_topup_id::text,
        jsonb_build_object('amount', v_t.amount, 'balance', v_bal, 'already_credited', v_already));
    return jsonb_build_object('ok', true, 'balance', v_bal, 'already_credited', v_already);
  else
    -- ล้างเลขอ้างอิงสลิปคืน — สลิปที่โอนเงินจริงต้องเอากลับมาใช้กับรายการใหม่ได้
    update topups set status='rejected', verified_by='manual', verifier_id=(select auth.uid()),
                      slip_trans_ref = null
      where id=p_topup_id;
    insert into audit_logs (shop_id, actor_type, actor_id, action, resource_type, resource_id)
      values (v_t.shop_id, 'user', (select auth.uid())::text, 'topup_rejected', 'topups', p_topup_id::text);
    return jsonb_build_object('ok', true, 'rejected', true);
  end if;
end $function$;
