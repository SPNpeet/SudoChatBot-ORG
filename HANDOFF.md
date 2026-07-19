# 🚀 SudoChatBot — เอกสารส่งต่อ (ทำต่อบน Claude Code ได้ 100%)

> เปิด repo นี้ใน Claude Code แล้วสั่ง "อ่าน HANDOFF.md แล้วทำงานที่ค้างต่อ" ได้เลย
> อัปเดตล่าสุด: 2026-07-19 — **ระบบ LIVE เต็มรูปแบบ เหลือจุดเดียวที่บล็อกไม่ให้บอทตอบลูกค้าได้จริง (ดูข้อ 1)**

## 📍 ที่อยู่ทุกอย่าง

| สิ่ง | ที่อยู่ / ID |
|---|---|
| **เว็บใช้งานจริง** | 🟢 **https://sudochatbot.online** (custom domain, SSL ออกแล้ว) · alias `sudochatbot-org.vercel.app` ก็ใช้ได้ |
| **Health check** | `https://sudochatbot.online/api/health` |
| **GitHub repo** | `github.com/SPNpeet/SudoChatBot-ORG` branch `main` = production (auto-deploy ทุก push) |
| **Vercel project** | `sudochatbot-org` (team `suphanats-projects`) — function region บังคับ `sin1` (สิงคโปร์ ติด Supabase) |
| **Supabase project** | ref `uafnpbawajgonarvlurj` · ap-southeast-1 · เจ้าของบัญชี `ta_free14@hotmail.com` (ยืนยันแล้วว่าเป็นของเจ้าของระบบเอง) — **Free plan** (พอสำหรับ usage ตอนนี้ ~DB 12%/Edge 6%) |
| **Facebook App** | "SudoLogin" App ID `1548418113603775` |
| **เอกสารอ้างอิง** | `docs/GO-LIVE.md` (checklist) · `docs/META-REVIEW.md` (ขั้นตอน+สคริปต์ยื่น Facebook Advanced Access) · `docs/SETUP-LINE.md` · `docs/REPO-MAP.md` (แผนที่โค้ด, regenerate ด้วย `node ~/.claude/skills/ast-repo-mapper/scripts/repo-map.mjs src docs/REPO-MAP.md`) |

### สถานะจริงที่ตรวจสอบแล้ว (2026-07-19 — query ตรงจาก DB ไม่ใช่เดา)
```
platform_admins = 1     ✅ มีแอดมินแพลตฟอร์มแล้ว
ai_provider_keys = 0    ❌ ยังไม่มี AI key เลยสักตัว ← บล็อกเดียวที่เหลือ
shops = 1 (active)      ✅ ร้านเดียว สะอาด (เคยมีบั๊กสร้างร้านซ้ำ 47 ร้าน แก้+ล้างแล้ว)
products / orders = 0   (ยังไม่ได้เพิ่มสินค้า — รอทำหลังใส่ AI key)
mailer_autoconfirm = true            ✅ สมัครอีเมลแล้วเข้าใช้ได้ทันที ไม่ติด rate limit
external providers: email/google/facebook = true (ทั้ง 3 เปิดหมดแล้ว)
```

### Vercel Env ที่ตั้งครบแล้ว
`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `META_APP_ID` · `META_APP_SECRET`
(AI provider keys ตั้งในหน้า **Admin → ศูนย์ AI** เก็บ Vault ไม่ต้องพึ่ง env — รองรับ 8 ค่ายแล้ว: Claude/GPT/Gemini + DeepSeek/Qwen/GLM/Kimi + Mistral)

### Edge Functions (deploy ล่าสุด — cron ปลุกทุกนาที 200 ต่อเนื่อง)
`webhook-meta` · `webhook-line` · `webhook-tiktok` v1 · `queue-worker` **v7** (รองรับ 8 ค่าย AI รวม Mistral + rate limit + notify) · `doc-processor` v2 · `slip-verifier` **v2**

### Database
Migrations **001 → 029 apply ครบบน production** แล้วทั้งหมด (ไม่มีอะไรค้าง)

## 🆕 รอบ 2026-07-20 — นำเข้าสินค้าจากไฟล์ + ค่าย Mistral + แก้ billing/error UX
- **สาเหตุที่ AI key ยังเป็น 0 ทั้งที่เจ้าของเคยวาง key แล้ว**: key OpenAI ที่วางถูก OpenAI ปฏิเสธ (`401 Incorrect API key`) — ระบบทำงานถูกต้อง ตัว key เองใช้ไม่ได้ ต้องสร้างใหม่ที่ platform.openai.com (เช็คว่าบัญชีมี billing) หรือใช้ค่ายอื่น
- **Billing แก้ทั้งชุด**: server actions คืน `{ok,error}` แทน throw (Next.js prod ซ่อนข้อความ throw เป็น "Server Components render error") · error แสดง inline เลิก alert() · ถ้าแพลตฟอร์มยังไม่ตั้งพร้อมเพย์รับเงิน หน้าเติมเงินโชว์การ์ดชี้ทางไปตั้งที่ Admin → Billing แทนปุ่มที่กดแล้วพัง
- **Error AI เป็นไทย**: `src/lib/ai-errors.ts` แปลง 401/402/429/5xx เป็นข้อความชี้ทางแก้ ใช้ใน test-ai + playground + import
- **ค่าย Mistral (ที่ 8)**: migration 029 apply แล้ว (ปลด constraint + whitelist) · queue-worker **v7** deploy แล้ว · เลือกในหน้า Admin ได้ (OCR + Chat)
- **นำเข้าสินค้าจากไฟล์** (`/dashboard/products/import` + ปุ่ม "นำเข้าไฟล์" บนหน้าสินค้า): Excel/CSV parse ในเครื่องด้วย SheetJS + จับคู่คอลัมน์ไทย/อังกฤษอัตโนมัติ · PDF/รูปแคตตาล็อก (≤4MB) อ่านด้วย AI ผ่าน `/api/products/import-extract` (ลำดับ: Mistral OCR → Gemini → Claude → GPT ตาม key ที่มี) · พรีวิวแก้ไขได้ + ข้ามชื่อซ้ำ + นำเข้าเป็นร่าง + รองรับ variants

---

## 🔴 สิ่งเดียวที่บล็อกไม่ให้บอทตอบลูกค้าได้ตอนนี้

**ยังไม่มี AI provider key ในระบบเลย (`ai_provider_keys` = 0 แถว)** ทุกอย่างอื่นพร้อมหมดแล้ว

**วิธีแก้ (2 นาที)**:
1. เข้า https://sudochatbot.online/login → ล็อกอิน
2. ไป `/dashboard/admin` → ใส่ API key อย่างน้อย 1 ค่าย (แนะนำ Gemini เพราะมี free tier — เอาจาก aistudio.google.com หรือ Anthropic/OpenAI ก็ได้)
3. ไป `/dashboard/products` → เพิ่มสินค้าอย่างน้อย 1 ตัว
4. ทดสอบที่ `/dashboard/playground` — คุยกับบอทตัวเองได้ทันที ไม่หักเครดิต ไม่ต้องเชื่อมเพจก่อน

---

## ✅ ฟีเจอร์ที่มีและยืนยันด้วยการทดสอบจริงแล้ว (ไม่ใช่แค่เขียนโค้ด)

**Auth**: สมัคร/ล็อกอินอีเมล (autoconfirm, ไม่ติด rate limit) · Google OAuth ✅ · Facebook OAuth ✅ (ใช้ได้กับ admin/tester ของแอพ Meta — เปิดสาธารณะรอ Business Verification ดูข้อ 2) · error message แปลไทยครบ + เช็ค provider ก่อน redirect กันเจอ JSON error ดิบ

**Core**: RBAC (owner/admin/agent/viewer) · RLS แยกร้านทุกตาราง (PDPA-safe) · onboarding กันสร้างร้านซ้ำแล้ว

**บอทขาย**: AI 10 ค่ายเลือกได้ต่อ tier (ประหยัด/มาตรฐาน/พรีเมียม) · **หน้า "ทดลองบอท" (Playground)** ไม่หักเครดิต ไม่ต้องเชื่อมเพจ · ค้นสินค้า/คลังความรู้แบบ semantic search

**ช่องทาง**: LINE เต็มรูปแบบ (มี wizard ทีละขั้นในแอป) · Facebook/IG คลิกเดียวเชื่อม (จำกัดเฉพาะเพจของ admin/tester จนกว่าจะผ่าน App Review) · TikTok webhook พร้อม (รอ TikTok อนุมัติ partner)

**ออเดอร์/เงิน**: ตัด/คืนสต๊อกอัตโนมัติ (แก้บั๊กคืนสต๊อกไม่ได้แล้ว) · **หน้าคลังสลิป** (`/dashboard/slips`) รวมสลิปทุกออเดอร์ · เติมเงิน PromptPay+ตรวจสลิป (ใช้อยู่ตอนนี้) หรือ Omise auto (โค้ดพร้อม รอเปิดทีหลัง) · ใบกำกับภาษี VAT 7% เลขที่ INV อัตโนมัติ

**แจ้งเตือน**: เครดิตใกล้หมด/บอทหยุด/**ออเดอร์ใหม่**/**ลูกค้าขอคุยกับคน (handoff)** — dashboard + อีเมล Resend (เมื่อตั้ง key)

**UX/Ops**: Setup Checklist 5 ขั้นในหน้าภาพรวม · press feedback ทั้งแอป · confirm()/alert() ดิบเปลี่ยนเป็น modal ในแอปหมดแล้ว · SEO เต็มชุด + คู่มือแอดมินในแอป (`/dashboard/help`) · `/api/health` เช็คสุขภาพระบบ · perf: Vercel function รันที่สิงคโปร์ (latency ต่ำ)

---

## 🔲 งานที่เหลือจริง ๆ (เรียงตามผลกระทบ หลังข้อ 🔴 ด้านบน)

### 2. เปิด Facebook/IG ให้ **ร้านค้าอื่น** เชื่อมเพจของตัวเองได้ (ไม่บล็อกการขาย — LINE ใช้เต็มรูปแบบอยู่แล้ว)
ต้องผ่าน **Facebook App Review** ขอ `pages_messaging`/`pages_show_list`/`instagram_manage_messages` — **มีคู่มือ+สคริปต์อัดวิดีโอพร้อมยื่นแล้วที่ `docs/META-REVIEW.md`** ก่อนหน้านั้นต้องผ่าน **Business Verification** (ต้องมีเอกสารธุรกิจ) รอ 2-7 วันทำการ ทำคู่ขนานได้ ไม่ต้องรีบ

### 3. Google Document AI (OCR ไฟล์ในคลังความรู้) — optional
ไม่มีก็ใช้ได้ปกติ (พิมพ์ข้อความ/FAQ แทน OCR ได้) วิธีตั้งอยู่ `docs/GO-LIVE.md` ขั้น 4

### 4. Omise/Resend/VAT ของแพลตฟอร์ม — optional จนกว่าจะรับเงินจริงเกิน manual slip
ใส่ใน Admin → Billing แล้วตั้ง webhook Omise ชี้ `https://sudochatbot.online/api/billing/omise/webhook`

### 5. Supabase ยัง Free plan
ใช้งานได้สบายตอนนี้ (usage ต่ำมาก) — อัปเป็น **Pro ($25/เดือน)** เมื่อมีลูกค้าจ่ายเงินจริง เพื่อปลดล็อก backup อัตโนมัติ + leaked-password-protection + ไม่ต้องกังวลโดน pause

### 6. Roadmap ฟีเจอร์แข่งขัน (จากการวิเคราะห์เทียบคู่แข่งไทย 2026-07-19 — เรียงตามผลต่อยอดขายลูกค้า)
สิ่งที่คู่แข่งในตลาดไทย (เพจแม่ค้า F-commerce) มีแล้วเรายังไม่มี — ตัดสินใจแล้วว่าเป็นงานหลังมีผู้ใช้จริงกลุ่มแรก:
1. **ดูดคอมเมนต์ → ทัก inbox อัตโนมัติ (private reply)** — พฤติกรรมหลักของการขายบน Facebook ไทยคือลูกค้าคอมเมนต์ใต้โพสต์ ไม่ทักแชทเอง ต้องขอ `pages_manage_engagement` + webhook `feed` เพิ่ม (ยื่น review รอบสองได้)
2. **CF ไลฟ์สด** — ดูดคอมเมนต์ "CF/F" ใต้ไลฟ์เป็นออเดอร์อัตโนมัติ ตลาดใหญ่มากในไทย (ต่อยอดจากข้อ 1)
3. **เลขพัสดุ + เชื่อมขนส่ง** — ใส่เลข tracking ในออเดอร์ → บอทแจ้งลูกค้าอัตโนมัติ ต่อ API Flash/J&T ทีหลัง
4. **Broadcast/ข้อความติดตาม** — ทวงตะกร้าค้าง (ลูกค้าคุยแล้วหาย) + โปรโมชันหาลูกค้าเก่า (ระวังนโยบาย 24h window ของ Meta)
5. **PWA + push notification มือถือ** — แม่ค้าอยู่บนมือถือ ไม่เปิดเว็บค้าง แจ้ง handoff/ออเดอร์ใหม่ต้องเด้งถึงมือถือ
6. Shopee/Lazada sync สต๊อก — ไกลสุด ทำเมื่อมีลูกค้าเรียกร้องจริง

### ⚠️ ความปลอดภัย — ทำก่อนแจกงานให้คนอื่น/session อื่น
ระหว่าง debug เคยแชร์ credentials ชั่วคราวในแชตหลายตัว **แนะนำ rotate ทั้งหมด**:
- Vercel token: `vercel.com/account/settings/tokens`
- Supabase management token: `supabase.com/dashboard/account/tokens`
- Facebook App Secret: Meta App → ข้อมูลพื้นฐาน → รีเซ็ต (ต้องอัปเดต `META_APP_SECRET` ใน Vercel ทันทีถ้ารีเซ็ต)
- รหัสผ่านบัญชีทดสอบที่ตั้งไว้ตอน debug — เปลี่ยนใหม่

---

## 🗂️ RPC สำคัญ (Postgres functions)
`bill_bot_reply` · `credit_wallet` · `billing_summary` · `run_plan_billing` · `decrement_stock(prod,variant,qty)` (qty ติดลบ=คืนสต๊อก) · `match_knowledge_chunks/match_products/search_products` · `is_platform_admin` · `claim_platform_admin` · `store_ai_key/get_ai_key` · `admin_confirm_topup` · `platform_revenue` · `queue_send/read/delete/archive` · `store/get_channel_token` · `store/get_platform_omise_key` · `store_platform_resend_key` · `send_platform_email` · `notify_bot_blocked/notify_low_credit` · `check_shop_rate_limit` · `next_invoice_number`

## 🧪 วิธีทดสอบ (SQL synthetic tenant)
สร้าง auth.users (**ต้องใส่ token columns เช่น `confirmation_token` เป็น `''` ไม่ใช่ NULL** — เคยทำ NULL แล้ว auth ทั้งระบบพังทั้งหมดมาแล้วครั้งหนึ่ง เป็นบทเรียนสำคัญ) → shop → ทดสอบ → ลบทิ้ง ผ่าน Supabase SQL Editor/MCP
