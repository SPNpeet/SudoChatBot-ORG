# ของยุคแชทบอทที่ถูกลบออก — บันทึกไว้เผื่อต้องอ้างอิงย้อนหลัง

> ลบเมื่อ 27 ก.ค. 2569 ตามคำสั่งเจ้าของ
> โปรเจกต์นี้เคยเป็นแชทบอทขายของ แล้ว pivot มาเป็นระบบบัญชี
> ของพวกนี้ค้างอยู่จากยุคนั้น ไม่มีอะไรเรียกใช้แล้ว

## ตรวจอะไรก่อนลบ (ผ่านทุกข้อ)

| ตรวจ | ผล |
|---|---|
| โค้ดใน `src/` อ้างถึงไหม | 0 ไฟล์ ทุกตัว |
| ฟังก์ชันอื่นในฐานข้อมูลเรียกไหม | 0 |
| ผูกกับ trigger ไหม | 0 |
| มี view อ้างถึงไหม | 0 |
| ผู้ใช้ล็อกอิน / คนนอก เรียกได้ไหม | ไม่ได้ (service_role เท่านั้น) |
| **ผู้ช่วยบัญชี AI ใช้ไหม** | **ไม่ใช้** — ใช้แค่ `consume_ai_quota` · `get_ai_key` · `get_purpose_ai_key` · `platform_ai_ok` · `is_platform_admin` · `next_fin_doc_number` · `get_platform_omise_key` |

## ฟังก์ชันที่ลบ (6 ตัว)

| ฟังก์ชัน | เคยทำอะไร | ตารางที่อ้างถึง (ยุคแชทบอท) |
|---|---|---|
| `bill_bot_reply(uuid, text, int)` | ตัดโควตา/หักเครดิตทุกครั้งที่บอทตอบลูกค้า | `usage_monthly` `usage_daily` `wallets` `billed_refs` `plans` |
| `check_shop_rate_limit(uuid)` | จำกัดจำนวนข้อความบอทต่อนาที/ต่อวัน | `rate_limit_counters` `plans` |
| `next_order_number(uuid)` | ออกเลขออเดอร์ `ORDyymm-00001` | `shop_counters` |
| `notify_bot_blocked(uuid)` | อีเมลแจ้งเจ้าของร้านว่าบอทหยุดตอบเพราะเครดิตหมด | `notifications` `audit_logs` |
| `notify_handoff(uuid, uuid)` | อีเมลแจ้งว่าลูกค้าขอคุยกับแอดมิน | `conversations` `customers` |
| `notify_order_paid(uuid, uuid)` | อีเมลแจ้งว่าออเดอร์ชำระแล้ว | `orders` |

**ที่ไม่ได้ลบ** — `send_platform_email` และ `shop_owner_email` เก็บไว้ เพราะเป็นเครื่องมือทั่วไปที่ระบบบัญชีอาจใช้ส่งอีเมลแจ้งเตือนในอนาคต

## ถ้าต้องกู้คืน

ฟังก์ชันพวกนี้อ้างถึงตารางยุคแชทบอท (`orders` `conversations` `customers` `wallets`)
ต่อให้กู้กลับมาก็ทำงานกับระบบบัญชีไม่ได้อยู่ดี — ถ้าจำเป็นจริงให้กู้จาก
**Supabase automatic backup** ของวันก่อน 27 ก.ค. 2569 หรือดูใน git history ของ migration เก่า

## Edge functions ที่ยังค้างอยู่ (ผมลบเองไม่ได้)

MCP ที่ผมใช้ไม่มีคำสั่งลบ edge function — **เจ้าของต้องลบเองที่ Supabase dashboard › Edge Functions**
ตรวจแล้วว่าแอปปัจจุบัน **ไม่เรียก edge function เลยแม้แต่ตัวเดียว** (ไม่มี `functions.invoke` หรือ `/functions/v1` ในโค้ด)

| Edge function | ยุคแชทบอท | หมายเหตุ |
|---|---|---|
| `webhook-meta` | Facebook/Instagram | ลบได้ |
| `webhook-line` | LINE แชทบอทเก่า | **ลบได้** — LINE ปัจจุบันใช้ `src/app/api/line/webhook` ในแอปแทนแล้ว |
| `webhook-tiktok` | TikTok | ลบได้ |
| `queue-worker` | คิวงานบอท | ลบได้ |
| `doc-processor` | ประมวลผลเอกสารเก่า | ลบได้ |
| `slip-verifier` | ตรวจสลิป | **ลบได้** — ปัจจุบัน `src/lib/slip-verify.ts` ยิงตรงไป EasySlip / SlipOK จากเซิร์ฟเวอร์ Next.js |
| `ads-watchdog` | ยิงแอด | ลบได้ |
| `zz-test-bundle` | ไฟล์ทดสอบ | ลบได้ |

> ก่อนลบ `webhook-line` และ `slip-verifier` ให้เช็คอีกครั้งว่าไม่มี webhook ภายนอก
> (LINE Developers Console / ผู้ให้บริการตรวจสลิป) ชี้ URL มาที่ edge function เหล่านี้อยู่
