-- 039: บอทตอบคอมเมนต์ FB/IG → ทัก inbox อัตโนมัติ
-- เปิดสวิตช์เดียว AI อ่านคอมเมนต์แล้วตอบเอง (ต่างจากคู่แข่งที่ต้องตั้ง keyword rule)
alter table bot_settings add column if not exists comment_reply_enabled boolean not null default false;
alter table bot_settings add column if not exists comment_public_reply text default 'ตอบใน DM แล้วนะคะ ❤️';
alter table bot_settings add column if not exists comment_keywords text[] not null default '{}';

-- log + dedupe (Meta ยิง webhook ซ้ำได้ — PK comment_id กันตอบซ้ำ ซึ่งสำคัญเพราะ private reply ส่งได้ 1 ครั้ง/คอมเมนต์)
create table if not exists comment_replies (
  comment_id text primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  channel_id uuid references channels(id) on delete set null,
  post_id text,
  commenter_id text not null,
  comment_text text,
  dm_text text,
  dm_sent boolean not null default false,
  public_replied boolean not null default false,
  status text not null default 'processing' check (status in ('processing','replied','skipped','failed')),
  error text,
  created_at timestamptz not null default now()
);
alter table comment_replies enable row level security;
drop policy if exists comment_replies_member_read on comment_replies;
create policy comment_replies_member_read on comment_replies for select to authenticated
  using (public.is_shop_member(shop_id));
create index if not exists comment_replies_shop_idx on comment_replies (shop_id, created_at desc);

-- คิว pgmq สำหรับ event คอมเมนต์
select pgmq.create('comment_events');
