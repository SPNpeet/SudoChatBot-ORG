# ตั้งค่า LINE Official Account (ต่อ 1 ร้าน — ร้านทำเองได้ใน 10 นาที)

1. ร้านสร้าง LINE OA ฟรีที่ manager.line.biz (ถ้ายังไม่มี)
2. เปิดใช้ Messaging API: LINE Official Account Manager → Settings → Messaging API → Enable
   (ระบบจะสร้าง Channel ใน developers.line.biz ให้)
3. เข้า developers.line.biz → เลือก Channel → เก็บ 3 ค่า:
   - **Channel ID** (Basic settings)
   - **Channel Secret** (Basic settings)
   - **Channel Access Token (long-lived)** (Messaging API → Issue)
4. เอา 3 ค่านี้กรอกใน Dashboard → หน้า "ช่องทาง" → LINE → เชื่อมต่อ
5. ระบบจะแสดง **Webhook URL เฉพาะร้าน** → คัดลอกไปวางใน LINE Developers → Messaging API → Webhook URL → กด Verify → เปิด "Use webhook"
6. ปิด Auto-reply เดิมของ LINE: Official Account Manager → Response settings → ปิด Auto-response / เปิด Webhook

ทดสอบ: แอดเพื่อน OA แล้วทักถามราคาสินค้า — บอทควรตอบใน ~5 วินาที
