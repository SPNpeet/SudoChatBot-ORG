# 📦 ชุดยื่น Meta App Review — ฉบับพร้อมยื่นจริง

> เป้าหมาย: ให้**ทุกเพจ**เชื่อม SudoChatBot ได้ (ตอนนี้ dev mode ใช้ได้เฉพาะเพจของ admin/tester ของแอป)
> แอป: **SudoLogin** App ID `1548418113603775` · อัปเดต: 2026-07-19

## สถานะความพร้อม — เหลือ 2 อย่างที่ระบบทำแทนไม่ได้

| สิ่งที่ Meta ต้องการ | สถานะ |
|---|---|
| Privacy Policy `https://sudochatbot.online/privacy` | ✅ ขึ้นแล้ว ตอบ 200 |
| Terms `https://sudochatbot.online/terms` | ✅ |
| Data Deletion `https://sudochatbot.online/data-deletion` | ✅ (ใส่ URL นี้ในช่อง Data Deletion Instructions ของ App Settings → Basic) |
| โดเมนจริง + SSL | ✅ |
| App icon 1024×1024 | ✅ อัปโหลดแล้ว (โลโก้จริง) |
| Scope ในโค้ดตรงกับที่ยื่นขอ | ✅ อัปเดต 2026-07-20: โค้ดขอ **10 ตัว** (เพิ่มชุดคอมเมนต์ 4 ตัว) — ยื่นให้ครบทั้ง 10 |
| **Business Verification** | ⬜ **คุณต้องทำเอง** — Business Settings → Security Center → Start Verification ใช้เอกสารจดทะเบียนพาณิชย์/หนังสือรับรองบริษัท (ถ้าไม่มีนิติบุคคล ใช้ทะเบียนพาณิชย์บุคคลธรรมดาได้) รอ 1-5 วันทำการ **ทำก่อนหรือพร้อมกับยื่น review ได้** |
| **Screencast 2-4 นาที** | ⬜ **คุณต้องอัดเอง** — สคริปต์เป๊ะ ๆ อยู่ด้านล่าง |

## Permission ที่ยื่นขอ (10 ตัว — ตรงกับ scope ในโค้ด `api/channels/meta/start`)

| # | Permission | ใช้ตรงไหนในระบบ | ต้องเห็นในวิดีโอช่วงไหน |
|---|---|---|---|
| 1 | `pages_show_list` | ดึงรายชื่อเพจตอนกด "เชื่อมต่อ Facebook Page" | นาที 0:30 — dialog เลือกเพจ |
| 2 | `pages_messaging` | รับข้อความลูกค้าผ่าน webhook + บอทตอบกลับ + private reply หาคนคอมเมนต์ | นาที 1:30 — ลูกค้าทัก บอทตอบ |
| 3 | `pages_manage_metadata` | ผูก webhook (messages + feed) เข้ากับเพจอัตโนมัติหลัง OAuth | นาที 0:50 — เพจขึ้นสถานะ "ใช้งาน" ทันที |
| 4 | `instagram_basic` | อ่านบัญชี IG Business ที่ผูกกับเพจ | นาที 0:50 — IG ปรากฏใต้เพจในหน้า ช่องทาง |
| 5 | `instagram_manage_messages` | รับ-ตอบ Instagram DM + private reply หาคนคอมเมนต์ IG | นาที 2:30 — DM จาก IG บอทตอบ |
| 6 | `business_management` | เข้าถึงเพจที่อยู่ใต้ Business Portfolio (เพจยุคใหม่ส่วนใหญ่อยู่ใต้ portfolio) | นาที 0:30 — เพจใน portfolio โผล่ใน dialog |
| 7 | `pages_read_user_content` | อ่านข้อความคอมเมนต์ของลูกค้าใต้โพสต์เพจ (webhook field `feed`) | นาที 3:00 — คอมเมนต์ใต้โพสต์ → ระบบเห็น |
| 8 | `pages_manage_engagement` | ตอบคอมเมนต์แบบสาธารณะในนามเพจ (`POST /{comment-id}/comments`) | นาที 3:15 — reply "ตอบใน DM แล้วนะคะ" ใต้คอมเมนต์ |
| 9 | `pages_read_engagement` | อ่าน metadata เพจประกอบฟีเจอร์คอมเมนต์ | นาที 3:00 |
| 10 | `instagram_manage_comments` | อ่าน+ตอบคอมเมนต์ IG (webhook `comments` + `POST /{ig-comment-id}/replies`) | นาที 3:30 — คอมเมนต์ IG → บอทตอบ+DM |

> ⚠️ IG comments webhook ต้องเปิด field `comments` ที่ระดับแอปด้วย: App Dashboard → Webhooks → Instagram → Subscribe to `comments`

> ถ้าโดนตีตกเฉพาะ `business_management` (Meta เข้มตัวนี้สุด): ยื่นรอบสองโดยตัดมันออกจาก scope ในโค้ดได้ — เพจแบบคลาสสิกยังเชื่อมได้ เพจใต้ portfolio จะหายไปจาก dialog เท่านั้น

## คำตอบสำหรับฟอร์ม (ฟอร์มถาม "How will you use this permission?" ทีละตัว — copy ไปวางได้เลย)

**ทุกตัวขึ้นต้นด้วยย่อหน้านี้ (บริบทแอป):**
> SudoChatBot (sudochatbot.online) is a B2B SaaS for Thai SME shop owners. A shop owner connects their own Facebook Page / Instagram account, and our AI sales assistant answers their customers' shopping questions in Messenger/Instagram DM on the page's behalf. Data is processed only to serve that page's own customers; nothing is sold, shared, or used for advertising.

**pages_show_list**
> Used once during onboarding: after the page admin clicks "Connect Facebook Page" in our dashboard, we call `/me/accounts` so the admin can see and confirm which of their pages get connected. Shown in the screencast at ~0:30.

**pages_messaging**
> Core of the product. We receive customer messages via Messenger webhook and send the AI assistant's replies on behalf of the connected page using the page access token. Shown at ~1:30: a customer messages the page and the assistant replies with product info from the shop's catalog.

**pages_manage_metadata**
> Right after the admin confirms the connection, we call `POST /{page-id}/subscribed_apps` to subscribe the page to our webhook so messages start flowing without any manual webhook setup. Shown at ~0:50: the page appears as "Active" immediately after OAuth.

**instagram_basic**
> During connection we read the `instagram_business_account` linked to the page (id and username) so the shop's Instagram appears in the dashboard as a connected channel. Shown at ~0:50.

**instagram_manage_messages**
> Same as pages_messaging but for Instagram DM: we receive DMs to the connected IG business account via webhook and send the assistant's replies. Shown at ~2:30.

**business_management**
> Many Thai SME pages are owned by a Business Portfolio. This permission lets the page admin see and connect those pages during the same OAuth flow. We do not read or modify any other business asset. Shown at ~0:30 (portfolio-owned page appears in the page picker).

**pages_read_user_content**
> Used by our opt-in "comment assistant" feature: when someone comments under the connected page's own post, we receive the comment via the `feed` webhook and read its text so the AI can answer the customer's question. Only comments on the page's own posts are processed. Shown at ~3:00.

**pages_manage_engagement**
> After answering a commenter privately, the assistant posts one short public reply under the comment as the page (e.g. "Answered in your DM") via `POST /{comment-id}/comments`, so other customers know the shop is responsive. The shop owner can customize or disable this reply. Shown at ~3:15.

**pages_read_engagement**
> Read-only page engagement metadata used alongside pages_read_user_content to support the comment assistant feature. Shown at ~3:00.

**instagram_manage_comments**
> Same comment-assistant feature for Instagram: we receive new comments on the connected IG business account's posts via the `comments` webhook and post a short public reply via `POST /{ig-comment-id}/replies`, then answer privately via Private Replies (one message per comment, per platform policy). Shown at ~3:30.

## ยื่นแยกทีหลัง (อย่ารวมใน submission แรก): ชุดโฆษณา
ฟีเจอร์ "ยิงแอด AI" ใช้ scope `ads_management,ads_read` ใน OAuth เส้นแยก (`/api/ads/meta/start`) — ตอนนี้ใช้ได้ใน dev mode กับบัญชีโฆษณาของ admin แอปทันที ไม่ต้อง review
เมื่อจะเปิดให้ร้านทั่วไป:
1. **App Review** ขอ Advanced Access `ads_management` + `ads_read` (ต้องผ่าน Business Verification ก่อน)
2. **Access Verification (Tech Provider)** — ขั้นตอนแยกสำหรับแอปที่จัดการข้อมูลธุรกิจอื่น: App Settings → Basic → Access Verification (~5 วันทำการ) — ชุดคอมเมนต์ (`pages_manage_engagement`, `pages_read_user_content`, `pages_read_engagement`) ก็เข้าเกณฑ์นี้ด้วย
3. **Marketing API Full Access** — อัปเกรดอัตโนมัติเมื่อยิง API สำเร็จ 500 ครั้ง/15 วัน + error rate <15% (ดูสถานะใน App Dashboard → Permissions & Features) — ระหว่างนี้ dev tier จำกัดแค่ rate (~300 calls/ชม./บัญชีแอด) ไม่จำกัดจำนวนบัญชี

## บัญชีทดสอบให้ reviewer (ต้องมี ไม่งั้นตกทันที)

1. สมัคร user ใหม่ใน sudochatbot.online (อีเมล+รหัสจริงที่ใช้งานได้ เช่น `meta.reviewer@yourdomain`) → สร้างร้านทดสอบ ใส่สินค้า 2-3 ตัว
2. กรอกในฟอร์ม review ช่อง "Testing instructions / test credentials":
> 1. Go to https://sudochatbot.online/login — sign in with email `<อีเมล>` password `<รหัส>`
> 2. You land on the shop dashboard. Open "ช่องทาง" (Channels) in the sidebar.
> 3. Click the blue "เชื่อมต่อ Facebook Page" (Connect Facebook Page) button → Meta OAuth dialog appears → approve.
> 4. Message the connected page from any account: ask about a product (e.g. "มีอะไรขายบ้าง") — the AI assistant replies within seconds.
3. **อย่าลบ/เปลี่ยนรหัสบัญชีนี้จนกว่ารีวิวจะจบ** — reviewer ล็อกอินจริง

## สคริปต์อัดวิดีโอ (เทคเดียว 2-4 นาที ไม่ต้องตัดต่อ ไม่ต้องพากย์ — คำบรรยายในฟอร์มพอ)

เตรียมก่อนอัด: เพจทดสอบของตัวเอง (ผูก IG business ไว้ด้วยถ้ามี) · ร้านใน SudoChatBot มีสินค้า+AI key แล้ว · มือถือหรือจอที่สองไว้เล่นบทลูกค้า

| เวลา | ทำอะไร | พิสูจน์ permission |
|---|---|---|
| 0:00 | เปิด `sudochatbot.online` → login → เห็น dashboard | — |
| 0:20 | เข้าหน้า **ช่องทาง** → กด **เชื่อมต่อ Facebook Page** | — |
| 0:30 | OAuth dialog ของ Meta ขึ้น → **ค้างหน้าจอที่ลิสต์ permission ไว้ 3-4 วินาที** → เลือกเพจ → ยอมรับ | `pages_show_list` `business_management` |
| 0:50 | เด้งกลับมาหน้า ช่องทาง — เพจ (และ IG) ขึ้นสถานะ **"ใช้งาน"** โดยไม่ต้องตั้งอะไรเพิ่ม | `pages_manage_metadata` `instagram_basic` |
| 1:10 | หยิบมือถือ/จอสอง ทัก Messenger ไปที่เพจเป็นลูกค้า: "สวัสดีครับ มีอะไรขายบ้าง" | — |
| 1:30 | บอทตอบพร้อมข้อมูลสินค้าจริง → คุยต่อ 2-3 ประโยค เช่น ถามราคา | `pages_messaging` |
| 2:00 | กลับมา dashboard หน้า **แชท** — เห็นบทสนทนาเดียวกันเข้ามา | ยืนยัน webhook ทำงาน |
| 2:30 | (ถ้ามี IG) DM ไปที่ IG ของเพจ → บอทตอบ | `instagram_manage_messages` |
| 3:00 | จบที่หน้า **ออเดอร์** หรือหน้าแชท ให้เห็นว่าระบบใช้งานจริง | — |

**กฎเหล็กของวิดีโอ**: เห็น OAuth dialog เต็ม ๆ ห้ามข้าม · ทุก permission ที่ขอต้องมีฉากใช้งาน · ห้ามเบลอ/ตัดช่วง OAuth · อัดจากหน้าจอจริง ไม่ใช่สไลด์

## ขั้นตอนกดยื่น (ตามหน้าจอจริงของ App Dashboard)

1. developers.facebook.com → เลือกแอป **SudoLogin** → เมนูซ้าย **App Review → Permissions and Features** (ชื่อไทย: การตรวจสอบแอพ → สิทธิ์การอนุญาตและฟีเจอร์)
2. ค้นหา permission ทีละตัวตามตาราง 6 ตัว → กด **Request Advanced Access** (ขอสิทธิ์การเข้าถึงขั้นสูง)
3. Meta จะรวมทุกตัวเป็นคำขอเดียว → กรอกฟอร์ม: วางคำตอบภาษาอังกฤษด้านบน + อัปโหลดวิดีโอ (ใช้ไฟล์เดียวกันได้ทุก permission) + ใส่บัญชีทดสอบ
4. ส่วน Data Handling / Platform Terms ถ้าถาม: เราเก็บข้อความลูกค้าเพื่อตอบแชทของเพจนั้นเท่านั้น เก็บใน Supabase (สิงคโปร์) เข้ารหัส ไม่ขายข้อมูล ไม่ใช้โฆษณา — สอดคล้องหน้า privacy ที่ยื่นไว้
5. กด Submit → สถานะ "In Review" → รอ **2-7 วันทำการ** (ตอบกลับทางอีเมล + แจ้งเตือนในแอป)
6. **ผ่านแล้ว**: สลับแอปจาก Development → **Live** (สวิตช์บนหัวหน้า dashboard ของแอป) — จากนั้นทุกเพจเชื่อมได้ทันที ไม่ต้องแก้โค้ดอะไรอีก

## สาเหตุตกรีวิวที่เจอบ่อย (กันไว้ก่อนยื่น)

- ❌ วิดีโอไม่เห็น OAuth dialog / เห็นแต่ตัดข้าม → **ตกทันที** อัดใหม่ให้ค้างหน้า dialog
- ❌ ขอ permission ที่ไม่ปรากฏการใช้ในวิดีโอ → เราตัด `pages_read_engagement` ทิ้งแล้วด้วยเหตุนี้
- ❌ บัญชีทดสอบล็อกอินไม่ได้/ร้านว่างเปล่า ไม่มีสินค้า → reviewer ทดสอบไม่ได้ = ตก
- ❌ Business Verification ยังไม่ผ่านตอน Meta ตรวจ → คำขอค้าง ทำ verification ให้จบเร็วสุด
- ❌ ลิงก์ privacy/data-deletion ตาย → ของเราขึ้นแล้ว แต่เช็คอีกครั้งวันยื่น
- ตกแล้ว**ยื่นใหม่ได้ไม่จำกัด** — อ่านเหตุผลในอีเมล แก้เฉพาะจุด แล้วยื่นซ้ำ

## ระหว่างรอรีวิว

dev mode ใช้ได้เต็มระบบกับเพจของคนที่มี role ในแอป — เพิ่มคนได้ที่ App Roles → Testers (ชวนร้านค้ากลุ่มแรกเป็น tester ให้ใช้จริงไปพลาง เก็บ feedback ก่อนเปิดสาธารณะได้เลย) · LINE ไม่เกี่ยวกับรีวิวนี้ ใช้เต็มรูปแบบได้ตลอด
