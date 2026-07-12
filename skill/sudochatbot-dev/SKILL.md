---
name: sudochatbot-dev
description: >
  พัฒนา ดูแล และต่อยอดระบบ SudoChatBot — B2B2C SaaS แชทบอท AI ปิดการขายสำหรับร้านค้าบน
  Facebook/Instagram/LINE ของ SPNpeet. ใช้ skill นี้เมื่อทำงานกับ repo SPNpeet/SudoChatBot-ORG,
  โฟลเดอร์ C:\SudoChatBot, Supabase project "SudoChatBot" (uafnpbawajgonarvlurj),
  แก้ไข edge functions (webhook-meta, webhook-line, queue-worker, doc-processor, slip-verifier),
  Dashboard Next.js, ระบบ PromptPay/ตรวจสลิป, RAG คลังความรู้, หรือเมื่อผู้ใช้พูดถึง
  "SudoChatBot", "บอทปิดการขาย", "แชทบอทร้านค้า" ของโปรเจกต์นี้
---

# SudoChatBot — คู่มือนักพัฒนา (Single Source of Truth)

ตอบผู้ใช้เป็นภาษาไทยเสมอ ทำงานแบบ perfectionist: แก้อะไรต้อง typecheck ผ่าน, migration ต้องมีเลขรัน, deploy แล้วต้องตรวจ log

## 1) แผนที่ระบบ (IDs สำคัญ)
| สิ่ง | ค่า |
|---|---|
| Supabase project | `uafnpbawajgonarvlurj` (region ap-southeast-1) |
| Supabase URL | `https://uafnpbawajgonarvlurj.supabase.co` |
| GitHub repo | `SPNpeet/SudoChatBot-ORG` (branch `main`) |
| โค้ดบนเครื่องผู้ใช้ | `C:\SudoChatBot` (mount: `/sessions/<session>/mnt/c/SudoChatBot`) |
| git repo ใน sandbox | `~/sudochatbot-repo` (mount ใช้ git ตรงๆ ไม่ได้ — ไฟล์ .git จะพัง ให้ sync ด้วย tar แล้ว commit/push จาก sandbox) |
| Stack | Next.js 15 + TS + Tailwind v4 (Vercel) / Supabase ทั้ง backend / Claude API / Gemini embeddings 1536 / Google Document AI OCR |

## 2) สถาปัตยกรรม 1 ย่อหน้า
ข้อความลูกค้า → `webhook-meta`|`webhook-line` (ตรวจ HMAC → **insert `webhook_events` ก่อนเสมอ** → `queue_send('incoming_messages')` → ตอบ 200 → kick worker) → `queue-worker` อ่าน pgmq → upsert customer/conversation → insert message (กันซ้ำด้วย unique `platform_message_id`) → ถ้ารูป+มีออเดอร์รอจ่าย → คิว `slip_verification`; ไม่งั้น `runSalesAgent()` (Claude tool-use: search_products / get_product / search_knowledge / upsert_order / request_payment / handoff_to_human) → ส่งตอบผ่าน platform API (token จาก Vault) → ล้มเหลวเข้าคิว `outbound_messages` retry สูงสุด 5 ครั้ง. `doc-processor`: storage → Document AI OCR → chunk 1200/150 → Gemini embed (normalize!) → `knowledge_chunks`. `slip-verifier`: EasySlip/SlipOK → เช็คยอด±0.01 → กันสลิปซ้ำ (unique `slip_trans_ref` global) → order paid → `decrement_stock` → ขอบคุณลูกค้า. pg_cron ปลุก 3 workers ทุกนาที + `rollup_daily_analytics` 00:15 ไทย

## 3) กติกาเหล็ก (ห้ามละเมิด)
1. **ราคา/สต๊อก/ยอดรวม คำนวณฝั่ง server เท่านั้น** — AI ห้ามกำหนดตัวเลขเอง ทำได้แค่เรียก tool
2. **ทุก webhook เขียน raw ลง `webhook_events` ก่อนประมวลผล** — zero message loss
3. **Server Action ต้อง `assertMember(shopId, roles)` ก่อนแตะ service client เสมอ**
4. ทุกตาราง tenant มี `shop_id` + RLS pattern: `is_shop_member()` (select) / `has_shop_role()` (write, แยก ins/upd/del คนละ policy — อย่าใช้ for all จะโดน advisor)
5. Token ทุกชนิดอยู่ Vault ผ่าน RPC `store_channel_token`/`get_channel_token`/`store_shop_slip_key`/`get_shop_slip_key` (service_role เท่านั้น)
6. pgmq ใช้ผ่าน wrapper `queue_send/read/delete/archive` (service_role เท่านั้น)
7. embeddings = `gemini-embedding-001` มิติ 1536 + **normalize เวกเตอร์เสมอ** (MRL truncation)
8. ห้าม commit secrets — anon key เป็น public ได้, service_role key อยู่เฉพาะ Vercel env + edge runtime

## 4) Edge Functions — วิธี deploy ผ่าน Supabase MCP (สำคัญมาก)
- โครง local: `supabase/functions/{fn}/index.ts` import จาก `../_shared/*.ts`
- **ตอน deploy ผ่าน MCP ต้องแปลง**: ใส่ไฟล์ shared เป็นชื่อ `_shared/x.ts` ในบันเดิล และแก้ import ใน index.ts เป็น `./_shared/x.ts` (ไฟล์ใน _shared อ้างกันเองด้วย `./x.ts` อยู่แล้ว ไม่ต้องแก้)
- `verify_jwt`: **false เฉพาะ** webhook-meta/webhook-line (ตรวจลายเซ็นเองใน handler) — ที่เหลือ true
- ตรวจหลัง deploy: `get_logs(service=edge-function)` ต้องเห็น 200 จาก cron ทุกนาที
- ไฟล์ shared ต่อ function: webhooks={supabase,utils,types} / queue-worker=+{ai,meta,line,embeddings,promptpay} / doc-processor=+{ocr,embeddings} / slip-verifier=+{slip,line,meta}

## 5) Database — จุดที่ต้องรู้
18 ตารางหลัก: profiles, shops, shop_members(RBAC), channels, customers, conversations(active เดียว/ลูกค้า), messages, knowledge_documents/chunks(vector), products/variants(vector), shop_counters, orders(closed_by:bot⭐), order_items, payments(slip dedupe), shop_payment_settings, webhook_events(deny-all client), bot_settings, ai_usage_logs, audit_logs, daily_analytics
- Migration ถัดไปเริ่มที่ `013_...` (apply ผ่าน MCP `apply_migration`; 001-012 อยู่ใน Supabase แล้ว ดึงด้วย `supabase db pull`)
- RPC สำคัญ: `next_order_number(shop)`, `decrement_stock(prod,variant,qty)` (กันติดลบ), `match_knowledge_chunks(shop,vec,k,min)`, `match_products`, `search_products(shop,q,limit)` (trgm), `rollup_daily_analytics(date)`
- หลังแก้ schema: รัน `get_advisors(security)` + `(performance)` แล้วแก้ WARN ทุกตัว (ยกเว้น: webhook_events no-policy = ตั้งใจ, membership fns exec by authenticated = จำเป็นต่อ RLS)

## 6) Secrets (Supabase → Edge Functions → Secrets)
`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DOCAI_PROCESSOR`, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` (+ optional `MODEL_ECONOMY/STANDARD/PREMIUM`)
Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_ID/SECRET`, `GEMINI_API_KEY`

## 7) สูตรงานที่ทำบ่อย
- **แก้บุคลิก/พฤติกรรมบอท**: `_shared/ai.ts` → `buildSystemPrompt()` → deploy queue-worker ใหม่
- **เพิ่มหน้า Dashboard**: สร้าง `src/app/dashboard/<page>/page.tsx` (server component + `getCurrentShop()`) + action ใน `actions.ts` + เมนูใน `layout.tsx` → `npx tsc --noEmit` ต้องผ่าน
- **ทดสอบระบบ**: ใช้สคริปต์ E2E แบบ synthetic tenant (สร้าง auth.users→shop→ทดสอบ→ลบทิ้ง) ผ่าน `execute_sql` — ดูตัวอย่างเต็มใน commit history
- **build ใน sandbox**: `next build` จะ Bus error (SWC) — ใช้ `npx tsc --noEmit` เป็นเกณฑ์ + ให้ Vercel build จริง
- **push GitHub**: sync mount→`~/sudochatbot-repo` ด้วย tar (exclude .git,node_modules) → commit → push ด้วย token ผู้ใช้ (อย่า echo token)

## 8) งานค้าง / Roadmap
- [ ] Vercel deploy ครั้งแรก + ตั้ง Auth providers (FB/Google) + Site URL
- [ ] Meta App Review (permissions รายการอยู่ใน docs/SETUP-META.md) — dev mode ทดสอบกับเพจตัวเองได้ทันที
- [ ] Google Document AI processor + service account (docs/GO-LIVE.md ขั้น 4)
- [ ] TikTok = Phase ถัดไป (ต้องเป็น TikTok partner)
- [ ] SaaS billing คิดเงินร้านค้า (โครง plan/quota อยู่ใน shops.plan แล้ว)
- [ ] Product variants UI (schema พร้อมแล้ว ยังไม่มีฟอร์มใน dashboard)
