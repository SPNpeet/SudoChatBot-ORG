#!/bin/sh
# ============================================================
#  รัน migration ทั้งชุดบนฐานข้อมูล "เปล่าจริง" เพื่อพิสูจน์ว่า clone ใหม่สร้างระบบขึ้นมาได้
#
#  ⚠️ ทำไมต้องรันจริง ไม่ใช่แค่ตรวจสถิต (บทเรียน 5 ส.ค. 2569)
#  ด่าน check:migrations ตรวจลำดับไฟล์ได้ แต่จับไม่ได้ว่า:
#   · ฟังก์ชัน LANGUAGE sql ตรวจชื่อตอน create -> baseline เรียงตามตัวอักษรแล้วเรียกของที่ยังไม่มี
#   · migration ที่ "มีแต่คอมเมนต์ ไม่มี SQL" (058) -> คอลัมน์หายทั้งที่ไฟล์ดูเหมือนทำแล้ว
#   · policy ที่ baseline มีอยู่แล้ว แล้ว migration รุ่นเก่าสร้างซ้ำ
#  ครั้งแรกที่รันสคริปต์นี้: 47 จาก 76 ไฟล์ล้มเหลว ทั้งที่ตรวจสถิตผ่านหมด
#
#  ต้องมี Docker · ใช้ image เดียวกับที่ Supabase ใช้จริง (มี pg_cron/pgmq/vector ครบ)
#  ใช้เวลาราว 2-3 นาที · ลบคอนเทนเนอร์ทิ้งทุกครั้งที่จบ · ไม่แตะ production เลย
#
#  วิธีใช้:  sh scripts/migration-dryrun.sh
# ============================================================
set -e
NAME=sc-migtest
IMAGE=supabase/postgres:15.8.1.060

TMPSUM=$(mktemp)
TMPSQL=$(mktemp)
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -f "$TMPSUM" .restore-tmp.sql; }
trap cleanup EXIT

echo ""
echo "  เตรียมฐานข้อมูลเปล่า ($IMAGE)…"
cleanup
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null

i=0
while [ $i -lt 60 ]; do
  docker exec "$NAME" pg_isready -U postgres 2>/dev/null | grep -q accepting && break
  i=$((i+1)); sleep 3
done

# extension ที่ baseline ต้องใช้ — image เตรียม schema cron/net ไว้ก่อนโดยไม่ติดตั้ง extension
# ถ้าไม่ลบ schema ทิ้งก่อน create extension จะชนกันทันที
docker exec "$NAME" psql -U postgres -q -c "drop schema if exists cron cascade; drop schema if exists net cascade;" >/dev/null 2>&1
for e in pg_cron pg_net pgmq vector pg_trgm pgcrypto; do
  docker exec "$NAME" psql -U postgres -q -c "create extension if not exists $e;" >/dev/null 2>&1 || true
done
# storage.buckets ของ image รุ่นนี้ยังไม่มีคอลัมน์ public (ของจริงบน Supabase มี)
docker exec "$NAME" psql -U postgres -q -c "alter table storage.buckets add column if not exists public boolean default false;" >/dev/null 2>&1 || true

docker cp supabase/baseline "$NAME":/tmp/baseline >/dev/null
docker cp supabase/migrations "$NAME":/tmp/migrations >/dev/null

# คำสั่งสรุปผลเก็บเป็นไฟล์ ไม่ฝังใน sh -c '...' เพราะ single quote ใน SQL จะชนกัน
cat > "$TMPSUM" <<'SUMSQL'
select '    ตาราง ' || (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE')
    || ' · policy ' || (select count(*) from pg_policies where schemaname='public')
    || ' · trigger ' || (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)
    || ' · index ' || (select count(*) from pg_indexes where schemaname='public');
SUMSQL
docker cp "$TMPSUM" "$NAME":/tmp/summary.sql >/dev/null

echo "  รัน baseline + migrations ตามลำดับ…"
echo ""
docker exec "$NAME" sh -c '
fail=0; ok=0
for f in /tmp/baseline/*.sql /tmp/migrations/*.sql; do
  if out=$(psql -U postgres -v ON_ERROR_STOP=1 -q -f "$f" 2>&1); then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    echo "  ล้มเหลว $(basename $f): $(echo "$out" | grep -m1 ERROR | cut -c1-120)"
  fi
done
echo ""
echo "  ผลลัพธ์: ผ่าน $ok ไฟล์ · ล้มเหลว $fail ไฟล์"
echo "  โครงสร้างที่ได้:"
psql -U postgres -tAf /tmp/summary.sql
[ "$fail" -eq 0 ] || exit 1
'
# ---- ตรวจว่าไม่มีฟังก์ชันไหน body อ้างของที่ถูกลบไปแล้ว ----
# ⚠️ เกิดจริง 6 ส.ค. 2569: migration 093 ลบคอลัมน์ payment_gateway ทิ้ง
# แต่ platform_billing_public() ยัง select คอลัมน์นั้นอยู่ใน body
# Postgres ไม่ผูก dependency กับ body ของฟังก์ชัน LANGUAGE sql จึง drop ผ่านฉลุย
# ฟังก์ชันเลยพัง "ตอนมีคนเรียก" ไม่ใช่ตอนถูกทำให้พัง = ไม่มีใครรู้จนกว่าลูกค้าจะเจอ
# วิธีตรวจ: สั่งสร้างฟังก์ชันทุกตัวใหม่จากนิยามเดิม ตัวไหน body เพี้ยนจะ error ทันที
echo "  ตรวจ body ของฟังก์ชันทุกตัว…"
docker cp scripts/check-function-bodies.sql "$NAME":/tmp/fnchk.sql >/dev/null
# ⚠️ ต้องดู exit code ของ psql ไม่ใช่ผลของ grep — เขียนครั้งแรกเป็น `| grep` ทำให้
# สถานะที่อ่านได้กลายเป็นของ grep แล้ว "ผ่าน" ทั้งที่ psql ตายไปแล้ว
if ! docker exec "$NAME" sh -c 'psql -U postgres -v ON_ERROR_STOP=1 -q -f /tmp/fnchk.sql' 2>&1; then
  echo "  ตรวจ body ฟังก์ชันไม่ผ่าน — มีฟังก์ชันอ้างถึงคอลัมน์/ตารางที่ถูกลบไปแล้ว"
  exit 1
fi

# ---- ทดสอบกู้ "ข้อมูล" ต่อ ถ้ามีไฟล์สำรองในเครื่อง ----
# โครงสร้างถูกอย่างเดียวไม่พอ — แผนกู้ระบบต้องพิสูจน์ว่าเอาข้อมูลกลับเข้าไปได้จริงด้วย
# (ครั้งแรกที่ทดสอบส่วนนี้เจอคอลัมน์/CHECK ที่มีแต่บน production อีก 7 จุด)
if [ -d backups ] && [ "$(ls backups 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "  ทดสอบกู้ข้อมูลจากไฟล์สำรองล่าสุด…"
  npx tsx scripts/restore-sql.mjs > .restore-tmp.sql 2>/dev/null
  docker cp .restore-tmp.sql "$NAME":/tmp/restore.sql >/dev/null
  if docker exec "$NAME" sh -c 'psql -U postgres -v ON_ERROR_STOP=1 -q -f /tmp/restore.sql' >/dev/null 2>&1; then
    docker cp scripts/restore-verify.sql "$NAME":/tmp/rv.sql >/dev/null
    docker exec "$NAME" sh -c 'psql -U postgres -tAf /tmp/rv.sql'
  else
    echo "  กู้ข้อมูลไม่ผ่าน — ดูรายละเอียด:"
    docker exec "$NAME" sh -c 'psql -U postgres -q -f /tmp/restore.sql 2>&1' | grep -m5 ERROR
    exit 1
  fi
else
  echo "  ข้ามการทดสอบกู้ข้อมูล (ยังไม่มีโฟลเดอร์ backups — รัน npm run backup ก่อน)"
fi

echo ""
echo "  เทียบกับ production (ณ 6 ส.ค. 2569): ตาราง 72 · policy 138 · trigger 25 · index 190"
echo ""
