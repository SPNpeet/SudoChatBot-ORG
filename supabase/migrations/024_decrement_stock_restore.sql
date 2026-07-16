-- ============================================================
--  024 — decrement_stock รองรับ qty ติดลบ = คืนสต๊อก (ใช้โดย refundOrder)
--  ของเดิม return false เมื่อ qty <= 0 ทำให้ยกเลิก/คืนเงินออเดอร์ไม่คืนสต๊อกจริง
--  (พบจากการทดสอบ synthetic tenant T9)
-- ============================================================
create or replace function public.decrement_stock(p_product_id uuid, p_variant_id uuid, p_qty integer)
returns boolean
language plpgsql
set search_path to 'public'
as $$
declare v_ok boolean := false;
begin
  if p_qty = 0 then return false; end if;

  if p_qty < 0 then
    -- คืนสต๊อก (refund/ยกเลิกออเดอร์) — บวกกลับ ไม่ต้องเช็คขั้นต่ำ
    if p_variant_id is not null then
      update product_variants set stock = stock - p_qty where id = p_variant_id
      returning true into v_ok;
    else
      update products set stock = stock - p_qty where id = p_product_id
      returning true into v_ok;
    end if;
    return coalesce(v_ok, false);
  end if;

  -- ตัดสต๊อก (ห้ามติดลบ)
  if p_variant_id is not null then
    update product_variants set stock = stock - p_qty
    where id = p_variant_id and stock >= p_qty
    returning true into v_ok;
  else
    update products set stock = stock - p_qty
    where id = p_product_id and (not track_stock or stock >= p_qty)
    returning true into v_ok;
  end if;
  return coalesce(v_ok, false);
end $$;
