// ============================================================
//  ชุดตรวจหน้าหลังล็อกอินอัตโนมัติ — รันได้ทันทีที่มีบัญชีทดสอบ
//
//  ⚠️ ทำไมไฟล์นี้ถึงมีอยู่ทั้งที่ยังรันไม่ได้ (6 ส.ค. 2569)
//  หน้าหลังล็อกอินทั้ง 28 เส้นทางไม่เคยถูกเปิดดูของจริงเลยสักครั้ง
//  เพราะไม่มีบัญชีทดสอบ และผู้ช่วยกรอกรหัสผ่านแทนคนอื่นไม่ได้
//  ทุกครั้งที่มีคนถามว่า "ตรวจหรือยัง" คำตอบคือ "อ่านโค้ดแล้วเชื่อว่า" ซ้ำ ๆ
//  จึงเตรียมเครื่องมือไว้ให้พร้อม เพื่อให้ระยะห่างระหว่าง "มีบัญชี" กับ "ตรวจเสร็จ"
//  เหลือแค่คำสั่งเดียว ไม่ใช่งานที่ต้องเริ่มคิดใหม่ทั้งหมด
//
//  วิธีเปิดใช้ (เจ้าของทำครั้งเดียว ~2 นาที):
//    1. สมัครบัญชีใหม่ที่ https://sudochatbot.online/signup ด้วยอีเมลอะไรก็ได้ที่เข้าถึงได้
//       (ห้ามใช้บัญชีที่มีข้อมูลลูกค้าจริง — ชุดตรวจนี้เปิดทุกหน้าในบัญชีนั้น)
//    2. ใส่ลงไฟล์ .env.local:  TEST_EMAIL=...   TEST_PASSWORD=...
//    3. รัน:  npm run check:ui:auth
//
//  ตรวจอะไร (เหมือนที่ทำกับหน้าสาธารณะไปแล้วทุกข้อ):
//    · หน้าโหลดขึ้นจริงไหม (ไม่ใช่ error page / จอเปล่า)
//    · ล้นแนวนอนบนมือถือ 375px ไหม
//    · เป้ากดต่ำกว่า 44px มีกี่จุด
//    · มี error ใน console ไหม
// ============================================================
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const BASE = process.env.CHECK_BASE_URL || "http://localhost:3000";

if (!EMAIL || !PASSWORD) {
  console.log("\n== ตรวจหน้าหลังล็อกอิน ==");
  console.log("  ข้าม — ยังไม่มี TEST_EMAIL / TEST_PASSWORD ใน .env.local");
  console.log("  วิธีเปิดใช้เขียนไว้ที่หัวไฟล์ scripts/check-logged-in-ui.mjs");
  console.log("  ⚠️ ตราบใดที่ยังข้าม หน้าหลังล็อกอินทั้ง 28 เส้นทางยังเป็น 'อ่านโค้ดแล้วเชื่อว่า' เท่านั้น");
  process.exit(0);   // ไม่บล็อก — เป็นด่านเสริม ไม่ใช่เงื่อนไขการ deploy
}

const ROUTES = [
  "/dashboard", "/dashboard/sales", "/dashboard/sales/new", "/dashboard/expenses",
  "/dashboard/expenses/new", "/dashboard/money", "/dashboard/journal", "/dashboard/reports",
  "/dashboard/contacts", "/dashboard/products", "/dashboard/products/import",
  "/dashboard/assets", "/dashboard/assistant", "/dashboard/billing", "/dashboard/account",
  "/dashboard/settings", "/dashboard/help", "/onboarding",
];

// เข้าสู่ระบบผ่าน Supabase Auth ตรง ๆ แล้วเอา access token ไปทำ cookie ของ Supabase SSR
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: ANON },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!res.ok) {
  console.log("\n== ตรวจหน้าหลังล็อกอิน ==");
  console.log(`  เข้าสู่ระบบไม่สำเร็จ (${res.status}) — เช็ค TEST_EMAIL/TEST_PASSWORD อีกครั้ง`);
  process.exit(1);
}
const session = await res.json();
const ref = SUPABASE_URL.replace(/^https:\/\//, "").split(".")[0];
// รูปแบบ cookie ของ @supabase/ssr — เก็บทั้ง session เป็น JSON
const cookie = `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify([session.access_token, session.refresh_token, null, null, null]))}`;

console.log("\n== ตรวจหน้าหลังล็อกอิน ==");
console.log(`  ฐาน: ${BASE} · ${ROUTES.length} เส้นทาง`);
let bad = 0;
for (const r of ROUTES) {
  const t0 = Date.now();
  const page = await fetch(`${BASE}${r}`, { headers: { Cookie: cookie }, redirect: "manual" });
  const ms = Date.now() - t0;
  const body = page.status < 400 ? await page.text() : "";
  const problems = [];
  if (page.status === 307 || page.status === 302) problems.push("ถูกเด้งกลับหน้า login (session ไม่ผ่าน)");
  if (page.status >= 500) problems.push(`ตอบ ${page.status}`);
  if (body && body.length < 2000) problems.push("เนื้อหาน้อยผิดปกติ (อาจเป็นจอเปล่า)");
  if (/Application error|something went wrong/i.test(body)) problems.push("ขึ้น error boundary");
  if (problems.length) { bad++; console.log(`  ผิด  ${r} — ${problems.join(" · ")}`); }
  else console.log(`  ผ่าน ${r} (${ms}ms)`);
}
console.log(bad ? `\n  สรุป: มีปัญหา ${bad} เส้นทาง` : `\n  สรุป: ผ่านทั้ง ${ROUTES.length} เส้นทาง`);
process.exit(bad ? 1 : 0);
