-- ============================================================
-- 027: เพิ่มค่าย AI — DeepSeek / Qwen (Alibaba) / GLM (Zhipu) / Kimi (Moonshot)
-- รองรับทั้งกรณีคอลัมน์ provider เป็น TEXT+CHECK และกรณีเป็น ENUM
-- เขียนแบบ idempotent — รันซ้ำได้ ไม่พังถ้าไม่มี constraint เดิม
-- ============================================================

DO $$
DECLARE
  con RECORD;
  tbl TEXT;
  udt TEXT;
  v TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ai_settings', 'ai_provider_keys'] LOOP
    SELECT c.udt_name INTO udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name = 'provider';
    IF udt IS NULL THEN CONTINUE; END IF;  -- ไม่มีตาราง/คอลัมน์นี้ ข้าม

    IF udt IN ('text', 'varchar', 'bpchar') THEN
      -- กรณี TEXT: ปลด CHECK เดิมที่อ้าง provider แล้วตั้งใหม่ให้ครบทุกค่าย
      FOR con IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = tbl AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%provider%'
      LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, con.conname);
      END LOOP;
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (provider IN (''anthropic'',''google'',''openai'',''deepseek'',''qwen'',''zhipu'',''moonshot''))',
        tbl, tbl || '_provider_check'
      );
    ELSE
      -- กรณี ENUM: เติมค่าใหม่เข้า type (ADD VALUE ต้องรันนอก transaction ใน Postgres เก่า
      -- แต่ Supabase ใช้ PG15+ ซึ่งรองรับใน DO block ผ่าน dynamic SQL ได้)
      FOREACH v IN ARRAY ARRAY['deepseek', 'qwen', 'zhipu', 'moonshot'] LOOP
        BEGIN
          EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', udt, v);
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'enum % add % skipped: %', udt, v, SQLERRM;
        END;
      END LOOP;
    END IF;
  END LOOP;
END $$;
