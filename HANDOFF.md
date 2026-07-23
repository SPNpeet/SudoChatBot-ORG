# 🚀 SudoChatBot (ระบบบัญชี AI) — เอกสารส่งต่อ

> เปิด repo นี้ใน Claude Code แล้วสั่ง "อ่าน HANDOFF.md แล้วทำงานที่ค้างต่อ" ได้เลย
> อัปเดตล่าสุด: 2026-07-23 — **PIVOT ครั้งใหญ่: จาก AI Chatbot ขายของ → ระบบบัญชี + ออกเอกสารครบวงจร (Full Cloud Accounting) ชื่อเดิม SudoChatBot (โดเมนเช่าแล้ว)**

## 📍 ที่อยู่ทุกอย่าง

| สิ่ง | ที่อยู่ / ID |
|---|---|
| **เว็บใช้งานจริง** | 🟢 https://sudochatbot.online · alias `sudochatbot-org.vercel.app` |
| **GitHub repo** | `github.com/SPNpeet/SudoChatBot-ORG` branch `main` = production (auto-deploy ทุก push) |
| **Vercel project** | `sudochatbot-org` (team `suphanats-projects`) region `sin1` |
| **Supabase project** | ref `uafnpbawajgonarvlurj` · ap-southeast-1 · Free plan |
| **แผนที่โค้ด** | `docs/REPO-MAP.md` (119 ไฟล์ ~11,000 บรรทัด — regenerate: `node ~/.claude/skills/ast-repo-mapper/scripts/repo-map.mjs src docs/REPO-MAP.md`) |

## 🔄 Pivot 2026-07-23 — เกิดอะไรขึ้น

**ลบทิ้งทั้งหมด (ตามคำสั่งเจ้าของ):** แชทบอทตอบลูกค้า FB/IG/LINE/TikTok, playground, ยิงแอด AI, คลังความรู้บอท, ออเดอร์จากแชท, edge functions ทุกตัว (webhook-*, queue-worker, doc-processor, slip-verifier, ads-watchdog) และ cron ที่ปลุกมัน (unschedule แล้วบน production: kick_queue_worker, kick_doc_processor, kick_slip_verifier, kick_ads_watchdog)
- ⚠️ ตาราง DB เก่าของแชทบอท (conversations, messages, channels, knowledge_* ฯลฯ) **ไม่ได้ drop** — เก็บข้อมูลไว้เฉยๆ ไม่มีผลกับระบบใหม่ · Edge functions บน Supabase ยัง deploy ค้างไว้แต่ไม่มีอะไรเรียก — ลบได้จาก Supabase dashboard เมื่อสะดวก

**สิ่งที่เก็บไว้:** Auth (email/Google/Facebook), multi-tenant `shops` + RLS + RBAC, billing เครดิต/แพ็กเกจ (PromptPay topup + ตรวจสลิป), ศูนย์ AI (8 ค่าย, key ใน Vault), หน้า admin ทั้งชุด, สินค้า + นำเข้าไฟล์, ai-errors, feedback, audit logs

## ✅ ระบบใหม่ทั้งหมด (สร้างเสร็จ + build ผ่าน)

**Migrations 050-054 (apply บน production ครบแล้ว):**
- `contacts` ผู้ติดต่อ (ลูกค้า/ผู้ขาย + เลขภาษี/สาขา/ที่อยู่)
- `fin_docs` + `fin_doc_items` เอกสาร 4 ชนิด: quotation/invoice/receipt/expense · เลขรันต่อร้าน/ปี (QT-, INV-, RC-, EXP-, JV-) · VAT แยกนอก/รวมใน · หัก ณ ที่จ่าย · `share_key` ลิงก์สาธารณะ
- `fin_payments` รับ-จ่ายเงิน + สลิป + ผล EasySlip + กันสลิปซ้ำ (unique trans_ref)
- `expense_categories` 10 หมวดไทย seed ทุกร้าน + map รหัสบัญชี 5xxx
- **GL:** `chart_of_accounts` (ผังบัญชีไทย 23 บัญชี seed ทุกร้าน) + `journal_entries`/`journal_lines`
- `products.cost` (COGS) + `fin_doc_items.product_id` (ตัดสต๊อก)
- ปลด trigger กันสร้างร้านซ้ำ → เจ้าของ 1 คนมีได้ 20 กิจการ (สำนักงานบัญชี)

**เครื่องยนต์บัญชี (src/lib/finance-server.ts):** ทุกธุรกรรมลงเดบิต/เครดิตอัตโนมัติ บังคับ Dr=Cr · ขายเชื่อ→AR/รายได้/ภาษีขาย · ขายสด→เงิน+WHT asset · ค่าใช้จ่าย→หมวด5xxx/ภาษีซื้อ/AP หรือจ่ายสด · รับ-จ่ายชำระ · COGS/ตัดสต๊อก · ยกเลิก = reversal + คืนสต๊อก (audit-safe ไม่ลบ)

**หน้าจอ:** ภาพรวมการเงิน (cash flow, ค้างรับ-จ่าย, เกินกำหนด) · เอกสารขาย (ออก/แปลง QT→INV→RC/พิมพ์ A4+ตัวอักษรไทย/ลิงก์ลูกค้า) · ค่าใช้จ่าย (AI อ่านบิล → กรอกฟอร์ม + 50 ทวิ) · การเงิน/กระทบยอด (อัปสลิปจับคู่ + import statement CSV/Excel) · ผู้ติดต่อ · สินค้า/บริการ (ราคา+ต้นทุน+สต๊อก) · สมุดรายวัน (+JV เอง) · รายงาน+ภาษี (P&L, Aging AR/AP, ภ.พ.30 รายช่อง, ภ.ง.ด.3/53 + ไฟล์ .txt, งบทดลอง, export Excel) · ตั้งค่า/ทีม/สลับกิจการ

**ลิงก์เอกสารสาธารณะ `/doc/[share_key]`:** ลูกค้าเห็นเอกสาร + QR พร้อมเพย์ยอดค้าง + อัปสลิปเอง → ระบบตรวจ EasySlip + ตัดยอด + ลงบัญชีอัตโนมัติ (บันทึกเฉพาะสลิปที่ตรวจผ่านจริงและยอดไม่เกินค้าง)

**ผู้ช่วยบัญชี AI (`/dashboard/assistant`):** 18 tools ครอบทุกงาน — เรียก action ชุดเดียวกับ UI (saveDoc/recordPayment/convertDoc/voidDoc) จึงลง GL/สต๊อก/audit ครบเสมอ · แนบรูปบิลในแชท → `/api/finance/extract` (Mistral OCR→Gemini→Claude→GPT) → AI บันทึกให้ · โควตา 100 ข้อความ/วัน/ร้าน + extract 60 ไฟล์/วัน

## 🔴 สิ่งเดียวที่บล็อกการใช้งาน AI (เหมือนเดิมจากรอบก่อน)
**`ai_provider_keys` = 0 แถว** — เจ้าของต้องเข้า `/dashboard/admin` ใส่ API key อย่างน้อย 1 ค่าย (แนะนำ Gemini ฟรี aistudio.google.com หรือ Mistral สำหรับ OCR บิล) · ระบบเอกสาร/บัญชี/รายงาน **ใช้ได้เต็มโดยไม่ต้องมี key** (คีย์มือ) — key จำเป็นเฉพาะผู้ช่วย AI + อ่านบิล

## 🆕 รอบขัดเงา 2026-07-23 (รอบสอง — หลังเจ้าของทดสอบจริง)
- **แก้ OAuth เฟส**: `/?code=` หลุดมาหน้าแรก → middleware ส่งต่อไป `/auth/callback` + คนล็อกอินแล้วเข้าหน้าแรกเด้งเข้า dashboard เลย
- **รายงานดูได้ราย เดือน/ไตรมาส/ปี** (`?period=2026-07 | 2026-Q3 | 2026`) ทุกแท็บ + แถวรวมงวด
- **Global AI Quota ต่อเจ้าของ (migration 055/057)**: โควตางาน AI (assistant+ocr) นับรวมทุกกิจการของเจ้าของ เพดาน = แพ็กที่ดีที่สุดที่จ่าย — ปั๊มบริษัทฟรีไม่ได้โควตาเพิ่ม · RPC `consume_ai_quota` (advisory lock) + `get_ai_quota_status` (member check) · แจ้งเตือนอัตโนมัติ 80%/95% ลง notifications · `shops.ai_quota_override` ให้ admin ปรับรายบัญชี (ยังไม่มี UI — ตั้งผ่าน SQL/Claude ได้)
- **หลอดเครดิต AI บน sidebar** (เขียว→เหลือง→แดง) + **paywall สวยในแชท AI** เมื่อโควตาเต็ม (ไม่โชว์ error ดิบ) — คีย์เอกสารเองไม่โดนจำกัด
- **จ่ายแพ็กเกจตรง (migration 056)**: ปุ่ม "สมัคร — จ่าย 990" → QR ยอดเท่าราคาแพ็ก → สลิปผ่าน (อัตโนมัติ/แอดมินยืนยัน) → RPC `apply_plan_purchase` เปิดแพ็ก+ตัดค่าแพ็ก+ตั้งรอบบิล +1 เดือนทันที (idempotent, ต่อยอดเครื่อง run_plan_billing เดิม) · เติมเครดิตพับเป็นตัวเลือกเสริม
- **UX**: Empty state ทุกหน้ามี icon+ปุ่ม CTA · ปุ่มดาวน์โหลด template statement CSV · แชท AI ตอบพร้อม **ปุ่มลิงก์เอกสาร** (เปิด/พิมพ์/ลิงก์ลูกค้า) · แถวเอกสาร void ขีดฆ่าจาง + หน้า detail บอก "ยกเลิกโดยใคร เมื่อไหร่"

## 🔲 งานถัดไป (เรียงตามผลกระทบ)
1. **ทดสอบ end-to-end บน production**: สมัคร → ตั้งกิจการ → ออก INV → ลิงก์ลูกค้า → สลิป → ดูสมุดรายวัน/รายงาน
2. **แพ็กเกจ/ราคาใน DB**: ตาราง `plans` ยังใช้ชื่อ field เดิม (included_replies ฯลฯ) — ตีความใหม่เป็น "งาน AI/เดือน" แล้ว copy หน้า billing อัปเดตแล้ว แต่ยังไม่ได้ปรับตัวเลขแพ็กใน DB ให้เหมาะ positioning ใหม่
3. **Approval flow** (ผู้มีอำนาจอนุมัติก่อนจ่าย/ยื่นภาษี + ลายเซ็นดิจิทัล) — โครง role มีแล้ว ยังไม่มี UI อนุมัติ
4. **แจ้งเตือน due date** เข้าอีเมล/LINE (ตอนนี้เห็นในหน้าภาพรวม) — มี Resend infra เดิมอยู่
5. ไฟล์ .txt ภ.ง.ด. เป็น pipe-format ทั่วไป — เทียบกับโปรแกรมโอนย้ายข้อมูลของสรรพากรก่อนยื่นจริงรอบแรก
6. ลบ edge functions ค้างบน Supabase dashboard + พิจารณา drop ตารางแชทบอทเก่าเมื่อแน่ใจ
7. Facebook App "SudoLogin" ยังใช้กับ OAuth login ได้ตามเดิม — ส่วน Meta review สำหรับ chatbot ไม่ต้องทำแล้ว

### ⚠️ ความปลอดภัย (ค้างจากรอบก่อน — ยังแนะนำ rotate)
Vercel token · Supabase management token · Facebook App Secret · รหัสบัญชีทดสอบ

## 🗂️ RPC ใหม่ที่สำคัญ
`next_fin_doc_number(shop, type)` เลขรันเอกสาร/JV · `seed_expense_categories` / `seed_chart_of_accounts` (trigger ตอนสร้างร้าน) · เดิมที่ยังใช้: `credit_wallet`, `billing_summary`, `run_plan_billing`, `decrement_stock` (qty ติดลบ=คืน), `is_platform_admin`, `store/get_ai_key`, `get_purpose_ai_key`, `store/get_shop_slip_key`, `admin_confirm_topup`, `next_invoice_number` (ใบเสร็จแพลตฟอร์ม)

## 🧪 ทดสอบ SQL
สร้าง auth.users ต้องใส่ token columns เช่น `confirmation_token` เป็น `''` ไม่ใช่ NULL (เคยทำ auth พังทั้งระบบมาแล้ว)
