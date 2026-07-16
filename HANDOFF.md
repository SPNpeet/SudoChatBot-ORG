# 🚀 SudoChatBot — เอกสารส่งต่อ (ทำต่อบน Claude Code ได้ 100%)

> เปิด repo นี้ใน Claude Code แล้วสั่ง "อ่าน HANDOFF.md แล้วทำงานที่ค้างต่อ" ได้เลย

## 📍 ที่อยู่ทุกอย่าง (Addresses)

| สิ่ง | ที่อยู่ / ID |
|---|---|
| **GitHub repo** | `https://github.com/SPNpeet/SudoChatBot-ORG` (branch `main` · งานล่าสุดอยู่ branch `claude/sudochatbot-setup-q5ov87`) |
| **โค้ดในเครื่อง** | `C:\SudoChatBot` |
| **Supabase project** | ref `uafnpbawajgonarvlurj` · region ap-southeast-1 (Singapore) |
| **Supabase Dashboard** | `https://supabase.com/dashboard/project/uafnpbawajgonarvlurj` |
| **Supabase API URL** | `https://uafnpbawajgonarvlurj.supabase.co` |
| **Vercel project** | `sudo-chat-bot-org` (team: Suphanat's projects) — กำลัง deploy |
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

## 🔲 เหลือเฉพาะฝั่งหน้าเว็บ + ตั้งค่า (ต้องใช้บัญชีของคุณ)
1. **Vercel**: ตั้ง env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_ID/SECRET`, `GEMINI_API_KEY`) + deploy branch นี้ (หรือ merge เข้า main) + ตั้ง Auth providers FB/Google + Site URL
2. **Supabase Edge Secrets**: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DOCAI_PROCESSOR`, `META_APP_ID/SECRET`, `META_VERIFY_TOKEN`
3. **หน้า Admin → Billing**: เลือก gateway Omise + ใส่ keys · Resend key + ผู้ส่งอีเมล · ข้อมูลภาษี/VAT — แล้วตั้ง Omise webhook → `https://<โดเมน>/api/billing/omise/webhook`

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
