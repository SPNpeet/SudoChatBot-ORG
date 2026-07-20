# Vendor Review — บริการภายนอกทั้งหมดที่ SudoChatBot พึ่งพา
**วันที่:** 2026-07-21 · **ประเภท:** Portfolio review (ทุก vendor พร้อมกัน) + ลงมือแก้ความเสี่ยงที่พบ

## สรุป
ระบบพึ่งพา vendor 9 กลุ่ม ต้นทุนปัจจุบัน **~33฿/เดือน** (ค่าโดเมนเฉลี่ย) ทุกตัวอยู่ใน free tier ความเสี่ยงร้ายแรงที่สุดคือ **Supabase concentration risk** (DB+Auth+Storage+Functions+Queue อยู่เจ้าเดียว ไม่มี backup อัตโนมัติบน Free plan) — **ปิดไปแล้วบางส่วนในรีวิวนี้** ด้วย schema baseline อัตโนมัติจาก DB จริง (`supabase/baseline/000_baseline_schema.sql`) ที่เหลือคืออัป Pro ($25/เดือน) เมื่อมีรายได้จริง

## ต้นทุน (TCO)
| Vendor | บทบาท | ตอนนี้ | เมื่อโต | หมายเหตุ |
|---|---|---|---|---|
| Supabase Free | DB/Auth/Storage/Edge Fn/Queue | 0฿ | $25/เดือน (Pro) | เพดาน: DB 500MB, ไม่มี auto-backup |
| Vercel Hobby | Frontend + Server Actions | 0฿ | $20/เดือน (Pro) | เพดาน bandwidth/invocations |
| Hostinger | โดเมน sudochatbot.online | ~400฿/ปี | เท่าเดิม | ต่ออายุอัตโนมัติถึง ก.ค. 2027 |
| AI 8 ค่าย | สมองบอท (แพลตฟอร์มออกค่า) | ตามใช้จริง (ดู stats) | สเกลตามรายได้ | มีเพดานกันเผา: playground 50/วัน, import 20 ไฟล์/วัน, ads 30/วัน + billing gate ต่อข้อความ |
| Meta / LINE / TikTok | ช่องทางแชท | 0฿ | LINE push มีโควตา* | *โค้ดใช้ reply token (ฟรี) ก่อน push เสมอ (`_shared/line.ts`) |
| EasySlip / SlipOK | ตรวจสลิปอัตโนมัติ | 0฿ (manual mode) | ตามแพ็กเกจเจ้าที่เลือก | สลับเจ้าได้จากหน้า admin — ไม่ lock-in |
| Omise | บัตร/จ่ายอัตโนมัติ (ยังไม่เปิด) | 0฿ | ~3.65%/รายการ | เปิดเมื่อพร้อม ระบบรองรับแล้ว |
| Resend | อีเมลระบบ (ยังไม่ตั้ง key) | 0฿ | ฟรี 3,000/เดือน | แจ้งเตือนใน dashboard ทำงานแทนได้อยู่แล้ว |
| **รวมตอนนี้** | | **~33฿/เดือน** | ~1,700฿/เดือน ที่สเกลแรก | เทียบคู่แข่ง ECOUNT เก็บลูกค้า 1,700฿/เดือน/ราย |

## ความเสี่ยง + สถานะการแก้
| ความเสี่ยง | โอกาส | ผลกระทบ | การแก้ | สถานะ |
|---|---|---|---|---|
| Supabase เจ้าเดียวถือทุกอย่าง + Free ไม่มี backup | ต่ำ | **สูงมาก** | (1) schema baseline generate จาก DB จริง 108KB: 38 ตาราง/56 ฟังก์ชัน/95 policies/61 indexes/19 triggers/5 คิว/4 buckets/seed plans → กู้โครงสร้างได้จาก git ล้วนๆ (2) migrations 017-042 อยู่ใน git ครบ (3) อัป Pro เมื่อมีรายได้ → ได้ PITR backup ข้อมูล | ✅ (1)(2) เสร็จในรีวิวนี้ · ⬜ (3) รอคุณ |
| Meta token หมดอายุ (ads ~60 วัน) | สูง (เกิดแน่) | กลาง | `token_expires_at` + watchdog แจ้งต่ออายุ + banner เชื่อมต่อใหม่ | ✅ มีแล้ว |
| AI ค่ายหลักล่ม/แบน key | กลาง | สูง | fallback 8 ค่ายอัตโนมัติ + test status ต่อ key | ✅ มีแล้ว |
| ตรวจสลิปเจ้าเดียวล่ม | กลาง | กลาง | 2 เจ้าสลับได้ + โหมด manual (แอดมินกดยืนยัน) เป็น fallback สุดท้าย | ✅ มีแล้ว |
| LINE push cost โตตามสเกล | กลาง | ต่ำ | reply token ฟรีถูกใช้ก่อนเสมอ push เป็น fallback | ✅ มีแล้ว |
| Vercel serverless timeout ตัด AI กลางลูป | กลาง | กลาง | `maxDuration` ทุก AI route (ads 90s/orders 120s/playground+settings 60s/extract 120s) | ✅ แก้ในรอบนี้ |
| Vendor webhook ปลอม/replay | ต่ำ | สูง | HMAC ทุกแพลตฟอร์ม + dedupe unique constraint + Omise ยืนยัน charge กับ API ตรง | ✅ มีแล้ว |
| Hostinger โดเมนหลุด | ต่ำ | สูง | ต่ออายุอัตโนมัติถึง 2027 — ตรวจบัตรผูกบิลปีหน้า | ⬜ เตือนความจำ |

## จุดแข็ง
- ต้นทุนเกือบศูนย์ แต่ทุก vendor วิกฤตมีทางหนี (AI 8 ค่าย, สลิป 2 เจ้า+manual, จ่ายเงิน 2 ทาง)
- Secret ทุกตัวอยู่ Vault — เปลี่ยน vendor = เปลี่ยน key ที่เดียว ไม่แตะโค้ด
- โครงสร้าง DB กู้ได้ 100% จาก git (baseline + migrations 017-042) โดยไม่ต้องพึ่ง backup ของ Supabase

## ข้อกังวลที่เหลือ
- **ข้อมูล** (ไม่ใช่โครงสร้าง) ยังไม่มี backup จนกว่าจะอัป Supabase Pro — ช่วงนี้ผู้ใช้จริงยังน้อย ความเสียหายจำกัด แต่ควรอัปทันทีที่มีรายได้
- Edge function `zz-test-bundle` ค้างจากการทดสอบ deploy (ไม่มีสิทธิ์อะไร, verify_jwt เปิด) — MCP ไม่มีคำสั่งลบ ลบได้จาก Supabase dashboard → Edge Functions

## คำแนะนำ
**Proceed ทุก vendor** — ไม่มีตัวไหนควรเปลี่ยนตอนนี้ ลำดับการจ่ายเงินเมื่อมีรายได้: Supabase Pro ($25) ก่อนเสมอ (backup+leaked-password) → Vercel Pro เมื่อชน bandwidth → EasySlip/SlipOK แพ็กจริงเมื่อร้านเปิด auto-verify กันเยอะ
