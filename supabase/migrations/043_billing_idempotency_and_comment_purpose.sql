-- 043: (1) กันหักเงินซ้ำเมื่อ pgmq retry ข้อความเดิม (AI ล่มกลางทาง = โดนบิลได้ถึง 4 รอบ)
--      (2) แยก purpose 'comment' ไม่ให้ log คอมเมนต์กินโควตา playground ของร้าน

-- ตาราง dedupe การบิลต่อ ref (message id / comment id)
create table if not exists billed_refs (
  ref text primary key,
  shop_id uuid not null,
  created_at timestamptz not null default now()
);
alter table billed_refs enable row level security; -- ไม่มี policy = service role เท่านั้น (ตั้งใจ)
create index if not exists billed_refs_created_idx on billed_refs (created_at);

-- ล้าง ref เก่าทุกวัน (เก็บ 7 วันพอ — retry window ของ pgmq สั้นกว่านั้นมาก)
select cron.schedule('cleanup_billed_refs', '30 19 * * *',
  $$ delete from public.billed_refs where created_at < now() - interval '7 days'; $$);

-- เปลี่ยน signature: drop ตัวเก่าก่อน กัน overload ambiguity ใน PostgREST
drop function if exists public.bill_bot_reply(uuid);

create or replace function public.bill_bot_reply(p_shop_id uuid, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_period text := current_period();
  v_plan record; v_used int; v_bal numeric; v_price numeric;
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

  if v_used < v_plan.included_replies then
    update usage_monthly set replies_count = replies_count + 1 where shop_id = p_shop_id and period = v_period;
    return jsonb_build_object('allowed', true, 'billed', false, 'remaining_free', v_plan.included_replies - v_used - 1);
  end if;

  v_price := v_plan.price_per_extra_reply;
  select balance into v_bal from wallets where shop_id = p_shop_id for update;
  if coalesce(v_bal,0) >= v_price then
    update wallets set balance = balance - v_price, updated_at = now() where shop_id = p_shop_id returning balance into v_bal;
    update usage_monthly set replies_count = replies_count + 1, billed_replies = billed_replies + 1,
      billed_amount = billed_amount + v_price where shop_id = p_shop_id and period = v_period;
    insert into wallet_transactions (shop_id, type, amount, balance_after, ref_type, ref_id, note)
      values (p_shop_id, 'debit', -v_price, v_bal, 'bot_reply', p_ref, 'ค่าบอทตอบเกินโควตา');
    return jsonb_build_object('allowed', true, 'billed', true, 'charged', v_price, 'balance', v_bal);
  else
    -- ปล่อย ref ให้บิลใหม่ได้ถ้ารอบหน้าเครดิตพอ (ลบ ref ที่เพิ่งจอง)
    if p_ref is not null then delete from billed_refs where ref = p_ref; end if;
    return jsonb_build_object('allowed', false, 'reason', 'insufficient_credit',
      'message', 'เครดิตหมดและใช้เกินโควตาแพ็กเกจแล้ว กรุณาเติมเงินหรืออัปเกรดแพ็กเกจ');
  end if;
end $$;

revoke all on function public.bill_bot_reply(uuid, text) from public, anon, authenticated;
grant execute on function public.bill_bot_reply(uuid, text) to service_role;

-- purpose ใหม่ 'comment' — แยก log คอมเมนต์ออกจากโควตา playground (ที่นับ conversation_id is null)
alter table ai_usage_logs drop constraint if exists ai_usage_logs_purpose_check;
alter table ai_usage_logs add constraint ai_usage_logs_purpose_check
  check (purpose = any (array['reply','embedding','ocr','slip_verify','summarize','classify','ads','comment']));
