# SudoChatBot — AI Sales-Closing Chatbot SaaS

แพลตฟอร์ม B2B2C SaaS: แชทบอท AI ปิดการขายสำหรับร้านค้าบน **Facebook / Instagram / LINE** (TikTok = Phase ถัดไป)
บอทตอบลูกค้าจากคลังความรู้ (RAG) + แคตตาล็อกสินค้าจริง สร้างออเดอร์ ส่ง QR พร้อมเพย์ ตรวจสลิปอัตโนมัติ และปิดยอดขายเองครบวงจร

## สถาปัตยกรรม
- **Frontend**: Next.js 15 + TypeScript + Tailwind v4 (PWA) — Dashboard ร้านค้า (deploy บน Vercel)
- **Backend**: Supabase ทั้งหมด — โปรเจกต์ `uafnpbawajgonarvlurj` (Singapore)
  - Postgres + pgvector (RAG 1536 มิติ) + RLS multi-tenant + Vault (เก็บ token เข้ารหัส)
  - pgmq 4 คิว: `incoming_messages`, `outbound_messages`, `document_processing`, `slip_verification`
  - pg_cron: ปลุก workers ทุกนาที + สรุป analytics รายคืน
- **Edge Functions** (deploy แล้ว):
  | Function | หน้าที่ | JWT |
  |---|---|---|
  | `webhook-meta` | รับ event FB/IG, ตรวจ HMAC, ลง audit, เข้าคิว | ปิด (ตรวจลายเซ็นเอง) |
  | `webhook-line` | รับ event LINE ต่อร้าน `?channel={id}` | ปิด (ตรวจลายเซ็นเอง) |
  | `queue-worker` | สมอง: AI ตอบ + ปิดการขาย + retry ส่งออก | เปิด |
  | `doc-processor` | OCR (Google Document AI) → chunk → embed | เปิด |
  | `slip-verifier` | ตรวจสลิป (EasySlip/SlipOK) → ปิดออเดอร์ → ตัดสต๊อก | เปิด |
- **AI**: Claude API (tool-use loop) — กติกาเหล็ก: ราคา/สต๊อก/ยอดรวมคำนวณฝั่ง server เท่านั้น

## หลักการไม่มีข้อความหล่น
webhook เขียน raw payload ลง `webhook_events` **ก่อน** ประมวลผลเสมอ → เข้าคิว pgmq → worker ประมวลผล
ล้มเหลว = retry อัตโนมัติ (สูงสุด 4 ครั้ง) → เกิน = archive + audit log + แจ้งสถานะ failed ตรวจย้อนหลังได้ 100%

## Secrets ที่ต้องตั้ง (Dashboard → Edge Functions → Secrets)
```
ANTHROPIC_API_KEY=          # Claude API (บังคับ)
GEMINI_API_KEY=             # Google AI Studio — embeddings (บังคับ)
GOOGLE_SERVICE_ACCOUNT_JSON= # GCP service account JSON (สำหรับ OCR)
GOOGLE_DOCAI_PROCESSOR=     # projects/.../locations/us/processors/...
META_APP_ID=                # Meta App
META_APP_SECRET=
META_VERIFY_TOKEN=          # ตั้งเองอะไรก็ได้ ใช้ตอน subscribe webhook
```

## Webhook URLs (ใช้ตั้งค่าใน Meta App / LINE OA)
- Meta: `https://uafnpbawajgonarvlurj.supabase.co/functions/v1/webhook-meta`
- LINE: `https://uafnpbawajgonarvlurj.supabase.co/functions/v1/webhook-line?channel={channel_id}`

## Dev
```bash
npm install
cp .env.example .env.local   # เติมค่า
npm run dev
```

## โครงสร้าง DB (18 ตาราง หลัก)
`shops` (tenant) → `channels` → `customers` → `conversations` → `messages`
`knowledge_documents` → `knowledge_chunks` (pgvector) | `products` → `product_variants`
`orders` (closed_by: bot ⭐) → `order_items`, `payments` (ตรวจสลิป+กันสลิปซ้ำ)
`webhook_events` (audit ทุก event), `bot_settings`, `ai_usage_logs`, `audit_logs`, `daily_analytics`

Migration ทั้งหมดอยู่ใน Supabase (ดึงลงมาได้ด้วย `supabase db pull`)
