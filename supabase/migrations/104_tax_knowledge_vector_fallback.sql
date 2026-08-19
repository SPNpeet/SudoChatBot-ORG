-- ============================================================
--  ค้นด้วยเวกเตอร์ไม่เจอ ให้ถอยไปค้นด้วยข้อความ — บั๊กที่เจอตอนตรวจย้อน 19 ส.ค. 2569
--
--  ⚠️ ของเดิมผิดตรงไหน
--  เงื่อนไข `(p_embedding is null or k.embedding is not null)` แปลว่า
--  "ถ้าส่งเวกเตอร์มา ให้ดูเฉพาะแถวที่มีเวกเตอร์" — แถวที่ยังไม่ได้สร้างเวกเตอร์
--  จะถูกตัดทิ้งเงียบ ๆ ทั้งที่ตอบคำถามนั้นได้อยู่แล้ว
--
--  สภาพจริงตอนตรวจ: 8 แถวในคลัง มีเวกเตอร์ 0 แถว
--  -> ถ้า embedText ทำงานสำเร็จเมื่อไหร่ การค้นจะได้ผลว่างทุกคำถามทันที
--  แปลว่าฟีเจอร์นี้ใช้งานได้อยู่ทุกวันนี้เพราะ "บังเอิญยังไม่มีคีย์ embedding" เท่านั้น
--  และวันที่กดสร้างเวกเตอร์สำเร็จแค่บางส่วน (เช่น 3 จาก 8) อีก 5 เรื่องจะหายจากการค้น
--  โดยไม่มี error ไม่มีใครรู้ — ผู้ช่วยจะตอบ "ไม่มีข้อมูลยืนยัน" อย่างสุภาพทุกครั้ง
--
--  ⚠️ ทิศทางของการแก้: เพิ่มโอกาส "หาเจอของที่มีจริง" ไม่ใช่เพิ่มโอกาสเดา
--  เกณฑ์ตัดยังอยู่ครบทั้งสองทาง คำถามที่ไม่เกี่ยวยังคืนว่างเหมือนเดิม (กติกาข้อ 7)
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
  v_n int := 0;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;

  if p_embedding is not null then
    return query
    select s.* from (
      select k.topic, k.content, k.citation, k.source_url, k.effective_from, k.effective_to,
        (1 - (k.embedding <=> p_embedding))::float as sim, 'vector'::text as how
      from public.tax_knowledge k
      where k.effective_from <= v_date
        and (k.effective_to is null or k.effective_to >= v_date)
        and k.embedding is not null
    ) s
    where s.sim >= p_min_vector
    order by s.sim desc
    limit greatest(1, least(coalesce(p_limit, 4), 8));

    get diagnostics v_n = row_count;
    if v_n > 0 then return; end if;
  end if;

  return query
  select s.* from (
    select k.topic, k.content, k.citation, k.source_url, k.effective_from, k.effective_to,
      word_similarity(coalesce(p_query, ''), k.topic || ' ' || k.keywords || ' ' || k.content)::float as sim,
      'text'::text as how
    from public.tax_knowledge k
    where k.effective_from <= v_date
      and (k.effective_to is null or k.effective_to >= v_date)
  ) s
  where s.sim >= p_min_text
  order by s.sim desc
  limit greatest(1, least(coalesce(p_limit, 4), 8));
end $function$;

revoke all on function public.search_tax_knowledge(text, vector, int, date, float, float) from public, anon;
grant execute on function public.search_tax_knowledge(text, vector, int, date, float, float) to authenticated, service_role;
