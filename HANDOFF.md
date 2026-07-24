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

## 🆕 รอบสาม 2026-07-23 — Commercial-ready
- **ราคาใหม่ 4 แพ็ก (migration 058)**: Starter 990 (1 กิจการ, AI 150/ด, สลิป 300/ด) · Professional 1,990 ⭐ (3 กิจการ, AI 500, สลิป 1,000) · AI Executive 3,990 (5 กิจการ, AI 2,000, สลิปไม่จำกัด, ปลดล็อกไฟล์ยื่นภาษี) · Agency 9,900 (ไม่จำกัดกิจการ, AI 10,000) · free = ทดลองใช้ · **จุดขาย: พนักงานไม่จำกัดทุกแพ็ก** · migrate pro→professional, mini→starter, enterprise→agency แล้ว
- **โควตาสลิป/เดือน ต่อเจ้าของ** (RPC `check_slip_quota`) บังคับ 3 ทางเข้า (recordPayment, uploadAndMatchSlip, public slip) — เต็มแล้ว auto-verify ปิด แต่ยืนยัน manual ได้เสมอ
- **ลิมิตจำนวนกิจการตามแพ็ก** (RPC `can_create_company`) เช็คตอน createShop พร้อมข้อความชวนอัปเกรด
- **ไฟล์ยื่นสรรพากรมาตรฐาน RD Prep** (`src/lib/rd.ts`): pipe | เท่านั้น + rdClean ล้าง |/newline/tab + วันที่ DD/MM/YYYY **พ.ศ.** + เข้ารหัส **TIS-620** + CRLF · เพิ่ม .txt ให้รายงานภาษีซื้อ-ขายด้วย · **gate แพ็ก**: .txt ปลดล็อก executive/agency (platform admin ใช้ได้เสมอ) — ก่อนยื่นจริงรอบแรกให้ทดลอง import เข้าโปรแกรม RD Prep ยืนยันลำดับคอลัมน์
- **ศูนย์ AI (Admin)**: จัดกลุ่ม Accordion พับ/กาง + badge 🟢/🔴 ทุกหมวด + key แสดง masked ••••1234 + ตัด Embedding UI (ไม่ใช้หลัง pivot)
- **จัดการผู้ใช้ระบบ**: คอลัมน์ตั้งเพดานโควตา AI/วัน รายกิจการ (ai_quota_override) พร้อมปุ่มบันทึก
- **บีบอัดรูปก่อนอัปโหลดทุกจุด** (`src/lib/compress-image.ts` canvas ล้วน ไม่มี dependency ใหม่): สลิป/บิล/รูปสินค้า → JPEG ≤~300KB, ยาวสุด 1600px — ประหยัด Supabase Storage 1GB ได้หลักแสนใบ
- **กันบั๊ก padding มือถือ**: main pb ลดเหลือ 4.5rem+safe-area พอดี bottom nav (viewport-fit=cover อยู่แล้ว)
- **Vercel timeout**: เลือกใช้ maxDuration ต่อ route (60-120s, Vercel ปรับตามแพลนอัตโนมัติ) แทน Edge/streaming — โครง tool-loop 3 ค่าย + Supabase service ทำงานบน Node ได้เสถียรกว่า streaming refactor (streaming เป็น optimization เฟสถัดไป ถ้าเจอ timeout จริงบน Hobby ให้เปิด Fluid Compute ใน Vercel dashboard)
- หมายเหตุ: ระบบเชิญทีม (Unlimited Users) มีอยู่แล้วที่ ตั้งค่า → ทีมงาน (อีเมล + บทบาท, RLS แยกต่อกิจการ)

## 🆕 รอบสี่ 2026-07-24 — ศูนย์ AI แบบ Function-Centric (mig 059)
- **UI ใหม่เหลือ 2 การ์ด**: ① ผู้ช่วยบัญชี AI (สมองหลัก — ค่าย google/openai/anthropic) ② AI อ่านบิล OCR (mistral/google/openai/anthropic) — แต่ละการ์ด: dropdown ค่าย + **ช่องพิมพ์ชื่อโมเดลเองได้** (datalist แนะนำ) + key masked ••••1234 + badge 🟢/🔴 + ปุ่มทดสอบ (test-ai รองรับ `purpose`)
- **แก้โมเดลไม่ต้องวาง key ซ้ำ**: store_purpose_ai_key รับ p_key optional — ค่ายออกรุ่นใหม่ก็แก้ชื่อแล้วบันทึก จบ
- **Auto-Fallback อ่านบิล**: extract route ไล่ลำดับ การ์ด OCR → การ์ดผู้ช่วย → คีย์สำรอง (ai_provider_keys ทั้ง 8 ค่าย พับเก็บใน "ขั้นสูง") — ค่ายหลักล่มระบบสลับเองทันที
- **ตัดทิ้ง**: UI routing tiers (ขั้นที่ 2 เดิม ประหยัด/มาตรฐาน/พรีเมียม + embedding) + action saveRouting — ตาราง ai_settings ยังอยู่เป็น fallback data ของ resolveDefaultAiConfig เฉย ๆ
- **Seed แล้วบน production**: การ์ดผู้ช่วย = google/gemini-2.5-flash · การ์ด OCR = mistral/mistral-ocr-latest (คัดลอกจาก key เดิม ไม่ต้องกรอกใหม่) — **ทั้งสองการ์ดขึ้น 🟢 พร้อมใช้แล้ว**

## 🆕 รอบห้า 2026-07-24 — Guest AI Sandbox หน้าแรก (mig 060)
- **ทดลองคุยกับผู้ช่วยบัญชี AI ได้ฟรี 3 ครั้งบนหน้าแรก ไม่ต้องล็อกอิน** (`LandingSandboxChat` ใต้ตัวอย่างบทสนทนาเดิม) — PLG hook: หมดโควตาแล้วปุ่ม "สมัครใช้ฟรี" พาเข้า /login ทันที
- **ปลอดภัยโดยสถาปัตยกรรม ไม่ใช่แค่ prompt**: guest ไม่มี tool ใดๆ เลย (ไม่มี shop ให้ผูก จึงไม่มีข้อมูลจริงให้เข้าถึง/รั่วได้ตั้งแต่ต้น) ต่างจากข้อเสนอเดิมที่จะ "จำกัด tool call ไว้ 1 ครั้ง" — ไม่จำเป็นเพราะไม่มี tool ให้เรียกอยู่แล้ว
- **กันโกงโควตา 3 ชั้น**: (1) `sc_guest` คุกกี้ HttpOnly ตั้งจาก **middleware** ทุก request (แก้ไข/ปลอมจาก client ไม่ได้ ต่างจาก localStorage) จำกัด 3 ครั้งตลอดชีพต่อคุกกี้ (2) เพดาน 15 ครั้ง/IP/วัน (soft safety net กันสคริปต์ล้างคุกกี้วนสร้างใหม่จาก IP เดียว — ตั้งใจไม่ใช้ IP เป็นตัวจำกัดหลักเพราะ IP ร่วม (ออฟฟิศ/มือถือ) จะบล็อกคนดีจำนวนมาก) (3) เพดานรวม 300 ครั้ง/วันทั้งแพลตฟอร์ม กัน bot swarm
- **จำกัดความยาว 150 ตัวอักษร ฝั่ง server ด้วย** (ไม่ใช่แค่ frontend maxLength — ยิง API ตรงบายพาสไม่ได้)
- ใช้ Gemini Flash-Lite (ถูกสุด) ไม่ log เข้า `ai_usage_logs`/โควตาร้าน (แยกกระเป๋าคนละก้อนจากลูกค้าจริง) เพราะไม่มี shop_id ให้ผูก
- เช็ค `platform_billing_settings.ai_kill_switch` ก่อนตอบทุกครั้ง — **พบว่า kill switch ตัวนี้ปัจจุบันไม่ถูกบังคับใช้กับ AI ของร้านที่ล็อกอินแล้วเลย** (ตรวจสอบแล้ว: enforcement เดิมอยู่ใน edge functions ที่ถูกลบไปตอน pivot chatbot, เหลือแค่ tracking/UI ให้ admin ดู) — เป็นช่องโหว่แยกที่ควรแก้ต่างหาก ไม่ได้แก้ในรอบนี้ (ดูรายการงานถัดไป)

### Hardening รอบสอง (mig 061 — ทดสอบผ่านบน production แล้ว: 3 ครั้งตอบจริง ครั้งที่ 4 โดน HTTP 429)
- **Atomic RPC** `consume_guest_ai_quota(guest, ip_hash)`: advisory lock + นับ 3 ชั้น + insert ในทรานแซกชันเดียว (กัน race ยิงพร้อมกัน) — service_role เท่านั้น
- **ไม่เก็บ IP ดิบ (PDPA)**: HMAC-SHA256 (`RATE_LIMIT_IP_SECRET` ใน env ถ้าตั้ง, fallback service key) + IPv6 normalize เป็น /64 ก่อน hash
- **HTTP status ถูกต้อง**: 429+Retry-After เมื่อครบโควตา · 503 fail-closed เมื่อ RPC/kill switch ล่ม (ไม่ปล่อยผ่านเด็ดขาด) · 400 prompt ว่าง · 502+code `upstream_XXX` เมื่อค่าย AI ล่ม (วินิจฉัยได้โดยไม่รั่ว detail)
- **แก้บั๊ก AI ไม่ตอบ (เจอตอนทดสอบรอบแรก)**: เดิม hardcode gemini-2.5-flash-lite + maxOutputTokens 300 → Gemini 2.5 เป็น thinking model กินโทเคนจนตอบว่าง/ล้ม — แก้เป็น: ใช้คีย์จากการ์ดงานระบบ (purpose chat → assistant → คีย์สำรอง google) + ไล่โมเดลสำรองอัตโนมัติ + maxOutputTokens 1000

## 🆕 รอบหก 2026-07-24 — commit 283c69e (mig 062)
- **/signup แยกจาก /login**: ชื่อ+อีเมล+รหัสผ่าน 2 ช่อง (เช็คตรงกันสดๆ + ปุ่มตาโชว์รหัส) · สมัครผ่าน server action `auth.admin.createUser(email_confirm:true)` → **เข้าใช้ได้ทันที ไม่ต้องรอเมลยืนยัน** (แก้ปัญหา SMTP ฟรีส่งไม่ถึง hotmail = สมัครแล้วเงียบหาย) · CTA หน้าแรกทุกปุ่มชี้ /signup · **ทดสอบ e2e บน production แล้ว: สมัคร→ล็อกอินอัตโนมัติ→เข้าหน้าสร้างกิจการ ✓** (บัญชีทดสอบลบแล้ว)
- **Kill switch ครบทุก AI แล้ว** (ปิดช่องโหว่ข้อ 1 เดิม): `platform_ai_ok()` (mig 047 — เช็คทั้งสวิตช์ฉุกเฉิน+เพดาน $/วัน) ถูกเรียกใน assistantReply, /api/finance/extract และ guest sandbox (ตัวหลังอัปเกรดจากเช็คแค่ kill switch เป็นเช็คเพดานด้วย — ทดสอบบน production แล้วยังตอบปกติ ✓)
- **แก้บั๊กจริงที่เจ้าของเจอบนมือถือ** "ต้องมีรายการอย่างน้อย 1 บรรทัด" ตอน AI บันทึกบิล: saveDoc เคยกรองทิ้งรายการที่ไม่มี qty (ทั้งที่ schema บอก ไม่ระบุ=1) → แก้ filter + เพิ่ม `total_amount` fallback ใน create_expense (โมเดลไม่ส่ง items ก็ลงยอดรวมเป็นรายการเดียวได้)
- **UI มือถือ**: modal ทุกตัว (8 จุด) เปลี่ยนจาก bottom-sheet เป็นยึดด้านบน+scroll ได้ — คีย์บอร์ด iOS จะไม่ดันฟอร์มหลุดจอ (ต้นเหตุ "ปุ่มสร้างกิจการดำลอยค้างทุกหน้า" = modal ใน layout เปิดค้างข้ามหน้า + โดนคีย์บอร์ดดัน) · CompanySwitcher ปิด dropdown/modal อัตโนมัติเมื่อนำทาง · FAB ติชมเล็กลง, z ต่ำกว่าเมนูเพิ่มเติม, ซ่อนในหน้าผู้ช่วย AI, เพิ่ม padding ล่าง main กันปุ่มโดนบัง
- **Approval Flow (mig 062)**: พนักงาน (agent) บันทึกค่าใช้จ่าย → `approval_status=pending` ยังไม่ลง GL · owner/admin เห็นแบนเนอร์+ปุ่มในหน้าเอกสาร กดอนุมัติ = ตั้งหนี้ลงสมุดรายวันทันที / ปฏิเสธพร้อมเหตุผล · แท็บ "รออนุมัติ" ในหน้าค่าใช้จ่าย · เจ้าของบันทึกเอง = ผ่านทันทีเหมือนเดิม (ธุรกิจคนเดียวไม่สะดุด) · ยังไม่ได้ e2e กับบัญชี agent จริง
- **แจ้งเตือน LINE**: ใช้ **LINE Messaging API** (LINE Notify ปิดบริการ มี.ค. 2025 — สเปกที่ให้มาใช้ไม่ได้แล้ว) · ตั้งค่าที่หน้า ตั้งค่า → การ์ด 🔔 (Channel access token + User/Group ID + ปุ่มส่งทดสอบ) · token เก็บใน `shop_notify_settings` หลัง RLS ไม่มี policy = client อ่านไม่ได้ · ยิงแจ้งเมื่อมีค่าใช้จ่ายรออนุมัติ · helper `lib/line.ts` พร้อมต่อยอด (เช่น สรุป aging)

### UAT Approval Flow บน production (2026-07-24 — ผ่านแล้ว, commit 8666cab)
รันด้วยกิจการทดสอบแยก (สร้าง→ทดสอบ→ลบทิ้งหมดแล้ว): agent สั่งแชท AI "บันทึกค่าไฟ 2,340 จ่ายแล้ว" → ระบบบังคับเข้า pending ไม่ลง GL ไม่บันทึกจ่าย ✓ → owner เห็นแบนเนอร์กดอนุมัติ → JV-2026-0001 ลงถูก (Dr 5130 / Cr 2010 เจ้าหนี้) ✓
**บั๊กที่ UAT จับได้และแก้แล้ว:** Gemini เรียกแค่ tool อ่านหมวด แล้ว "อ้างว่าบันทึกแล้ว" โดยไม่เรียก create_expense เลย (เอกสารไม่เกิดจริง!) → แก้ 2 ชั้นใน engine.ts: เข้มกติกา prompt + ตาข่าย server-side (คำตอบอ้างสำเร็จแต่ไม่มี write-tool ถูกเรียก → บังคับวนอีกรอบให้ทำจริง) — ทดสอบซ้ำแล้วเรียก tool จริง ออก EXP-2026-0001 สำเร็จ

## 🔲 งานถัดไป (เรียงตามผลกระทบ)
2. **ทดสอบ end-to-end บน production**: ออก INV → ลิงก์ลูกค้า → สลิป → รายงานภาษี (สมัครสมาชิก + approval flow + GL ผ่านแล้ว)
4. **แจ้งเตือน due date** เข้าอีเมล/LINE (โครง LINE พร้อมแล้วใน lib/line.ts — เหลือ cron รายวันสรุป aging)
5. ไฟล์ .txt ภ.ง.ด./ภ.พ.30 เป็น pipe-format + TIS-620 แล้ว (mig 059) — ก่อนยื่นจริงรอบแรกให้ทดลอง import เข้าโปรแกรม RD Prep ยืนยันลำดับคอลัมน์ตรงเวอร์ชันล่าสุด
6. ลบ edge functions ค้างบน Supabase dashboard + พิจารณา drop ตารางแชทบอทเก่าเมื่อแน่ใจ
7. Facebook App "SudoLogin" ยังใช้กับ OAuth login ได้ตามเดิม — ส่วน Meta review สำหรับ chatbot ไม่ต้องทำแล้ว

### ⚠️ ความปลอดภัย (ค้างจากรอบก่อน — ยังแนะนำ rotate)
Vercel token · Supabase management token · Facebook App Secret · รหัสบัญชีทดสอบ

## 🗂️ RPC ใหม่ที่สำคัญ
`next_fin_doc_number(shop, type)` เลขรันเอกสาร/JV · `seed_expense_categories` / `seed_chart_of_accounts` (trigger ตอนสร้างร้าน) · เดิมที่ยังใช้: `credit_wallet`, `billing_summary`, `run_plan_billing`, `decrement_stock` (qty ติดลบ=คืน), `is_platform_admin`, `store/get_ai_key`, `get_purpose_ai_key`, `store/get_shop_slip_key`, `admin_confirm_topup`, `next_invoice_number` (ใบเสร็จแพลตฟอร์ม)

## 🧪 ทดสอบ SQL
สร้าง auth.users ต้องใส่ token columns เช่น `confirmation_token` เป็น `''` ไม่ใช่ NULL (เคยทำ auth พังทั้งระบบมาแล้ว)
