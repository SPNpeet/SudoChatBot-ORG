# เตรียม Meta App Review — ให้เพจคนทั่วไปเชื่อม SudoChatBot ได้

> สถานะปัจจุบัน: แอปอยู่ dev mode ใช้ได้เฉพาะเพจของคนที่มี role ในแอป · ผ่าน review แล้วทุกเพจเชื่อมได้

## Permissions ที่ต้องขอ

| Permission | ใช้ทำอะไรในระบบ |
|---|---|
| `pages_show_list` | ให้ผู้ใช้เลือกเพจตอนเชื่อมต่อ (api/channels/meta/start) |
| `pages_messaging` | บอทรับ-ส่งข้อความ Messenger (webhook-meta + metaSend) |
| `pages_manage_metadata` | ผูก webhook กับเพจอัตโนมัติ |
| `instagram_basic` + `instagram_manage_messages` | รับ-ตอบ Instagram DM |
| `business_management` | (ถ้าเพจอยู่ใต้ Business Portfolio) |

## สิ่งที่ Meta ต้องเห็น (มีครบแล้วในระบบ)

- ✅ Privacy Policy: `https://sudochatbot.online/privacy`
- ✅ Terms: `https://sudochatbot.online/terms`
- ✅ Data Deletion: `https://sudochatbot.online/data-deletion`
- ✅ โดเมนจริง + SSL
- ⬜ App icon 1024×1024 + ชื่อ/คำอธิบายแอปใน App Dashboard
- ⬜ Business Verification (ยืนยันธุรกิจใน Business Manager — ใช้เอกสารจดทะเบียน/บัตรประชาชน)

## Screencast ที่ต้องอัด (หัวใจของการผ่าน review)

อัดวิดีโอเดียวยาว 2-4 นาที ตามสคริปต์นี้ (ใช้เพจทดสอบของตัวเอง):

1. เปิด `sudochatbot.online` → login → หน้า dashboard
2. หน้า "ช่องทาง" → กด "เชื่อมต่อ Facebook Page" → หน้าต่าง OAuth ของ Meta ขึ้น → เลือกเพจ → กดยอมรับ permissions (**ให้เห็น dialog ขอ permission ทุกตัวชัด ๆ**)
3. กลับมาที่ระบบ เห็นเพจขึ้นสถานะ "ใช้งาน"
4. เปิดมือถือ/อีกจอ ทักแชทไปที่เพจนั้นเป็นลูกค้า: ถามสินค้า → บอทตอบ
5. กลับมาที่ dashboard หน้า "แชท" ให้เห็นบทสนทนาเข้ามา + แอดมินกดสลับมาตอบเองได้
6. จบด้วยหน้า ออเดอร์ ที่บอทสร้างให้

จุดที่ reviewer ให้ตก: วิดีโอไม่เห็น OAuth dialog / ไม่เห็น permission ถูก "ใช้จริง" — ทุก permission ที่ขอต้องปรากฏการใช้งานในวิดีโอ

## คำอธิบายการใช้ permission (กรอกใน review form — ปรับได้)

> SudoChatBot is a B2B SaaS that lets Thai SME shop owners connect their own Facebook Page and Instagram account to an AI sales assistant. `pages_messaging` is used to receive customer messages via webhook and send replies on behalf of the page. `pages_show_list` lets the page admin select which of their pages to connect during onboarding. `instagram_manage_messages` provides the same for Instagram DM. Messages are processed only to answer shopping questions for that page's customers; no data is sold or used for ads.

## ขั้นตอนยื่น

1. App Dashboard → App Review → Permissions and Features → ขอทีละ permission ตามตาราง
2. แนบ screencast + คำอธิบาย + บัญชีทดสอบ (สร้าง user ทดสอบใน App Roles ให้ reviewer login ได้: อีเมล+รหัสที่ใช้เข้า sudochatbot.online)
3. รอ 2-7 วันทำการ ถ้าตกอ่านเหตุผลแล้วแก้ยื่นใหม่ได้ไม่จำกัด

## ระหว่างรอ review

dev mode ใช้กับเพจตัวเองได้เต็มรูปแบบ — เชื่อมเพจจริงของร้านคุณ ทดสอบขายจริง เก็บวิดีโอไว้ใช้ยื่นได้เลย
