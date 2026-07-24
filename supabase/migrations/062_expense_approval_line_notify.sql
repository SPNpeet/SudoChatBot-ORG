-- 062: Approval Flow ค่าใช้จ่าย + ตั้งค่าแจ้งเตือน LINE (Messaging API)
--   หลักการ: พนักงาน (role agent) บันทึกค่าใช้จ่าย -> เข้าคิว "รออนุมัติ" (ยังไม่ลงบัญชี)
--   owner/admin กดอนุมัติ -> ระบบตั้งหนี้ลงสมุดรายวันตอนนั้น (อนุมัติก่อน ค่อยจ่าย)
--   เจ้าของ/แอดมินบันทึกเอง = ไม่ต้องอนุมัติ (ธุรกิจคนเดียวไม่สะดุด)

-- ---- (1) สถานะอนุมัติบน fin_docs ----
alter table fin_docs
  add column if not exists approval_status text not null default 'none',
  add column if not exists approval_by uuid,
  add column if not exists approval_at timestamptz,
  add column if not exists approval_note text;

do $$ begin
  alter table fin_docs add constraint fin_docs_approval_status_chk
    check (approval_status in ('none','pending','approved','rejected'));
exception when duplicate_object then null; end $$;

create index if not exists idx_fin_docs_approval_pending
  on fin_docs (shop_id) where approval_status = 'pending';

-- ---- (2) ตั้งค่าแจ้งเตือนต่อกิจการ (LINE Messaging API — LINE Notify ปิดบริการแล้ว มี.ค. 2025) ----
-- token เป็นความลับ: RLS เปิดแต่ไม่มี policy = service role เท่านั้น client อ่านไม่ได้
create table if not exists shop_notify_settings (
  shop_id uuid primary key references shops(id) on delete cascade,
  line_channel_token text,          -- Channel access token (long-lived) จาก LINE Developers Console
  line_to_id text,                  -- User ID / Group ID ปลายทาง (U... หรือ C...)
  notify_approval boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table shop_notify_settings enable row level security;
