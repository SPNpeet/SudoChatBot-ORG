-- ============================================================
--  คำที่ผู้ใช้พิมพ์จริง — ตัวเชื่อมระหว่างภาษาคนกับภาษากฎหมาย
--
--  ⚠️ ทำไมต้องมี (วัดจริง 13 ส.ค. 2569)
--  เนื้อหาในคลังเขียนด้วยภาษากฎหมาย ("ค่าเช่าทรัพย์สิน" "ภาษีซื้อต้องห้าม")
--  แต่ผู้ใช้พิมพ์ด้วยภาษาคน ("เช่าโกดัง" "ซื้อรถกระบะเอาแวทมาหักได้ไหม")
--  การค้นแบบเทียบข้อความจึงพลาด เพราะไม่มีคำที่ผู้ใช้พิมพ์อยู่ในเนื้อหาเลยสักคำ
--
--  ทดสอบด้วยคำถามแบบที่ลูกค้าถามจริง 6 ข้อ:
--    ก่อนมีคอลัมน์นี้  -> ตอบถูก **1 ใน 6** (และ 5 ข้อที่เหลือเลือกหัวข้อผิดด้วย)
--    หลังมีคอลัมน์นี้  -> ตอบถูก **6 ใน 6** ทุกข้ออยู่อันดับ 1 คะแนน 0.333-0.538
--
--  ⚠️ นี่ไม่ใช่ของประดับที่ไว้ค่อยเติมทีหลัง — ถ้าไม่มี ผู้ช่วยจะตอบ "ไม่มีข้อมูลยืนยัน"
--  กับคำถามที่คลังมีคำตอบอยู่จริง ๆ ซึ่งแย่กว่าไม่มีคลังเลย เพราะเราจะนึกว่าคลังไม่ครบ
--  แล้วไปเติมเนื้อหาเพิ่มเรื่อย ๆ ทั้งที่ปัญหาอยู่ที่หาไม่เจอ ไม่ใช่ไม่มี
--
--  เวกเตอร์ช่วยเรื่องนี้ได้เองโดยธรรมชาติ (เข้าใจความหมาย ไม่ใช่ตัวอักษร)
--  แต่คอลัมน์นี้ทำให้ระบบใช้ได้ทันทีตั้งแต่ก่อนมีเวกเตอร์ และยังช่วยตอนเวกเตอร์พลาด
-- ============================================================
alter table public.tax_knowledge
  add column if not exists keywords text not null default '';

comment on column public.tax_knowledge.keywords is
  'คำที่ผู้ใช้พิมพ์จริงแต่ไม่มีในเนื้อหา (คำเรียกชาวบ้าน ชื่อของที่พบบ่อย คำถามที่ถามบ่อย) คั่นด้วยเว้นวรรค';

-- index เดิมสร้างจาก (topic || ' ' || content) ต้องรวม keywords ด้วย ไม่งั้นค้นแล้วไม่ได้ใช้ index
drop index if exists tax_knowledge_trgm_idx;
create index tax_knowledge_trgm_idx
  on public.tax_knowledge using gin ((topic || ' ' || keywords || ' ' || content) gin_trgm_ops);

create or replace function public.search_tax_knowledge(
  p_query text,
  p_embedding vector(1536) default null,
  p_limit int default 4,
  p_on_date date default null,
  p_min_vector float default 0.62,
  p_min_text float default 0.30
)
returns table (
  topic text, content text, citation text, source_url text,
  effective_from date, effective_to date, similarity float, matched_by text
)
-- ⚠️ search_path ต้องมี 'extensions' ด้วย — pg_trgm กับ vector ติดตั้งอยู่ schema นั้น
-- ตั้งแค่ 'public' จะหา word_similarity / <=> ไม่เจอ **ตอนรันจริง** (เกิดจริง 13 ส.ค. 2569)
-- plpgsql ไม่ตรวจ body ตอน create ฟังก์ชันจึงสร้างผ่านเงียบ ๆ แล้วไปพังตอนผู้ใช้ถามจริง
language plpgsql stable security definer set search_path to 'public', 'extensions' as $function$
declare
  v_date date := coalesce(p_on_date, (now() at time zone 'Asia/Bangkok')::date);
  v_min float := case when p_embedding is null then p_min_text else p_min_vector end;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;

  return query
  select * from (
    select k.topic, k.content, k.citation, k.source_url, k.effective_from, k.effective_to,
      (case when p_embedding is null
         -- keywords ต้องอยู่ในสตริงที่เทียบ ไม่งั้นคำที่ผู้ใช้พิมพ์จริงจะไม่มีวันแมตช์
         then word_similarity(coalesce(p_query, ''), k.topic || ' ' || k.keywords || ' ' || k.content)
         else 1 - (k.embedding <=> p_embedding) end)::float as sim,
      (case when p_embedding is null then 'text' else 'vector' end)::text as how
    from public.tax_knowledge k
    where k.effective_from <= v_date
      and (k.effective_to is null or k.effective_to >= v_date)
      and (p_embedding is null or k.embedding is not null)
  ) s
  where s.sim >= v_min
  order by s.sim desc
  limit greatest(1, least(coalesce(p_limit, 4), 8));
end $function$;

revoke all on function public.search_tax_knowledge(text, vector, int, date, float, float) from public, anon;
grant execute on function public.search_tax_knowledge(text, vector, int, date, float, float) to authenticated, service_role;

-- ============================================================
--  ตัวช่วยตรวจว่าคลัง "ค้นเจอจริง" — ใช้โดยด่าน scripts/check-tax-kb.mjs
--
--  ⚠️ ต้องคิดคะแนนด้วย **นิพจน์เดียวกับ search_tax_knowledge เป๊ะ**
--  ถ้าด่านคำนวณเองฝั่ง node แล้วสูตรเพี้ยนจากของจริงแม้นิดเดียว
--  ด่านจะบอกว่า "ผ่าน" ทั้งที่ระบบจริงค้นไม่เจอ = ด่านที่โกหก แย่กว่าไม่มีด่าน
--
--  ไม่เปิดให้ authenticated เพราะไม่ใช่ฟีเจอร์ของผู้ใช้ เป็นเครื่องมือตรวจของเรา
-- ============================================================
create or replace function public.tax_kb_match_debug(p_query text)
returns table (topic text, sim float)
language sql stable security definer set search_path to 'public', 'extensions' as $function$
  select k.topic,
         word_similarity(coalesce(p_query, ''), k.topic || ' ' || k.keywords || ' ' || k.content)::float
  from public.tax_knowledge k
  where k.effective_from <= (now() at time zone 'Asia/Bangkok')::date
    and (k.effective_to is null or k.effective_to >= (now() at time zone 'Asia/Bangkok')::date)
  order by 2 desc;
$function$;

revoke all on function public.tax_kb_match_debug(text) from public, anon, authenticated;
grant execute on function public.tax_kb_match_debug(text) to service_role;
