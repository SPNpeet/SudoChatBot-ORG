# ตรวจข้อเสนอ "Infrastructure Checklist" (เอกสารภายนอก) เทียบกับระบบจริง

> บริบท: มีเอกสาร checklist จาก AI ภายนอก (Gemini) เสนอสถาปัตยกรรม "100% Free Tier" ให้ SudoChatBot
> เอกสารนี้ตรวจทีละข้อเทียบกับ**โค้ดจริงในรีโปนี้** — อะไรมีอยู่แล้ว อะไรที่เอกสารเข้าใจผิด และอะไรที่หยิบมาปรับใช้จริง
> อัปเดต: 2026-07-21

## สรุปผลตรวจ 1 บรรทัด
ข้อเสนอ 5 ข้อ: **2 ข้อระบบทำไปแล้ว (ลึกกว่าที่เสนอ) · 1 ข้ออธิบายสถาปัตยกรรมที่ไม่มีอยู่จริง · 2 ข้อ "ต้องสมัครเพิ่ม" ไม่จำเป็นกับสถาปัตยกรรมจริง (ปัญหาที่มันแก้ ถูกแก้ไปแล้วด้วยวิธีที่แข็งแรงกว่า)** — สิ่งเดียวที่มีประโยชน์จริงคือคำเตือนเรื่อง timeout ซึ่งนำมาปรับใช้แล้ว (`maxDuration` ทุก AI route)

## ตรวจทีละข้อ

### ข้อ 1 — "Vercel host Next.js + FastAPI/Python serverless" ❌ ผิดข้อเท็จจริง
ระบบนี้**ไม่มี FastAPI/Python แม้แต่บรรทัดเดียว** backend จริงคือ:
- Next.js 15 Server Actions + Route Handlers (TypeScript) บน Vercel — ดู `src/app/**/actions.ts`, `src/app/api/**`
- Supabase Edge Functions (Deno) สำหรับงานหนัก/webhook: `webhook-meta`, `webhook-line`, `webhook-tiktok`, `queue-worker`, `doc-processor`, `slip-verifier`, `ads-watchdog`
- **จุดสำคัญที่เอกสารพลาด**: webhook จาก Meta/LINE/TikTok **ไม่วิ่งเข้า Vercel เลย** — วิ่งเข้า Supabase Edge Functions ตรง (คนละ origin) ดังนั้นข้อเสนอเอา Cloudflare ครอบ Vercel เพื่อ "ป้องกัน webhook" จึงป้องกันผิดประตู
- ✅ สิ่งที่หยิบมาใช้: เช็ค timeout — เพิ่ม `export const maxDuration` แล้วที่ ads (90s), orders (120s), playground/settings (60s), tracking-extract + import-extract (120s อยู่แล้ว)

### ข้อ 2 — "เปิด pgvector / เปิด RLS / เขียน tenant isolation policy" ✅ มีครบมานานแล้ว และลึกกว่าที่เสนอ
- pgvector: ใช้จริงใน production — `knowledge_chunks.embedding`, `products.embedding` (1536 มิติ) + RPC `match_knowledge_chunks`, `match_products` (semantic RAG ที่บอทใช้ตอบทุกวัน)
- RLS: **ทุกตาราง** (~76 policies) แยกข้อมูลรายร้านด้วย `is_shop_member()` / `has_shop_role()` — ผ่าน synthetic-tenant UAT (สร้างร้านปลอม 2 ร้าน ยืนยัน cross-tenant อ่านกันไม่ได้) มาแล้ว 2 รอบ
- เกินกว่าที่เอกสารเสนอ: migration 035 จำกัด `platform_billing_settings` เหลือ admin เท่านั้น + migration 036 **revoke สิทธิ์ role `anon` ออกจาก RPC ทุกตัว** และตั้ง default privileges กันฟังก์ชันใหม่หลุดซ้ำ — ระดับที่ checklist ทั่วไปไม่พูดถึง
- Connection pooling: แอปคุยผ่าน supabase-js (PostgREST/HTTPS) ไม่ได้เปิด raw Postgres connection จาก Vercel — ปัญหา "connection ล้น" ที่เอกสารกังวลจึงไม่เกิดในสถาปัตยกรรมนี้ตั้งแต่ต้น

### ข้อ 3 — "External AI API" ✅ มี และไปไกลกว่ามาก
ไม่ใช่แค่ "ต่อ OpenAI/Gemini/Claude" — ระบบมี **8 ค่าย** (Anthropic/Google/OpenAI/DeepSeek/Qwen/Zhipu/Moonshot/Mistral) key เก็บเข้ารหัสใน Vault, เลือกโมเดลต่อ tier จากหน้า Admin, และ **smart fallback**: ค่ายใน routing ล่ม → สลับไปค่ายที่ key ใช้ได้จริงอัตโนมัติ (`_shared/providers.ts`) บอทไม่มีวันเงียบเพราะตั้งค่าผิดค่าย

### ข้อ 4 — "ต้องสมัคร Cloudflare ครอบหน้า" ⚠️ ไม่จำเป็น และประตูที่ต้องกันไม่ได้อยู่ที่ Vercel
- Vercel มี DDoS mitigation + edge network ในตัวทุกแพลน · การเอา Cloudflare proxy ครอบ Vercel เป็น double-proxy ที่ Vercel เองไม่แนะนำ (TLS/caching ซ้อนกัน ได้ปัญหามากกว่าประโยชน์ที่สเกลนี้)
- ประตูจริงของ webhook คือ Supabase Edge Functions ซึ่งป้องกันด้วยสิ่งที่แข็งแรงกว่า rate limit ระดับ IP: **ตรวจ HMAC signature ทุก request** (Meta `x-hub-signature-256`, LINE HMAC-base64, TikTok HMAC+timestamp กัน replay) — request ปลอมถูกทิ้งก่อนแตะ business logic
- Rate limiting ระดับแอปมีจริงและละเอียดกว่า (ต่อร้าน/ต่อนาที/ต่อวัน ตามแพ็กเกจ: `check_shop_rate_limit` + เพดาน playground 15/นาที·50/วัน + import 20 ไฟล์/วัน + ads chat 30/วัน)
- ถ้าวันหน้าต้องการ WAF เพิ่ม: เปิด Vercel Firewall ได้จาก dashboard เดิมโดยไม่ต้องย้าย DNS

### ข้อ 5 — "ต้องสมัคร Upstash Redis ทำ idempotency + queue" ⚠️ ปัญหาถูกแก้แล้วด้วยวิธีที่ถูกต้องกว่า
- **Idempotency**: unique constraint ระดับฐานข้อมูล — `messages.platform_message_id` (ข้อความซ้ำ = 23505 → skip), `comment_replies.comment_id` PK (คอมเมนต์ซ้ำตอบซ้ำไม่ได้ ซึ่งวิกฤตเพราะ Meta ให้ private reply ครั้งเดียว) — atomic ในทรานแซกชันเดียวกับการเขียนข้อมูล ไม่มี race window แบบเช็ค Redis แล้วค่อยเขียน DB (check-then-act ข้ามสองระบบ = ช่องโหว่ที่เอกสารเสนอมาเอง)
- **Queue**: pgmq ใน Postgres — durable, transactional, มี visibility timeout + retry + archive (`incoming_messages`, `outbound_messages`, `comment_events`, `slip_verification`, `document_processing`) — Redis queue หายได้ตอน restart, pgmq ไม่หาย
- เพิ่ม Upstash = เพิ่ม external dependency + จุดล้มเหลวใหม่ + secret ใหม่ต้องดูแล เพื่อแก้ปัญหาที่ไม่มีอยู่
- "Replay attack" ที่เอกสารอ้าง: กันด้วย HMAC + dedupe DB แล้ว (TikTok มี timestamp window 5 นาทีเพิ่มอีกชั้น)

### คำกล่าว "รองรับผู้ใช้หลักหมื่นคนต่อวัน งบ 0 บาท" ⚠️ เกินจริงทุกสถาปัตยกรรม
Free tier ของทุกเจ้ามีเพดานจริง (Vercel bandwidth/invocations, Supabase DB size/egress, Edge Function invocations) — เส้นทางที่ถูกคือแบบที่วางไว้แล้วใน docs: เริ่ม free → มีรายได้จริง → Supabase Pro ($25/เดือน ได้ backup + leaked-password protection) เอกสารที่สัญญา "หมื่นคน 0 บาท ระดับ Enterprise" คือการตลาด ไม่ใช่วิศวกรรม

## สิ่งที่ระบบนี้มี ที่ checklist ไม่ได้แตะเลย
ตรวจสลิปอัตโนมัติกันสลิปปลอม/ซ้ำ · billing gate ต่อข้อความกันแพลตฟอร์มขาดทุน (`bill_bot_reply` ล็อกแถวกัน race) · Vault ทุก secret · audit log ทุกการกระทำสำคัญ · watchdog เฝ้างบโฆษณา auto-pause · message tag นอกหน้าต่าง 24 ชม. · RBAC 4 ระดับ + role-gated UI · error ภาษาไทยชี้ทางแก้ทุกจุด

---

# วิเคราะห์คู่แข่ง (ก.ค. 2026)

| | **SudoChatBot** | ECOUNT ERP | Zaapi | Saifa AI |
|---|---|---|---|---|
| ตำแหน่ง | AI **ปิดการขาย**ครบวงจร | ERP บัญชี/สต๊อก | รวมแชทหลายช่องทาง | AI ตอบแชท (เน้น LINE) |
| ราคาเริ่ม | **ฟรี 100 ข้อความ/เดือน** ไม่ต้องใส่บัตร | 1,700฿/เดือน | trial 7 วันแล้วเสียเงิน | trial แล้วเสียเงิน |
| AI ตอบ+ปิดการขายเอง (สร้างออเดอร์+QR+ตรวจสลิป+ตัดสต๊อก) | ✅ ครบสาย | ❌ | ❌ (รวมแชท+auto-reply เป็นหลัก) | ⚠️ ตอบ/สรุปยอดได้ แต่ไม่ครบสายจ่ายเงิน-สลิป-สต๊อก |
| ตอบคอมเมนต์→ทัก inbox อัตโนมัติด้วย AI (ไม่ต้องตั้ง keyword) | ✅ | ❌ | ⚠️ ทั่วไปเป็น keyword rule | ❌ |
| AI ยิงแอด Meta (เสนอ-คุมงบ-เฝ้า spend) | ✅ ไม่มีใครมี | ❌ | ❌ | ❌ |
| นำเข้าสินค้า/เลขพัสดุจากไฟล์+รูปด้วย AI | ✅ | ⚠️ import ปกติ | ❌ | ❌ |
| ภาษา/การเข้าถึง | ไทยทั้งระบบ error ชี้ทางแก้ ใช้ได้บนมือถือ | ระบบ ERP เรียนรู้สูง | ไทย | ไทย |

**ช่องว่างที่เรายังตามหลัง (โรดแมป):** จำนวนช่องทาง (Zaapi มี Shopee/Lazada/WhatsApp/เว็บวิดเจ็ต — ของเราคือ FB/IG/LINE/TikTok) · ทีมฟีเจอร์ collaboration ขั้นสูง (assign แชท/หมายเหตุภายใน) · broadcast

**ไอเดียที่หยิบจากคู่แข่งมาเข้าโรดแมป:** เว็บแชทวิดเจ็ตฝังหน้าร้านตัวเอง (Zaapi) · Shopee/Lazada sync (อยู่ในโรดแมปแล้ว) · การสื่อสารราคาแบบ ECOUNT ("ทุกฟังก์ชัน ราคาเดียว") — ของเราสื่อได้แรงกว่า: **"เริ่มฟรี ไม่ต้องใส่บัตร บอทขายของแทนคุณทั้งสาย"**
