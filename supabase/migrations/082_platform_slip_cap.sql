-- 082: เพดานตรวจสลิประดับแพลตฟอร์ม (5 ส.ค. 2569) — apply บน production แล้ว
--
-- ช่องโหว่ที่อุด: ฝั่ง AI มี ai_kill_switch + ai_daily_cap_usd คุมทั้งแพลตฟอร์ม
-- แต่ฝั่งตรวจสลิปมีแค่โควตารายร้าน (check_slip_quota) ไม่มีเพดานกลางเลย
-- แพ็กฟรีของ SlipOK ให้ 100 สลิป/เดือน "ทั้งคีย์" ซึ่งเราใช้เป็นคีย์กลางร่วมกันทุกร้าน
-- ร้านฟรีร้านเดียวใช้ได้ 30 -> 4 ร้านกินหมดโควตาของทุกคนรวมถึงร้านที่จ่ายเงิน
--
-- นับ "ทุกครั้งที่ยิง API" ไม่ใช่เฉพาะครั้งที่ผ่าน เพราะผู้ให้บริการนับตามจำนวนคำขอ
-- ตัดโควตาก่อนยิงเสมอ (เผื่อพลาดฝั่งเกินดีกว่าฝั่งขาด — เกินแค่รอเดือนหน้า ขาดคือจ่ายเงินจริง)
alter table platform_billing_settings
  add column if not exists slip_monthly_cap int not null default 100;

comment on column platform_billing_settings.slip_monthly_cap is
  'เพดานจำนวนครั้งที่เรียก API ตรวจสลิปต่อเดือนของทั้งแพลตฟอร์ม — ค่าเริ่มต้น 100 = แพ็กฟรี SlipOK';

create table if not exists platform_slip_monthly (
  month date primary key,
  calls int not null default 0,
  updated_at timestamptz not null default now()
);
alter table platform_slip_monthly enable row level security;   -- ไม่มี policy = service role เท่านั้น

-- ตรวจ+ตัดโควตาในคำสั่งเดียว (atomic) — กันสองคำขอพร้อมกันเห็นเลขเดียวกันแล้วทะลุเพดาน
create or replace function public.consume_platform_slip()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_month date := date_trunc('month', (now() at time zone 'Asia/Bangkok'))::date;
  v_cap int; v_used int;
begin
  select coalesce(slip_monthly_cap, 100) into v_cap from platform_billing_settings where id = true;
  if v_cap is null then v_cap := 100; end if;
  if v_cap <= 0 then return jsonb_build_object('allowed', false, 'used', 0, 'cap', v_cap); end if;

  insert into platform_slip_monthly (month) values (v_month) on conflict (month) do nothing;
  select calls into v_used from platform_slip_monthly where month = v_month for update;

  if v_used >= v_cap then
    return jsonb_build_object('allowed', false, 'used', v_used, 'cap', v_cap);
  end if;
  update platform_slip_monthly set calls = calls + 1, updated_at = now()
    where month = v_month returning calls into v_used;
  return jsonb_build_object('allowed', true, 'used', v_used, 'cap', v_cap);
end $function$;

-- แพ็กฟรี: ลดโควตาสลิป 30 -> 10 ต่อเดือน
-- เหตุผล: เพดานกลางมีแค่ 100/เดือน ให้ร้านฟรีร้านละ 30 คือตัวเลขที่ขัดกันเองเชิงคณิตศาสตร์
-- 10 ครั้งพอให้เห็นว่าระบบตรวจให้จริง (เหตุผลที่จะอัปเกรด) โดยไม่กินโควตาของร้านที่จ่ายเงิน
-- วัดแล้ว ณ วันแก้: ยังไม่มีใครใช้ตรวจสลิปสักครั้งเดียวทั้งระบบ -> ไม่มีใครเสียประโยชน์
update plans set slip_quota = 10,
  features = '["1 กิจการ","ออกเอกสาร/บัญชี คีย์เองไม่จำกัด","งาน AI 15 คำสั่ง/เดือน","ตรวจสลิปอัตโนมัติ 10 สลิป/เดือน","พนักงานไม่จำกัด"]'::jsonb
where code = 'free';
