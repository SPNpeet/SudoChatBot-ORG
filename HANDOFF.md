# 🚀 SudoChatBot — เอกสารส่งต่อ (ทำต่อบน Claude Code ได้ 100%)

> เปิด repo นี้ใน Claude Code แล้วสั่ง "อ่าน HANDOFF.md แล้วทำงานที่ค้างต่อ" ได้เลย

## 📍 ที่อยู่ทุกอย่าง (Addresses)

| สิ่ง | ที่อยู่ / ID |
|---|---|
| **GitHub repo** | `https://github.com/SPNpeet/SudoChatBot-ORG` (branch `main`) |
| **โค้ดในเครื่อง** | `C:\SudoChatBot` |
| **Supabase project** | ref `uafnpbawajgonarvlurj` · region ap-southeast-1 (Singapore) |
| **Supabase Dashboard** | `https://supabase.com/dashboard/project/uafnpbawajgonarvlurj` |
| **Supabase API URL** | `https://uafnpbawajgonarvlurj.supabase.co` |
| **Vercel project** | `sudo-chat-bot-org` (team: Suphanat's projects) — กำลัง deploy |
| **Anon key (public)** | `eyJhbGciOiJIUzI1NiI...role":"anon"...` (อยู่ใน `.env.example` / Vercel env) |

### Edge Functions (deploy แล้วบน Supabase)
| Function | URL | verify_jwt |
|---|---|---|
| webhook-meta | `https://uafnpbawajgonarvlurj.supabase.co/functions/v1/webhook-meta` | false |
| webhook-line | `.../functions/v1/webhook-line?channel={channel_id}` | false |
| queue-worker | `.../functions/v1/queue-worker` (v3 มี billing gate) | true |
| doc-processor | `.../functions/v1/doc-processor` (v2 multi-provider) | true |
| slip-verifier | `.../functions/v1/slip-verifier` | true |

### โครงไฟล์สำคัญ
```
src/app/                      # Next.js 15 App Router
  page.tsx                    # landing (ยกเครื่องแล้ว)
  login/ onboarding/ auth/callback/
  dashboard/
    layout.tsx mobile-nav.tsx # nav (sidebar เดสก์ท็อป + bottom nav มือถือ)
    page.tsx                  # ภาพรวม + กราฟ
    chats/ orders/ products/ knowledge/ channels/ settings/
    billing/                  # ⭐ แพ็กเกจ+เครดิต+เติมเงิน+ใบเสร็จ
    admin/                    # ⭐ ศูนย์ AI (เลือกค่าย/โมเดล/key)
    admin/billing/            # ⭐ ภาพรวมรายได้ + ยืนยันสลิป
    actions.ts                # server actions (แชท/ออเดอร์/สินค้า/refund)
  api/channels/meta/          # Meta OAuth (start + callback)
  api/admin/test-ai/          # ทดสอบ key AI
  api/billing/topup-slip/     # อัปโหลดสลิปเติมเงิน
src/lib/                      # supabase clients, shop.ts (RBAC), ai-catalog.ts, utils
src/components/ui.tsx logo.tsx
supabase/functions/_shared/   # ai.ts providers.ts embeddings.ts ocr.ts slip.ts promptpay.ts meta.ts line.ts
supabase/migrations/          # 017,018 = ยังไม่ apply (ดูด้านล่าง)
```

## ⚠️ ต้อง apply migration ที่ค้าง (สำคัญมาก)
Migration `001`–`016` apply บน Supabase แล้ว. **`017` และ `018` ยังเป็นไฟล์ ยังไม่ apply** (ตอนทำ Supabase MCP หลุด)

รันบน Claude Code:
```bash
supabase link --project-ref uafnpbawajgonarvlurj
supabase db push        # apply 017 + 018
# หรือ copy SQL ไปรันใน Supabase SQL Editor
```
- `017_monthly_plan_billing.sql` — ตัดค่าสมาชิกรายเดือนอัตโนมัติ (cron 01:00 ไทย) + หมดอายุ topup ค้าง
- `018_enforce_plan_limits.sql` — trigger บังคับ limit ช่องทาง/สมาชิกตามแพ็กเกจ

หลัง apply: `supabase db pull` เพื่อดึง 001-016 มาเก็บเป็นไฟล์ครบ

## 🔑 Secrets ที่ต้องตั้ง
**Supabase → Edge Functions → Secrets:** `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DOCAI_PROCESSOR`, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`
**Vercel env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_ID`, `META_APP_SECRET`, `GEMINI_API_KEY`
> AI key ของบอทตั้งในหน้า Admin ได้เลย (เก็บ Vault) — env เป็น fallback

---

## ✅ สถานะระบบ (ทดสอบผู้ใช้จริงผ่านหมด)
- สมาชิก + RBAC (owner/admin/agent/viewer) · agent เชิญสมาชิกไม่ได้
- RLS แยกร้าน 73 policies — คนนอกดู/แก้ข้อมูลร้านอื่นไม่ได้เลย (PDPA-safe)
- Billing: wallet + โควตาฟรี + บล็อกเมื่อเครดิตหมด + เติมเงิน PromptPay + หักต่อข้อความ + ledger
- PromptPay QR ตรวจ CRC ตรงมาตรฐาน ธปท.
- AI engine 3 ค่าย (Claude/GPT/Gemini) · typecheck 0 error

## 📋 บทวิจารณ์ + งานที่ทำต่อ (ให้ Claude Code สานต่อ)

### ✅ ทำเสร็จแล้วรอบนี้
- [x] **ข้อ 1** ตัดค่าสมาชิกรายเดือนอัตโนมัติ → `migrations/017` (รอ apply)
- [x] **ข้อ 2** บังคับ limit แพ็กเกจ (ช่องทาง/สมาชิก) → `migrations/018` (รอ apply)
- [x] **ข้อ 3** ใบเสร็จเติมเงิน (พิมพ์/PDF) → `dashboard/billing/receipt/[id]`
- [x] **ข้อ 5b** หมดอายุ topup ค้าง (cron ใน 017) + refund/ยกเลิกออเดอร์คืนสต๊อก → `actions.ts refundOrder`
- [x] **ข้อ 6** ยกเครื่อง UI (landing ใหม่ + logo + theme ink/emerald)

### 🔲 ยังต้องทำต่อ (มี TODO comment ในโค้ด)
1. **[ข้อ 4] Payment gateway จริง (Omise/Stripe)** — ตอนนี้เติมเงินเป็น PromptPay+ตรวจสลิป (trust-based ไม่มี chargeback)
   - จุดแก้: `src/app/api/billing/topup-slip/route.ts` + เพิ่ม webhook รับ callback จาก gateway
   - ต่อ Omise: สมัคร opn.ooo → ใช้ Charges API + source `promptpay` → auto settle
2. **ปุ่ม refund ในหน้า UI ออเดอร์** — action `refundOrder` เขียนแล้ว แต่ยังไม่มีปุ่มใน `dashboard/orders/page.tsx` (เพิ่มปุ่มเรียก action)
3. **ใบกำกับภาษีเต็มรูปแบบ** (เลขผู้เสียภาษี ที่อยู่ VAT 7%) — ใบเสร็จตอนนี้เป็นแบบย่อ
4. **แจ้งเตือนเครดิตใกล้หมด** — เพิ่ม cron เช็ค wallet ต่ำ + ส่งอีเมล/แจ้งใน dashboard
5. **Rate limiting ต่อร้าน** — กัน abuse เมื่อ scale เกิน 1000 msg/วัน
6. **TikTok channel** — schema รองรับแล้ว (`platform='tiktok'`) ยังไม่มี webhook (ต้องเป็น TikTok partner)
7. **Product variants UI** — schema+RPC พร้อม ยังไม่มีฟอร์มใน `products/`
8. **ย้าย pg_net ออกจาก public schema** (advisor warn — minor)
9. **แจ้งเจ้าของร้านเมื่อบอทถูกหยุดเพราะเครดิตหมด** — ตอนนี้ขึ้น banner ในหน้า billing + audit log แล้ว เพิ่มอีเมลได้

## 🗂️ RPC สำคัญทั้งหมด (Postgres functions)
`bill_bot_reply(shop)` · `credit_wallet(...)` · `billing_summary(shop)` · `run_plan_billing()` · `next_order_number(shop)` · `decrement_stock(prod,variant,qty)` (qty ติดลบ=คืนสต๊อก) · `match_knowledge_chunks` · `match_products` · `search_products` · `is_platform_admin()` · `claim_platform_admin()` · `store_ai_key/get_ai_key` · `admin_confirm_topup` · `platform_revenue()` · `queue_send/read/delete/archive` · `get_channel_token/store_channel_token`

## 🧪 วิธีทดสอบ (SQL synthetic tenant)
สร้าง auth.users → shop → ทดสอบ → ลบทิ้ง ผ่าน Supabase SQL Editor (ตัวอย่างเต็มอยู่ใน git log / skill `sudochatbot-dev`)
