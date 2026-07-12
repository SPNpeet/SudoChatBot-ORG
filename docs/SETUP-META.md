# ตั้งค่า Meta App (Facebook Messenger + Instagram DM)

## 1. สร้างแอป
1. developers.facebook.com → My Apps → Create App → Use case: **Other** → Type: **Business**
2. จด **App ID** และ **App Secret** (Settings → Basic) → ใส่เป็น secrets `META_APP_ID`, `META_APP_SECRET` ทั้งใน Supabase และ Vercel

## 2. เพิ่ม Messenger + Webhook
1. Add Product → **Messenger** → Settings
2. Webhooks → Callback URL:
   `https://uafnpbawajgonarvlurj.supabase.co/functions/v1/webhook-meta`
   Verify Token: ค่าเดียวกับ secret `META_VERIFY_TOKEN`
3. Subscribe fields: `messages`, `messaging_postbacks`
4. ทำเดียวกันกับ product **Instagram** (webhook object: instagram)

## 3. Facebook Login (ให้ปุ่ม "เชื่อมต่อ Facebook Page" ทำงาน)
1. Add Product → Facebook Login → Settings
2. Valid OAuth Redirect URIs:
   - `https://<โดเมน-vercel>/api/channels/meta/callback`
   - `https://uafnpbawajgonarvlurj.supabase.co/auth/v1/callback`

## 4. โหมดทดสอบ vs ใช้จริง
- **Dev mode**: ใช้ได้ทันทีกับเพจที่คุณเป็นแอดมิน + ผู้ใช้ที่เพิ่มเป็น Tester — เพียงพอสำหรับทดสอบและร้านแรกๆ ของคุณเอง
- **Live mode (รับลูกค้าทั่วไป)**: ต้องผ่าน App Review ขอ permission:
  `pages_show_list`, `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_messages`, `business_management`
  เตรียมวิดีโอสาธิต + Privacy Policy URL (สร้างหน้า /privacy บนเว็บ) — ใช้เวลาประมาณ 1-2 สัปดาห์
