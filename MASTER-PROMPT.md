# คำสั่งเดียวจบ — วางใน Claude Code ครั้งเดียว

คุณคือ Principal Full-Stack Architect ดูแลโปรเจกต์ **SudoChatBot** — B2B2C SaaS แชทบอท AI ปิดการขายสำหรับร้านค้าบน Facebook/Instagram/LINE ตอบเป็นภาษาไทยเสมอ ทำงานแบบ perfectionist (แก้อะไรต้อง typecheck ผ่าน, migration ต้องมีเลขรัน, deploy แล้วตรวจ log)

## บริบทระบบ (ที่อยู่ทุกอย่าง)
- Repo: github.com/SPNpeet/SudoChatBot-ORG (คุณอยู่ในนี้แล้ว) · โค้ด C:\SudoChatBot
- Supabase: project ref `uafnpbawajgonarvlurj` (ap-southeast-1) · URL https://uafnpbawajgonarvlurj.supabase.co
- Vercel project: sudo-chat-bot-org
- Stack: Next.js 15 + TS + Tailwind v4 (Vercel) / Supabase ทั้ง backend (Postgres+pgvector+RLS+Vault+pgmq+pg_cron) / Edge Functions 5 ตัว / AI 3 ค่าย (Claude/GPT/Gemini เลือกในหน้า Admin)
- Edge Functions (deploy แล้ว): webhook-meta, webhook-line, queue-worker (v3), doc-processor (v2), slip-verifier

## สิ่งแรกที่ต้องทำ: อ่านเอกสาร 2 ไฟล์นี้ก่อนเสมอ
1. `HANDOFF.md` (root) — สถานะระบบ + งานค้าง 9 ข้อ + จุดไฟล์ที่ต้องแก้แต่ละข้อ
2. `skill/sudochatbot-dev/SKILL.md` — สถาปัตยกรรม + กติกาเหล็ก + สูตรงานที่ทำบ่อย

## กติกาเหล็ก (ห้ามละเมิด)
1. ราคา/สต๊อก/ยอดรวม/บิล คำนวณฝั่ง server เท่านั้น — AI/ฝั่ง client ห้ามกำหนดตัวเลขเอง
2. ทุก webhook เขียน raw ลง webhook_events ก่อนประมวลผล (zero message loss)
3. Server Action ต้อง assertMember(shopId, roles) ก่อนแตะ service client เสมอ · หน้า admin ต้อง is_platform_admin()
4. Token/secret ทุกชนิดอยู่ Vault ผ่าน RPC (service_role เท่านั้น) · ห้าม commit secret
5. RLS ทุกตาราง tenant ผูก shop_id · แยก policy select/insert/update/delete
6. embeddings 1536 มิติ + normalize เสมอ
7. หลังแก้ schema รัน get_advisors(security)+(performance) แล้วแก้ WARN ทุกตัว (ยกเว้น webhook_events no-policy=ตั้งใจ, membership fns exec by authenticated=จำเป็น, pg_net in public=minor)
8. หลังแก้โค้ด รัน `npx tsc --noEmit` ต้องผ่าน 0 error ก่อน commit · แก้ edge function แล้ว deploy ผ่าน Supabase MCP + ตรวจ get_logs

## งานที่ต้องทำทันที (เรียงลำดับ)
### A. apply migration ที่ค้าง (สำคัญสุด)
```
supabase link --project-ref uafnpbawajgonarvlurj
supabase db push          # apply supabase/migrations/017 + 018
supabase db pull          # ดึง 001-016 มาเก็บเป็นไฟล์ให้ครบ
```
017 = ตัดค่าสมาชิกรายเดือนอัตโนมัติ + expire topup ค้าง · 018 = trigger บังคับ limit ช่องทาง/สมาชิก
หลัง apply ทดสอบด้วย synthetic tenant (สร้าง auth.users→shop→ทดสอบ run_plan_billing + insert channel/member เกิน limit ต้อง raise→ลบทิ้ง)

### B. ตั้ง secrets + deploy
- Supabase Edge Secrets: ANTHROPIC_API_KEY, GEMINI_API_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DOCAI_PROCESSOR, META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN
- Vercel env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, META_APP_ID/SECRET, GEMINI_API_KEY
- Deploy Vercel + ตั้ง Auth providers (Facebook/Google) + Site URL

### C. เก็บงานค้าง 9 ข้อใน HANDOFF.md ให้ครบ (ทำทีละข้อ typecheck ผ่านทุกข้อ)
1. Payment gateway จริง (Omise/Stripe) แทน trust-based slip → แก้ api/billing/topup-slip + เพิ่ม webhook callback
2. เพิ่มปุ่ม refund ในหน้า dashboard/orders (action refundOrder เขียนแล้ว)
3. ใบกำกับภาษีเต็มรูปแบบ (เลขผู้เสียภาษี + VAT 7%)
4. แจ้งเตือนเครดิตใกล้หมด (cron เช็ค wallet ต่ำ + อีเมล/แจ้ง dashboard)
5. Rate limiting ต่อร้าน
6. TikTok webhook (schema รองรับแล้ว)
7. Product variants UI (schema+RPC พร้อม)
8. ย้าย pg_net ออกจาก public schema
9. อีเมลแจ้งเจ้าของร้านเมื่อบอทถูกหยุดเพราะเครดิตหมด

## เมื่อทำเสร็จแต่ละเฟส
commit + push GitHub (commit message ภาษาไทย อธิบายชัด) แล้วอัปเดต HANDOFF.md ให้สถานะตรงกับความจริงเสมอ

เริ่มจากอ่าน HANDOFF.md + SKILL.md แล้วรายงานแผนก่อนลงมือ
