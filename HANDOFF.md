# 🚀 SudoChatBot — เอกสารส่งต่อ (ทำต่อบน Claude Code ได้ 100%)

> เปิด repo นี้ใน Claude Code แล้วสั่ง "อ่าน HANDOFF.md แล้วทำงานที่ค้างต่อ" ได้เลย

## 📍 ที่อยู่ทุกอย่าง (Addresses)

| สิ่ง | ที่อยู่ / ID |
|---|---|
| **GitHub repo** | `https://github.com/SPNpeet/SudoChatBot-ORG` (branch `main` — รวมงานทุก branch แล้ว) |
| **โค้ดในเครื่อง** | `C:\Users\peet\Documents\GitHub\SudoChatBot-ORG` (clone ล่าสุด · `C:\SudoChatBot` เป็นสำเนาเก่า ไม่ใช่ git repo) |
| **แผนที่โค้ด** | `docs/REPO-MAP.md` — สร้างอัตโนมัติด้วย `node ~/.claude/skills/ast-repo-mapper/scripts/repo-map.mjs src docs/REPO-MAP.md` (regenerate เมื่อโครงสร้างเปลี่ยนเยอะ) |
| **Supabase project** | ref `uafnpbawajgonarvlurj` · region ap-southeast-1 (Singapore) |
| **Supabase Dashboard** | `https://supabase.com/dashboard/project/uafnpbawajgonarvlurj` |
| **Supabase API URL** | `https://uafnpbawajgonarvlurj.supabase.co` |
| **Vercel project** | `sudochatbot-org` (team: suphanats-projects) — **LIVE** |
| **เว็บใช้งานจริง** | `https://sudochatbot-org.vercel.app` ✅ deploy สำเร็จ (main, READY) |
| **Anon key (public)** | `eyJhbGciOiJIUzI1NiI...role":"anon"...` (อยู่ใน `.env.example` / Vercel env) |

### Edge Functions (deploy แล้วทั้งหมด — ตรวจ log cron 200 ทุกนาทีแล้ว)
| Function | URL | verify_jwt |
|---|---|---|
| webhook-meta | `https://uafnpbawajgonarvlurj.supabase.co/functions/v1/webhook-meta` | false |
| webhook-line | `.../functions/v1/webhook-line?channel={channel_id}` | false |
| webhook-tiktok | `.../functions/v1/webhook-tiktok?channel={channel_id}` (v1) | false |
| queue-worker | `.../functions/v1/queue-worker` (v4: rate limit + notify_bot_blocked + tiktok send) | true |
| doc-processor | `.../functions/v1/doc-processor` (v2 multi-provider) | true |
| slip-verifier | `.../functions/v1/slip-verifier` | true |

### โครงไฟล์สำคัญ
```
src/app/                      # Next.js 15 App Router
  page.tsx                    # landing (ยกเครื่องแล้ว)
  login/ onboarding/ auth/callback/
  dashboard/
    layout.tsx mobile-nav.tsx notifications.tsx  # nav + แถบแจ้งเตือน (เครดิตต่ำ/บอทหยุด)
    page.tsx                  # ภาพรวม + กราฟ
    chats/ orders/ products/ knowledge/ channels/ settings/
    billing/                  # ⭐ แพ็กเกจ+เครดิต+เติมเงิน (PromptPay สลิป หรือ Omise)+ใบเสร็จ
    billing/receipt/[id]/     # ใบเสร็จ/ใบกำกับภาษี VAT 7% (เลข INV รันอัตโนมัติ)
    admin/                    # ⭐ ศูนย์ AI (เลือกค่าย/โมเดล/key)
    admin/billing/            # ⭐ รายได้ + ยืนยันสลิป + ตั้ง gateway/Omise/Resend/ภาษี
    actions.ts                # server actions (แชท/ออเดอร์/สินค้า+variants/refund/tiktok/ภาษี/แจ้งเตือน)
  api/channels/meta/          # Meta OAuth (start + callback)
  api/admin/test-ai/          # ทดสอบ key AI
  api/billing/topup-slip/     # อัปโหลดสลิปเติมเงิน (โหมด trust-based)
  api/billing/omise/webhook/  # ⭐ Omise callback — ยืนยัน charge จาก API ตรง + เครดิตอัตโนมัติ
src/lib/                      # supabase clients, shop.ts (RBAC), ai-catalog.ts, omise.ts, utils
src/components/ui.tsx logo.tsx
supabase/functions/_shared/   # ai.ts providers.ts embeddings.ts ocr.ts slip.ts promptpay.ts meta.ts line.ts tiktok.ts
supabase/migrations/          # 017-026 apply บน Supabase แล้วทั้งหมด
```

## ✅ Backend deploy ครบแล้ว (ทำผ่าน Supabase MCP เมื่อ 2026-07-16)
- Migrations **017–026 apply แล้วทั้งหมด** (024=แก้ decrement_stock คืนสต๊อกด้วย qty ติดลบ · 025=ปิด RPC ของ trigger fns · 026=แยก policy for all)
- pg_net ย้ายไป schema `extensions` แล้ว — cron `net.http_post` เดิมใช้ได้ต่อ (ฟังก์ชันอยู่ schema `net` เสมอ)
- ทดสอบ synthetic tenant ผ่าน 10/10: ตัดรอบบิล/overdue/limit ช่องทาง/limit สมาชิก/rate limit(บล็อกครั้งที่ 31)/notify dedupe/low credit/เลข INV/ตัด-คืนสต๊อก
- Advisor: WARN แก้หมด เหลือเฉพาะข้อยกเว้นที่ตั้งใจ (membership fns + deny-all tables)
- `supabase db pull` เพื่อเก็บไฟล์ 001–016 ยังทำได้ภายหลังจากเครื่องที่มี CLI (optional)

## ✅ Vercel deploy สำเร็จแล้ว (2026-07-16)
- โปรเจกต์ `sudochatbot-org` เชื่อม repo `SPNpeet/SudoChatBot-ORG` branch `main` · production READY
- เว็บใช้งานจริง: **https://sudochatbot-org.vercel.app** (landing/login/dashboard ทำงาน · middleware auth OK)
- Env ที่ตั้งแล้ว: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## ✅ ตรวจสอบจริงบนโปรดักชัน (2026-07-19 — ทดสอบจากภายนอกทุกจุดที่เข้าถึงได้)
- ✅ **`SUPABASE_SERVICE_ROLE_KEY` ตั้งใน Vercel แล้วและใช้งานได้จริง** — พิสูจน์ผ่าน `GET /api/health` → `{"ok":true,"env":{"anonKey":true,"serviceRoleKey":true},"db":true}` (endpoint ใหม่ ใช้เช็คสุขภาพระบบได้ตลอด)
- ✅ **Facebook OAuth เปิดใช้แล้ว** — authorize endpoint redirect ไป facebook.com ด้วย Meta App จริง และ `redirect_to` โดเมนโปรดักชันผ่าน allow-list (Site URL ตั้งถูกแล้ว)
- ✅ Edge Functions ตอบถูกทุกตัว: webhook-meta 403 (ไม่มี token=ถูกต้อง) · webhook-line 405 (GET=ถูกต้อง) · webhook-tiktok 200
- ✅ หน้า `/privacy` `/terms` `/data-deletion` ขึ้นครบ (ตามข้อกำหนด Meta App Review)
- ✅ middleware กัน `/dashboard` → redirect ไป `/login` ถูกต้อง
- ✅ Omise webhook: ตอบ 200 idempotent · ถ้า env ยังไม่พร้อมจะตอบ 503 ให้ Omise retry (กัน event หาย)
- ❌ **สมัครด้วยอีเมลยังติดคอขวด**: Supabase ตอบ `429 over_email_send_rate_limit` — เพราะเปิด "Confirm email" อยู่แต่ยังใช้ SMTP ในตัว (จำกัด ~2-4 ฉบับ/ชม.) — Google provider ยังไม่เปิด (ปุ่มจะแจ้งเป็นไทยว่ายังไม่เปิดใช้งาน)

## ✅ ตัดสินใจแล้ว (2026-07-19 — คุยกับเจ้าของ)
- **รับเงินแพลตฟอร์ม**: สลิป PromptPay + แอดมินยืนยัน ไปก่อน (ฟรี 0%) — Omise โค้ดพร้อมแล้ว เปิดทีหลังเมื่อยอดเยอะ
- **โดเมน**: เจ้าของจดแล้ว → **`sudochatbot.online`** ที่ Hostinger (หมดอายุ 2027-07-19 ต่ออายุอัตโนมัติ) — เหลือชี้ DNS เข้า Vercel (ดูขั้นตอนล่าง)
- **AI**: เพิ่มค่ายจีนครบแล้ว — DeepSeek / Qwen (Alibaba) / GLM (Zhipu) / Kimi (Moonshot) เลือกในหน้า Admin ได้เหมือน 3 ค่ายเดิม

## ✅ Deploy บน Supabase จริงแล้ว (2026-07-19 ผ่าน MCP)
- **Migrations 027+028 apply แล้ว**: ปลด provider constraint + ขยาย whitelist ใน `store_ai_key` → บันทึก key ค่ายจีนได้จริง
- **queue-worker v5 deploy แล้ว** (รองรับ 4 ค่ายจีนบนแชทลูกค้าจริง) — ตรวจ log cron 200 ทุกนาที ปกติ
- **หน้าใหม่ `/dashboard/slips` (คลังสลิป)**: รวมสลิปทุกใบที่ลูกค้าส่งเข้าแชท กรองตามสถานะ รอตรวจ/ผ่าน/ปฏิเสธ รูปเปิดผ่าน signed URL (bucket `slips` private) — เพิ่มในเมนู desktop+mobile แล้ว

## 🔲 ชี้โดเมน sudochatbot.online เข้า Vercel — เหลือ 1 ขั้นบน Vercel dashboard เท่านั้น
**ตรวจแล้ว 2026-07-19**: Hostinger DNS ตั้งถูกต้องแล้ว (`nslookup sudochatbot.online` → `76.76.21.21` ตรงกับ Vercel · `www` → `cname.vercel-dns.com`) แต่ `curl https://sudochatbot.online` ตอบ **`404 DEPLOYMENT_NOT_FOUND`** (Vercel edge รับ request แล้วแต่ไม่รู้จักโดเมนนี้ว่าเป็นของโปรเจกต์ไหน) + HTTPS handshake ล้มเหลว (ยังไม่ออก SSL ให้) — แปลว่า**ยังไม่ได้กด Add Domain ในหน้า Vercel** ซึ่งเป็นขั้นตอนเดียวที่เหลือและต้องทำเองในบัญชี Vercel (agent ไม่มี Vercel token/CLI ในเครื่องนี้ ทำแทนไม่ได้):

1. **Vercel** → vercel.com → โปรเจกต์ `sudochatbot-org` → Settings → Domains → Add → พิมพ์ `sudochatbot.online` แล้ว Add อีกครั้งด้วย `www.sudochatbot.online` — เพราะ DNS ตั้งไว้ถูกแล้ว ขั้นนี้ควรขึ้น **Valid** ทันทีหรือใน 1-2 นาที (ไม่ต้องรอ DNS propagate เพิ่ม)
2. Vercel จะออก SSL ให้อัตโนมัติหลัง Valid — เช็คด้วย `curl -I https://sudochatbot.online` ควรได้ `200` ไม่ใช่ `404 DEPLOYMENT_NOT_FOUND`
3. หลังโดเมนติด: Supabase → Authentication → URL Configuration → Site URL = `https://sudochatbot.online` + เพิ่ม `https://sudochatbot.online/auth/callback` ใน Redirect URLs (คงของ vercel.app ไว้ด้วยได้) · Vercel env `NEXT_PUBLIC_APP_URL=https://sudochatbot.online` → redeploy
4. อีเมลยืนยัน: สมัคร resend.com → verify โดเมน sudochatbot.online (เพิ่ม TXT/MX ที่ Hostinger ตามที่ Resend บอก) → เอา SMTP ไปใส่ใน Supabase Auth (host `smtp.resend.com` user `resend` pass = API key)

**ตรวจแล้ว 2026-07-19**: `mailer_autoconfirm` ยังเป็น `false` — ยังไม่ได้ปิด "Confirm email" ตามที่แนะนำไว้ก่อนหน้า สมัครสมาชิกยังติด rate limit เหมือนเดิมจนกว่าจะทำ (Supabase → Authentication → Sign In / Providers → Email → ปิด Confirm email)

## 🆕 ฟีเจอร์ใหม่ (2026-07-19)
- **หน้า "ทดลองบอท"** (`/dashboard/playground`) — เจ้าของร้านคุยกับบอทตัวเองได้ทันทีโดยไม่ต้องเชื่อมเพจ ใช้ AI + สินค้า + คลังความรู้จริง จำลองออเดอร์ ไม่หักเครดิต มี chip โชว์ tool ที่บอทเรียก
- **Setup Checklist 5 ก้าว** บนหน้าภาพรวม — เพิ่มสินค้า → สอนบอท → ตั้งพร้อมเพย์ → ทดลองบอท → เชื่อมช่องทาง (หายเองเมื่อครบ)
- **ค่าย AI ใหม่ 4 ค่าย** (OpenAI-compatible): ใช้ได้ทันทีใน Playground + test-ai · ใช้กับแชทลูกค้าจริงต้อง **deploy queue-worker ใหม่** (โค้ดใน `_shared/providers.ts`+`ai.ts` พร้อมแล้ว) และ **apply migration 027** (วางเนื้อหา `supabase/migrations/027_more_ai_providers.sql` ใน SQL Editor → Run — เขียนแบบ idempotent รันซ้ำได้)

## 🔲 เหลือให้เจ้าของทำ (ต้องใช้บัญชีคุณ — agent เข้า dashboard แทนไม่ได้)
0. **Apply migration 027** (เปิดค่าย AI ใหม่): Supabase → SQL Editor → วางไฟล์ 027 → Run
0.5 **ซื้อโดเมน sudochatbot.com** ที่ GoDaddy → Vercel → Settings → Domains → Add → ทำตาม DNS ที่ Vercel บอก (A record + CNAME ใน GoDaddy DNS) → เสร็จแล้วอัปเดต Supabase Auth Site URL เป็นโดเมนใหม่
1. **ปลดล็อกสมัครด้วยอีเมล** (เลือกทางเดียว):
   - **ทาง A (เร็วสุด 1 คลิก)**: Supabase Dashboard → Authentication → Sign In / Providers → Email → ปิด "Confirm email" → Save — สมัครแล้วเข้าใช้ได้ทันที
   - **ทาง B (โปรดักชันเต็มรูปแบบ)**: Authentication → Emails → SMTP Settings → ใส่ SMTP ของ Resend (host `smtp.resend.com` · user `resend` · pass = Resend API key) — ยืนยันอีเมลทำงานจริงไม่ติด rate limit
2. **ตั้งแอดมินแพลตฟอร์ม**: ล็อกอินครั้งแรก (Facebook หรืออีเมลหลังข้อ 1) → เข้า `/dashboard/admin` → กดปุ่ม claim admin (คนแรกที่กดได้เป็นแอดมิน) → ใส่ AI key (Claude/GPT/Gemini) ในหน้านี้ (เก็บ Vault)
3. **หน้า Admin → Billing**: ใส่ Omise keys · Resend key · ข้อมูล VAT → แล้วไปตั้ง webhook ใน Omise dashboard ชี้ไป `https://sudochatbot-org.vercel.app/api/billing/omise/webhook`
4. *(ทางเลือก)* เปิด Google provider ใน Supabase Auth ถ้าอยากให้ล็อกอินด้วย Google ได้

---

## ✅ สถานะระบบ
- สมาชิก + RBAC (owner/admin/agent/viewer) · agent เชิญสมาชิกไม่ได้
- RLS แยกร้าน 73+ policies (PDPA-safe)
- Billing: wallet + โควตาฟรี + บล็อกเมื่อเครดิตหมด + เติมเงิน PromptPay/Omise + หักต่อข้อความ + ledger
- AI engine 3 ค่าย (Claude/GPT/Gemini) · typecheck 0 error ทุก commit

## 📋 งานค้าง 9 ข้อเดิม — เสร็จครบแล้ว (commit บน branch `claude/sudochatbot-setup-q5ov87`)
- [x] **ข้อ 1** Payment gateway จริง (Omise Charges API + PromptPay source, เครดิตอัตโนมัติ, webhook ยืนยันจาก API ตรง กัน payload ปลอม) → `api/billing/omise/webhook` + `lib/omise.ts` + migration 019
- [x] **ข้อ 2** ปุ่ม refund/ยกเลิกในหน้าออเดอร์ (พร้อมแก้บั๊ก refundOrder ที่เซ็ตสต๊อก variant เป็น 0) → `dashboard/orders/page.tsx`
- [x] **ข้อ 3** ใบกำกับภาษีเต็มรูปแบบ (ผู้ขาย/ผู้ซื้อ/เลขผู้เสียภาษี/VAT 7%/เลขที่ INV อัตโนมัติ) → `billing/receipt/[id]` + migration 020
- [x] **ข้อ 4** แจ้งเตือนเครดิตใกล้หมด (cron รายชั่วโมง + แถบแจ้งใน dashboard + อีเมล Resend) → migration 021 + `dashboard/notifications.tsx`
- [x] **ข้อ 5** Rate limiting ต่อร้าน (ต่อนาที/ต่อวันตามแพ็กเกจ) → migration 022 + queue-worker
- [x] **ข้อ 6** TikTok webhook + ฟอร์มเชื่อมช่องทาง (ยังต้องได้ partner approval จาก TikTok ถึงใช้จริงได้) → `functions/webhook-tiktok` + `_shared/tiktok.ts`
- [x] **ข้อ 7** Product variants UI (เพิ่ม/แก้/archive ตัวเลือกย่อยในฟอร์มสินค้า) → `products/product-form.tsx`
- [x] **ข้อ 8** ย้าย pg_net ออกจาก public → migration 023
- [x] **ข้อ 9** อีเมลแจ้งเจ้าของร้านเมื่อบอทหยุดเพราะเครดิตหมด (dedupe 24 ชม.) → migration 021 + queue-worker

## 🔲 งานถัดไป (Roadmap)
- [ ] apply migrations 017-023 + deploy queue-worker/webhook-tiktok (ดูหัวข้อ ⚠️ ด้านบน)
- [ ] Meta App Review (permissions ใน docs/SETUP-META.md) — dev mode ทดสอบกับเพจตัวเองได้ทันที
- [ ] Google Document AI processor + service account (docs/GO-LIVE.md ขั้น 4)
- [ ] TikTok partner approval (Business Messaging API)
- [ ] Stripe เป็น gateway ทางเลือกที่สอง (โครง gateway ใน topups.gateway รองรับแล้ว)

## 🗂️ RPC สำคัญทั้งหมด (Postgres functions)
`bill_bot_reply(shop)` · `credit_wallet(...)` · `billing_summary(shop)` · `run_plan_billing()` · `next_order_number(shop)` · `decrement_stock(prod,variant,qty)` (qty ติดลบ=คืนสต๊อก) · `match_knowledge_chunks` · `match_products` · `search_products` · `is_platform_admin()` · `claim_platform_admin()` · `store_ai_key/get_ai_key` · `admin_confirm_topup` · `platform_revenue()` · `queue_send/read/delete/archive` · `get_channel_token/store_channel_token` · **ใหม่ (019-022):** `store/get_platform_omise_key` · `store_platform_resend_key` · `send_platform_email` · `notify_bot_blocked` · `notify_low_credit()` · `check_shop_rate_limit` · `next_invoice_number()`

## 🧪 วิธีทดสอบ (SQL synthetic tenant)
สร้าง auth.users → shop → ทดสอบ → ลบทิ้ง ผ่าน Supabase SQL Editor (ตัวอย่างเต็มอยู่ใน git log / skill `sudochatbot-dev`)
