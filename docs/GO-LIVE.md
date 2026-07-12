# 🚀 คู่มือเปิดใช้งานจริง (Go-Live Checklist)

## ขั้นที่ 1 — ใส่ Secrets (10 นาที)
ไปที่ [Supabase → Edge Functions → Secrets](https://supabase.com/dashboard/project/uafnpbawajgonarvlurj/settings/functions) เพิ่ม:

| Key | เอาจากไหน | จำเป็น |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | ✅ ทันที |
| `GEMINI_API_KEY` | aistudio.google.com → Get API Key (ฟรี) | ✅ ทันที |
| `META_APP_ID`, `META_APP_SECRET` | developers.facebook.com (ดู SETUP-META.md) | เมื่อเชื่อม FB/IG |
| `META_VERIFY_TOKEN` | ตั้งเอง เช่น `sudo-verify-2026` | เมื่อเชื่อม FB/IG |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | GCP → Service Account (ดูขั้นที่ 4) | เมื่อใช้ OCR ไฟล์ PDF/รูป |
| `GOOGLE_DOCAI_PROCESSOR` | GCP → Document AI → สร้าง OCR processor | เมื่อใช้ OCR |

> ไม่มี Google keys ก็เปิดใช้ได้เลย — เพิ่มความรู้บอทแบบ "ข้อความ/FAQ" ไม่ต้องใช้ OCR

## ขั้นที่ 2 — Deploy Dashboard ขึ้น Vercel (5 นาที)
1. push โค้ดขึ้น GitHub แล้วเข้า vercel.com → Add New Project → เลือก repo `SudoChatBot-ORG`
2. ใส่ Environment Variables (จาก `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://uafnpbawajgonarvlurj.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (Supabase → Settings → API Keys → anon)
   - `SUPABASE_SERVICE_ROLE_KEY` = (Supabase → Settings → API Keys → service_role — ห้ามหลุด!)
   - `META_APP_ID`, `META_APP_SECRET`, `GEMINI_API_KEY` (ถ้ามี)
3. Deploy → ได้โดเมน เช่น `sudochatbot.vercel.app`

## ขั้นที่ 3 — เปิด Social Login (5 นาที)
Supabase → Authentication → Providers:
- **Google**: เปิด + ใส่ Client ID/Secret จาก GCP OAuth (redirect: `https://uafnpbawajgonarvlurj.supabase.co/auth/v1/callback`)
- **Facebook**: เปิด + ใช้ Meta App เดียวกับขั้น SETUP-META (เพิ่ม Facebook Login product, redirect URL เดียวกัน)
- Authentication → URL Configuration → Site URL = โดเมน Vercel ของคุณ

## ขั้นที่ 4 — Google Document AI (OCR) — ทำเมื่อพร้อม
1. console.cloud.google.com → สร้างโปรเจกต์ → เปิดใช้ "Document AI API"
2. Document AI → Create Processor → เลือก **Document OCR** → region `us` → คัดลอก processor name เต็ม
3. IAM → Service Accounts → สร้าง → role "Document AI API User" → Create Key (JSON)
4. คัดลอกเนื้อ JSON ทั้งไฟล์ → ใส่ secret `GOOGLE_SERVICE_ACCOUNT_JSON`

## ขั้นที่ 5 — ทดสอบ End-to-End
1. Login → สร้างร้าน → เพิ่มสินค้า 2-3 ตัว → ตั้งค่าพร้อมเพย์ + ค่าส่ง
2. เชื่อม LINE OA (เร็วสุด — ดู SETUP-LINE.md) → ทักหาบอทจากมือถือ
3. ลองถามราคา → สั่งซื้อ → ให้ที่อยู่ → รับ QR → โอน → ส่งสลิป → ดูออเดอร์เปลี่ยนเป็น "ชำระแล้ว" ใน Dashboard

## เช็กความปลอดภัยก่อนเปิดตลาด
- [x] RLS ทุกตาราง (ทำแล้ว)
- [x] Token เข้ารหัสใน Vault (ทำแล้ว)
- [x] Webhook ตรวจลายเซ็นทุก request (ทำแล้ว)
- [x] กันสลิปซ้ำ/ยอดไม่ตรง (ทำแล้ว)
- [ ] service_role key อยู่ใน Vercel env เท่านั้น ไม่อยู่ในโค้ด
- [ ] เปิด 2FA บัญชี Supabase / GitHub / Meta
