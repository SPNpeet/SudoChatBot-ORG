-- ============================================================
--  094 — เก็บบทสนทนาผู้ช่วยบัญชี AI ไว้ฝั่ง server
--
--  ⚠️ ทำไมถึงจำเป็น (6 ส.ค. 2569)
--  เจ้าของแจ้งว่า "AI ตอบไม่ได้เรื่องเลยทุกด้าน ใบเสนอราคาก็ไม่ออกให้"
--  แล้วสั่งว่า "ไปเรียนรู้จากแชทของลูกค้าที่มีอยู่ทั้งหมด"
--  ตรวจแล้วพบว่า **เราไม่มีแชทเก็บไว้เลยแม้แต่ข้อความเดียว** —
--  บทสนทนาอยู่ใน localStorage ของเบราว์เซอร์ลูกค้าเท่านั้น
--  ฝั่งเรามีแค่จำนวน token กับชื่อโมเดลใน ai_usage_logs
--
--  แปลว่าฟีเจอร์ที่เป็นหัวใจของสินค้า เราวัดคุณภาพไม่ได้เลยสักทาง
--  ทุกครั้งที่ลูกค้าบ่นว่า "ตอบไม่ดี" เราได้แต่เดา แก้แบบเดา แล้วก็ไม่รู้ว่าดีขึ้นจริงไหม
--  ตารางนี้เปลี่ยน "ความรู้สึก" ให้เป็น "หลักฐาน"
--
--  ขอบเขตที่ตั้งใจจำกัดไว้:
--   · เก็บ 30 วันแล้วลบอัตโนมัติ (cron) — พอสำหรับไล่ปัญหา ไม่ใช่คลังข้อมูลถาวร
--   · เป็นข้อมูลของกิจการเอง อยู่ในฐานข้อมูลของเราเหมือน fin_docs ไม่ได้ส่งออกไปไหน
--   · RLS: สมาชิกร้านเห็นของร้านตัวเอง · ผู้ดูแลแพลตฟอร์มเห็นทั้งหมดเพื่อซัพพอร์ต
--   · anon เขียน/อ่านไม่ได้เด็ดขาด
-- ============================================================

create table if not exists public.assistant_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid,
  turn_id uuid not null default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- ชื่อ tool ที่ถูกเรียกในเทิร์นนั้น (ไม่เก็บ argument — มีข้อมูลลูกค้าปลายทางเยอะโดยไม่จำเป็น)
  tool_calls text[] not null default '{}',
  model text,
  input_tokens integer,
  output_tokens integer,
  -- ผู้ใช้กดนิ้วโป้งขึ้น/ลง (ยังไม่มีปุ่ม แต่เตรียมช่องไว้ ไม่ต้องแก้ schema ซ้ำ)
  rating smallint check (rating in (-1, 1)),
  created_at timestamptz not null default now()
);

create index if not exists assistant_logs_shop_idx on public.assistant_logs (shop_id, created_at desc);
create index if not exists assistant_logs_created_idx on public.assistant_logs (created_at);
-- ไล่หาเทิร์นที่ "ตอบแล้วไม่ได้เรียก tool อะไรเลย" ได้เร็ว — เคสที่ลูกค้าบ่นบ่อยสุด
create index if not exists assistant_logs_no_tool_idx on public.assistant_logs (created_at desc)
  where role = 'assistant' and tool_calls = '{}';

alter table public.assistant_logs enable row level security;

drop policy if exists assistant_logs_select on public.assistant_logs;
create policy assistant_logs_select on public.assistant_logs for select
  using (public.is_shop_member(shop_id) or public.is_platform_admin());

-- ไม่มี policy insert/update/delete โดยตั้งใจ: เขียนผ่าน service role ในเซิร์ฟเวอร์เท่านั้น
revoke insert, update, delete on public.assistant_logs from anon, authenticated;

-- ---- ลบอัตโนมัติเมื่อครบ 30 วัน ----
create or replace function public.prune_assistant_logs() returns void
language sql security definer set search_path = public as $$
  delete from public.assistant_logs where created_at < now() - interval '30 days';
$$;
revoke execute on function public.prune_assistant_logs() from anon, authenticated, public;
grant execute on function public.prune_assistant_logs() to service_role;

do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'ไม่มี pg_cron ในฐานนี้ — ข้ามการตั้งเวลาลบ (ฐานทดสอบ)';
    return;
  end if;
  perform cron.unschedule('prune_assistant_logs')
    where exists (select 1 from cron.job where jobname = 'prune_assistant_logs');
  perform cron.schedule('prune_assistant_logs', '30 3 * * *', 'select public.prune_assistant_logs()');
end $$;
