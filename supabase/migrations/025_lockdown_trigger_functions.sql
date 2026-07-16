-- ============================================================
--  025 — ปิดสิทธิ์เรียก trigger functions ผ่าน RPC (advisor WARN 0028/0029)
--  trigger ยังทำงานปกติ (fire ในสิทธิ์ของตาราง ไม่ใช้ EXECUTE ของผู้เรียก)
-- ============================================================
revoke execute on function public.enforce_channel_limit() from anon, authenticated, public;
revoke execute on function public.enforce_member_limit() from anon, authenticated, public;
revoke execute on function public.on_plan_change() from anon, authenticated, public;
revoke execute on function public.on_topup_paid_invoice() from anon, authenticated, public;
