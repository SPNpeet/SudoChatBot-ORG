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

### Edge Functions (deploy แล้วบน Supabase — ⚠️ queue-worker ต้อง deploy ใหม่ ดูงานค้าง)
| Function | URL | verify_jwt |
|---|---|---|
| webhook-meta | `https://uafnpbawajgonarvlurj.supabase.co/functions/v1/webhook-meta` | false |
| webhook-line | `.../functions/v1/webhook-line?channel={channel_id}` | false |
| webhook-tiktok | `.../functions/v1/webhook-tiktok?channel={channel_id}` — **โค้ดใหม่ ยังไม่ deploy** | false |
| queue-worker | `.../functions/v1/queue-worker` — **โค้ดแก้แล้ว (rate limit + notify_bot_blocked + tiktok send) ต้อง deploy ใหม่** | true |
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
supabase/migrations/          # 017-023 = ยังไม่ apply (ดูด้านล่าง)
```

## ⚠️ สิ่งที่ต้องทำจากเครื่องที่มีสิทธิ์ (Claude Code ในเซสชัน remote ทำไม่ได้ — ไม่มี Supabase token/MCP)

### 1) apply migrations 017–023 (สำคัญสุด)
```bash
supabase link --project-ref uafnpbawajgonarvlurj
supabase db push        # apply 017..023
supabase db pull        # ดึง 001-016 มาเก็บเป็นไฟล์ให้ครบ
```
| # | ไฟล์ | ทำอะไร |
|---|---|---|
| 017 | monthly_plan_billing | ตัดค่าสมาชิกรายเดือน (cron 01:00 ไทย) + expire topup ค้าง |
| 018 | enforce_plan_limits | trigger บังคับ limit ช่องทาง/สมาชิกตามแพ็กเกจ |
| 019 | omise_gateway | topups.gateway/charge_id + payment_gateway + Vault RPC omise key |
| 020 | tax_invoice | ข้อมูลภาษีผู้ขาย/ผู้ซื้อ + เลขใบกำกับ INV-YYYYMM-#### (trigger ตอน paid) |
| 021 | billing_notifications | ตาราง notifications + send_platform_email (Resend/pg_net) + notify_bot_blocked + cron notify_low_credit |
| 022 | rate_limiting | plans.rate_limit_per_min/day + RPC check_shop_rate_limit + cron cleanup |
| 023 | move_pg_net | ย้าย pg_net ออกจาก public (advisor WARN) |

หลัง apply: รัน `get_advisors(security)` + `(performance)` แก้ WARN ทุกตัว แล้วทดสอบ synthetic tenant (สร้าง auth.users→shop→ทดสอบ run_plan_billing / insert เกิน limit ต้อง raise / check_shop_rate_limit / notify_bot_blocked→ลบทิ้ง)

### 2) deploy edge functions ที่แก้/เพิ่ม (ผ่าน Supabase MCP หรือ CLI)
- **queue-worker** (แก้: rate limit gate + notify_bot_blocked + tiktok send) — verify_jwt true
- **webhook-tiktok** (ใหม่) — verify_jwt **false**
- วิธีบันเดิล _shared ดู `skill/sudochatbot-dev/SKILL.md` ข้อ 4

### 3) ตั้ง secrets + deploy Vercel
- Supabase Edge Secrets: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DOCAI_PROCESSOR`, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`
- Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_ID`, `META_APP_SECRET`, `GEMINI_API_KEY` (+ optional `OMISE_SECRET_KEY` เป็น fallback ถ้าไม่ตั้งใน Vault)
- Deploy Vercel + ตั้ง Auth providers (Facebook/Google) + Site URL
- ตั้งค่าในหน้า Admin → Billing: gateway (Omise keys), Resend API key + ผู้ส่งอีเมล, ข้อมูลภาษี/VAT
- Omise: ตั้ง webhook endpoint ใน Omise dashboard → `https://<โดเมน Vercel>/api/billing/omise/webhook`

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
