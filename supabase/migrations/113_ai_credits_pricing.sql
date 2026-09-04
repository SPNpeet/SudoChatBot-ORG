-- ============================================================
--  113: มาตรวัด "เครดิต AI" + ราคาแพ็กใหม่ (5 ก.ย. 2569 คำสั่งเจ้าของ)
--
--  ทำไม: ของเดิมนับ "จำนวนครั้ง" (count(*) ของ ai_usage_logs) ทุกครั้งเท่ากันหมด
--  อ่านบิลหนึ่งใบที่แพงกว่าแชทสั้น ๆ 3-5 เท่า ก็นับ 1 เท่ากัน = ไม่มีมาตรฐาน
--  และหน้าบ้านโชว์ "15 คำสั่ง/เดือน" ซึ่งเจ้าของบอกว่าดูไม่มืออาชีพและทำให้คนไม่ซื้อ
--
--  ใหม่: ทุกงาน AI มีน้ำหนักเป็น "เครดิต" ตามต้นทุนจริง (ตั้งค่าในโค้ดตอนเขียน log)
--    แชทสั่งงาน 1 ข้อความ = 1 เครดิต (+1 ทุก 30,000 โทเคนที่เกิน — ข้อความยาว/เรียก tool เยอะ)
--    อ่านบิล/ไฟล์ 1 ใบ = 2 เครดิต · นำเข้าสินค้าจากไฟล์ = 3 เครดิต
--  แพ็กกำหนด included_credits ต่อเดือน · ฟังก์ชันด่านรวม credits แทนนับแถว
--
--  ⚠️ คีย์ผลลัพธ์ของ get_ai_quota_status คงเดิม (used_month/cap_month/pct/allowed)
--  เพราะ consume_ai_quota · sidebar · หน้าแพ็กเกจ · notifications อ่านคีย์พวกนี้อยู่
--  ต่างกันแค่ "หน่วย" เปลี่ยนจากครั้งเป็นเครดิต — เพิ่มคีย์ unit ให้หน้าบ้านรู้
--
--  ⚠️ ราคาเปลี่ยนได้เพราะตรวจแล้ว ณ วันนี้ทุกกิจการ (34) อยู่แพ็กฟรี ไม่มีผู้จ่ายอยู่บนแพ็กเดิม
--  FALLBACK ใน src/lib/plans.ts ต้องตรงกับค่านี้ทุกตัว (ด่าน check:ui ดูไม่ถึง — ตรวจด้วยตา)
-- ============================================================

alter table public.plans add column if not exists included_credits int;
alter table public.ai_usage_logs add column if not exists credits int not null default 1;

-- ย้อนหลัง: งานอ่านไฟล์ที่เคยนับ 1 ให้เป็นน้ำหนักจริง (นำเข้าไฟล์ 3 · อ่านบิล 2)
update public.ai_usage_logs set credits = 3 where purpose = 'ocr' and model like 'import/%' and credits = 1;
update public.ai_usage_logs set credits = 2 where purpose = 'ocr' and credits = 1;

-- ราคา/สิทธิ์ใหม่ — 5 แพ็กเดิม รหัสเดิม (โค้ดอ้างรหัสอยู่หลายที่ ห้ามเปลี่ยนรหัส)
update public.plans set price_monthly = 0,    included_credits = 60,    slip_quota = 10,   max_companies = 1,
  features = '["1 กิจการ · พนักงานไม่จำกัด","ออกเอกสาร ลงบัญชี รายงานภาษี คีย์เองไม่จำกัด","เครดิต AI 60/เดือน (สั่งงานได้ราว 60 ครั้ง หรืออ่านบิล 30 ใบ)","ตรวจสลิปอัตโนมัติ 10 สลิป/เดือน"]'::jsonb
  where code = 'free';
update public.plans set price_monthly = 199,  included_credits = 400,   slip_quota = 100,  max_companies = 1,
  features = '["1 กิจการ · พนักงานไม่จำกัด","ทุกอย่างในทดลองใช้ + แจ้งเตือน LINE","เครดิต AI 400/เดือน","ตรวจสลิปอัตโนมัติ 100 สลิป/เดือน","เติมเครดิตเพิ่มได้ 1 บาท/เครดิต"]'::jsonb
  where code = 'starter';
update public.plans set price_monthly = 499,  included_credits = 1500,  slip_quota = 500,  max_companies = 3,
  features = '["สูงสุด 3 กิจการ (แชร์เครดิตร่วมกัน)","ทุกอย่างในเริ่มต้น + ชุดส่งนักบัญชี Excel ครบงวด","เครดิต AI 1,500/เดือน","ตรวจสลิปอัตโนมัติ 500 สลิป/เดือน","ถูกกว่าเจ้าตลาด และได้ผู้ช่วย AI ที่เขาไม่มี"]'::jsonb
  where code = 'professional';
update public.plans set price_monthly = 1290, included_credits = 5000,  slip_quota = 2000, max_companies = 15,
  features = '["สูงสุด 15 กิจการ","ทุกอย่างในธุรกิจ + ไฟล์ยื่นสรรพากร ภ.พ.30 / ภ.ง.ด. (.txt)","เครดิต AI 5,000/เดือน","ตรวจสลิปอัตโนมัติ 2,000 สลิป/เดือน","Audit Log ครบทุกรายการ"]'::jsonb
  where code = 'executive';
update public.plans set price_monthly = 2990, included_credits = 15000, slip_quota = null, max_companies = null,
  features = '["ไม่จำกัดจำนวนกิจการ","ทุกอย่างในสำนักงานบัญชี","เครดิต AI 15,000/เดือน","ตรวจสลิปอัตโนมัติไม่จำกัด","แยกข้อมูลลูกค้าเด็ดขาด (RLS) + ดูแลเฉพาะทาง"]'::jsonb
  where code = 'agency';
-- เผื่อแพ็กที่ไม่ได้ตั้ง: ใช้ค่าเดิม (นับครั้ง) ต่อไป ไม่ให้ด่านพัง
update public.plans set included_credits = included_replies where included_credits is null;
-- เครดิตเพิ่ม 1 บาท/เครดิต ทุกแพ็กที่เปิดขาย
update public.plans set price_per_extra_reply = 1 where active and code in ('free','starter','professional','executive','agency');

create or replace function public.get_ai_quota_status(p_shop_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $function$
declare
  v_owner uuid;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  v_daily_cap int; v_monthly_cap int; v_override int;
  v_used_today int; v_used_month int;
  v_pct numeric := 0;
  v_allowed boolean := true;
  v_reason text := null;
begin
  if auth.uid() is not null and not public.is_shop_member(p_shop_id) then return null; end if;

  select owner_id into v_owner from shops where id = p_shop_id;
  if v_owner is null then return null; end if;

  -- เพดานเป็น "เครดิต" — แพ็กที่ยังไม่ตั้ง included_credits ถอยไปใช้ included_replies (นับครั้งเดิม)
  select p.daily_reply_cap, nullif(coalesce(p.included_credits, p.included_replies), 0)
    into v_daily_cap, v_monthly_cap
  from shops s join plans p on p.code = s.plan
  where s.owner_id = v_owner and s.status = 'active'
  order by p.price_monthly desc, coalesce(p.included_credits, p.included_replies) desc limit 1;

  select max(ai_quota_override) into v_override from shops where owner_id = v_owner;
  if v_override is not null then v_daily_cap := v_override; end if;

  -- รวม "เครดิต" ไม่ใช่นับแถว — อ่านบิล 2 · นำเข้าไฟล์ 3 · แชท 1 (+ตามความยาว)
  select coalesce(sum(l.credits), 0) into v_used_today from ai_usage_logs l
    join shops s on s.id = l.shop_id
  where s.owner_id = v_owner and l.purpose in ('assistant', 'ocr') and l.created_at >= v_day_start;

  select coalesce(sum(l.credits), 0) into v_used_month from ai_usage_logs l
    join shops s on s.id = l.shop_id
  where s.owner_id = v_owner and l.purpose in ('assistant', 'ocr') and l.created_at >= v_month_start;

  if v_daily_cap is not null and v_daily_cap > 0 then
    v_pct := greatest(v_pct, v_used_today::numeric / v_daily_cap);
    if v_used_today >= v_daily_cap then v_allowed := false; v_reason := 'daily'; end if;
  end if;
  if v_monthly_cap is not null and v_monthly_cap > 0 then
    v_pct := greatest(v_pct, v_used_month::numeric / v_monthly_cap);
    if v_used_month >= v_monthly_cap then v_allowed := false; v_reason := 'monthly'; end if;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed, 'reason', v_reason,
    'used_today', v_used_today, 'cap_today', v_daily_cap,
    'used_month', v_used_month, 'cap_month', v_monthly_cap,
    'pct', least(1, round(v_pct, 4)),
    'unit', 'credits'
  );
end $function$;

-- rollback: ย้อน get_ai_quota_status เป็น count(*) จาก migration ก่อนหน้า ·
--   alter table ai_usage_logs drop column credits · alter table plans drop column included_credits
--   (ราคาเดิม: free 0/15 · starter 99/100 · professional 199/400 · executive 499/1000 · agency 999/3000)
