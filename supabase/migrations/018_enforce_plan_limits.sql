-- ============================================================
--  018 — บังคับ limit แพ็กเกจ (แก้ข้อ 2) : ช่องทาง + สมาชิก
--  ทำเป็น trigger กันเลี่ยงผ่าน API ไม่ได้
-- ============================================================
create or replace function public.enforce_channel_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_cnt int;
begin
  select p.max_channels into v_max from shops s join plans p on p.code=s.plan where s.id=new.shop_id;
  select count(*) into v_cnt from channels where shop_id=new.shop_id and status <> 'disconnected';
  if v_cnt >= coalesce(v_max,1) then
    raise exception 'เกินจำนวนช่องทางของแพ็กเกจ (สูงสุด % ช่องทาง) กรุณาอัปเกรดแพ็กเกจ', v_max
      using errcode='check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_channel_limit on public.channels;
create trigger trg_channel_limit before insert on public.channels
  for each row execute function public.enforce_channel_limit();

create or replace function public.enforce_member_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_cnt int;
begin
  select p.max_members into v_max from shops s join plans p on p.code=s.plan where s.id=new.shop_id;
  select count(*) into v_cnt from shop_members where shop_id=new.shop_id;
  if v_cnt >= coalesce(v_max,2) then
    raise exception 'เกินจำนวนสมาชิกของแพ็กเกจ (สูงสุด % คน) กรุณาอัปเกรดแพ็กเกจ', v_max
      using errcode='check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_member_limit on public.shop_members;
create trigger trg_member_limit before insert on public.shop_members
  for each row execute function public.enforce_member_limit();

-- ยกเว้น trigger ตอนสร้างร้าน (owner คนแรก) — เช็ค: ถ้ายังไม่มีสมาชิกเลย ให้ผ่าน
create or replace function public.enforce_member_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_cnt int;
begin
  select count(*) into v_cnt from shop_members where shop_id=new.shop_id;
  if v_cnt = 0 then return new; end if;  -- owner คนแรกผ่านเสมอ
  select p.max_members into v_max from shops s join plans p on p.code=s.plan where s.id=new.shop_id;
  if v_cnt >= coalesce(v_max,2) then
    raise exception 'เกินจำนวนสมาชิกของแพ็กเกจ (สูงสุด % คน) กรุณาอัปเกรดแพ็กเกจ', v_max
      using errcode='check_violation';
  end if;
  return new;
end $$;
