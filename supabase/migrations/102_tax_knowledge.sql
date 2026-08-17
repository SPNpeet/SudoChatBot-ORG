-- ============================================================
--  คลังความรู้ภาษีไทยที่อ้างอิงได้ (RAG) — ของกลางทั้งแพลตฟอร์ม ไม่ใช่ของกิจการใดกิจการหนึ่ง
--
--  ⚠️ ทำไมไม่ใช้ knowledge_chunks ที่มีอยู่แล้ว
--  ตารางนั้น shop_id NOT NULL = คลังความรู้ "ของแต่ละร้าน" (ยุคแชทบอทขายของ)
--  ความรู้ภาษีเป็นของกลาง ทุกกิจการต้องเห็นชุดเดียวกัน ถ้ายัดลงตารางนั้นต้องปลอม shop_id
--  แล้ว RLS จะพังหรือกลายเป็นข้อมูลซ้ำ 32 ชุดที่แก้ไม่ทั่ว
--
--  ⚠️ กติกาข้อ 7 ของโปรเจกต์บังคับรูปร่างของตารางนี้:
--    "กฎถาวร → โค้ด · ประกาศที่มีวันหมดอายุ → ตาราง · พ้นช่วงที่ยืนยันไว้ให้คืน 'ไม่รู้' ห้ามเดาต่อ"
--  ทุกแถวจึงต้องมี effective_from เสมอ และการค้นหา "กรองตามวันที่" ที่ระดับฐานข้อมูล
--  ไม่ใช่ฝากให้โมเดลอ่านวันที่เอาเอง — โมเดลอ่านผิดแล้วผู้ใช้ยื่นภาษีผิด
--
--  ⚠️ ทิศที่ผิดแล้วอันตรายคือ "ผ่อนปรนเกินจริง" (กติกาข้อ 7)
--  ค้นไม่เจอ = ต้องได้ผลลัพธ์ว่าง เพื่อให้ผู้ช่วยบอกว่า "ไม่รู้ ให้ปรึกษานักบัญชี"
--  ห้ามออกแบบให้คืนอันที่ "ใกล้เคียงที่สุด" มาเสมอ เพราะคำตอบที่ผิดแต่ฟังดูมั่นใจ
--  อันตรายกว่าคำตอบว่าง — ผู้ใช้เอาไปยื่นจริงแล้วโดนเบี้ยปรับ
-- ============================================================

create table if not exists public.tax_knowledge (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  content text not null,
  -- ที่มาที่อ้างอิงได้จริง เช่น "ประมวลรัษฎากร ม.86/4" — ห้ามว่าง เพราะความรู้ที่อ้างอิงไม่ได้
  -- คือความรู้ที่ตรวจสอบไม่ได้ ซึ่งใช้กับงานภาษีไม่ได้เลย
  citation text not null,
  source_url text,
  effective_from date not null,
  effective_to date,
  tags text[] not null default '{}',
  -- 1536 มิติ = ตรงกับ text-embedding-3-small และตั้ง outputDimensionality ของ Gemini ได้
  embedding vector(1536),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tax_knowledge_period_valid check (effective_to is null or effective_to >= effective_from)
);

comment on table public.tax_knowledge is
  'ความรู้ภาษีไทยที่อ้างอิงได้ ของกลางทั้งแพลตฟอร์ม — ผู้ช่วย AI ค้นผ่าน search_tax_knowledge เท่านั้น';

-- ค้นด้วยเวกเตอร์เมื่อมี embedding · ค้นด้วย trigram เมื่อไม่มี (คีย์ embedding ล่ม/ยังไม่ได้ทำ)
create index if not exists tax_knowledge_embedding_idx
  on public.tax_knowledge using hnsw (embedding vector_cosine_ops);
create index if not exists tax_knowledge_trgm_idx
  on public.tax_knowledge using gin ((topic || ' ' || content) gin_trgm_ops);
create index if not exists tax_knowledge_period_idx
  on public.tax_knowledge (effective_from, effective_to);

alter table public.tax_knowledge enable row level security;

-- อ่านได้ทุกคนที่ล็อกอิน (เป็นความรู้สาธารณะ ไม่ใช่ข้อมูลของกิจการใคร)
drop policy if exists tax_knowledge_read on public.tax_knowledge;
create policy tax_knowledge_read on public.tax_knowledge
  for select to authenticated using (true);

-- แก้ได้เฉพาะผู้ดูแลแพลตฟอร์ม — ความรู้ภาษีผิดหนึ่งบรรทัดกระทบทุกกิจการพร้อมกัน
drop policy if exists tax_knowledge_admin_write on public.tax_knowledge;
create policy tax_knowledge_admin_write on public.tax_knowledge
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ============================================================
--  ค้นหา — กรองช่วงวันที่ที่ระดับฐานข้อมูล ไม่ฝากให้โมเดลตัดสิน
--
--  p_embedding = null -> ใช้ trigram แทน (ยังค้นได้ ไม่เงียบไปทั้งฟีเจอร์เมื่อคีย์ embedding ล่ม)
--
--  ⚠️ สองวิธีนี้ให้คะแนนคนละสเกล ใช้เกณฑ์ตัดค่าเดียวกันไม่ได้เด็ดขาด
--
--  ต้องใช้ word_similarity(คำถาม, เนื้อหา) ไม่ใช่ similarity() — วัดจริง 13 ส.ค. 2569
--  similarity() เทียบทั้งก้อน คำถามสั้นเทียบเนื้อหายาวจึงได้คะแนนต่ำมากทั้งที่ตรงเรื่อง:
--    "หักภาษี ณ ที่จ่ายค่าเช่ากี่เปอร์เซ็นต์" -> เลือกหัวข้อถูก แต่ได้ 0.083
--    "ใบกำกับภาษีต้องมีอะไรบ้าง"              -> เลือกหัวข้อถูก แต่ได้ 0.063
--  ถ้าใช้เกณฑ์ 0.35 กับ similarity() = **คืนว่างทุกคำถาม** ฟีเจอร์ตายเงียบตั้งแต่วันแรก
--
--  ด้วย word_similarity คำถามเดียวกันได้ 0.486 / 0.923 / 0.389 / 0.351 (ถูกหัวข้อ 4/4)
--  ส่วนคำถามที่ไม่เกี่ยวเลย ("วันนี้อากาศเป็นยังไง") ได้ 0.143 -> เกณฑ์ 0.30 แยกขาด
--  ฝั่งเวกเตอร์ cosine ให้คะแนนสูงกว่าโดยธรรมชาติ จึงตั้งเกณฑ์แยกไว้ที่ 0.62
-- ============================================================
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
language plpgsql stable security definer set search_path to 'public', 'extensions' as $function$
declare
  v_date date := coalesce(p_on_date, (now() at time zone 'Asia/Bangkok')::date);
  v_min float := case when p_embedding is null then p_min_text else p_min_vector end;
begin
  -- ต้องล็อกอินก่อน — ความรู้นี้เป็นของลูกค้าที่จ่ายเงิน ไม่ใช่ของสาธารณะบนอินเทอร์เน็ต
  if auth.uid() is null then raise exception 'forbidden'; end if;

  return query
  select * from (
    select k.topic, k.content, k.citation, k.source_url, k.effective_from, k.effective_to,
      (case when p_embedding is null
         then word_similarity(coalesce(p_query, ''), k.topic || ' ' || k.content)
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

drop function if exists public.search_tax_knowledge(text, vector, int, date, float);

revoke all on function public.search_tax_knowledge(text, vector, int, date, float, float) from public, anon;
grant execute on function public.search_tax_knowledge(text, vector, int, date, float, float) to authenticated, service_role;
