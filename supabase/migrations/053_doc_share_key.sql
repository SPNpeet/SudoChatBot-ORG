-- 053: ลิงก์เอกสารสาธารณะ (ส่งใบแจ้งหนี้/ใบเสร็จให้ลูกค้า + จ่ายผ่าน QR + อัปสลิป)
alter table public.fin_docs add column if not exists share_key uuid not null default gen_random_uuid();
create unique index if not exists fin_docs_share_key_uniq on public.fin_docs (share_key);
