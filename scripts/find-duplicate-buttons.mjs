// ============================================================
//  หาปุ่มซ้ำบนจอมือถือ
//
//  ทำไมต้องมีเครื่องมือ ไม่ใช่ไล่ดูเอง: เจ้าของรายงานว่า "ปุ่มซ้ำกันเยอะเวลามองในมือถือ"
//  ซึ่งเกิดจากการที่แต่ละหน้าเพิ่มปุ่มของตัวเอง โดยไม่เห็นว่า shell (แถบล่าง · ปุ่มลอย
//  · เมนู) มีปุ่มชื่อเดียวกันอยู่แล้ว — มองทีละหน้าจึงไม่มีวันเห็น ต้องนับรวมทั้งจอ
//
//  วิธีนับ: เปิดจอขนาดมือถือ เก็บ "ชื่อที่ผู้ใช้อ่านได้" ของทุกปุ่ม/ลิงก์ที่มองเห็นจริง
//  แล้วรายงานชื่อที่โผล่เกินหนึ่งครั้งในหน้าเดียวกัน
//
//  รัน: node scripts/find-duplicate-buttons.mjs [baseUrl]
//  ต้องมี TEST_EMAIL/TEST_PASSWORD ถึงจะตรวจหน้าหลังล็อกอินได้
// ============================================================
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const PROXY = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "";
const CHROME = process.env.E2E_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const PUBLIC_PAGES = ["/", "/try", "/pricing", "/login", "/signup"];
const PRIVATE_PAGES = [
  "/dashboard", "/dashboard/sales", "/dashboard/expenses", "/dashboard/money",
  "/dashboard/journal", "/dashboard/reports", "/dashboard/contacts",
  "/dashboard/products", "/dashboard/assets", "/dashboard/billing",
  "/dashboard/settings", "/dashboard/assistant",
];

/** ชื่อที่ผู้ใช้อ่านได้จริงของปุ่ม/ลิงก์ที่ "มองเห็นอยู่" ในจอตอนนี้ */
async function visibleActionNames(page) {
  return page.evaluate(() => {
    const seen = [];
    const nodes = document.querySelectorAll('a[href], button, [role="button"]');
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;            // ซ่อนอยู่
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) continue;
      // ชื่อที่ผู้ใช้เห็น — ถ้าเป็นปุ่มไอคอนล้วนให้ใช้ aria-label
      const label = (el.getAttribute("aria-label") || el.textContent || "")
        .replace(/\s+/g, " ").trim();
      if (!label || label.length > 40) continue;             // ยาวเกิน = ข้อความ ไม่ใช่ปุ่ม
      seen.push(label);
    }
    return seen;
  });
}

/**
 * ซ้ำแบบที่ "เห็นพร้อมกันในจอเดียว" เท่านั้นที่นับว่าเป็นปัญหา
 *
 * ปุ่มชื่อเดียวกันที่อยู่หัวหน้ากับท้ายหน้า = วิธีมาตรฐานของหน้าขาย ไม่ใช่ความรก
 * แต่ปุ่มชื่อเดียวกันสองอันที่เห็นพร้อมกันในจอเดียว = ผู้ใช้ต้องหยุดคิดว่าต่างกันยังไง
 */
async function visibleInViewportNames(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // ต้องอยู่ในกรอบจอตอนนี้จริง ๆ
      if (r.bottom <= 0 || r.top >= innerHeight) continue;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!label || label.length > 40) continue;
      out.push(label);
    }
    return out;
  });
}

async function scan(page, path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" }).catch(() => null);
  await page.waitForTimeout(600);

  const height = await page.evaluate(() => document.body.scrollHeight);
  const step = 700;
  const worst = new Map();   // ชื่อ -> จำนวนสูงสุดที่เคยเห็นพร้อมกันในจอเดียว

  for (let y = 0; y < height; y += step) {
    await page.evaluate((v) => scrollTo(0, v), y);
    await page.waitForTimeout(150);
    const names = await visibleInViewportNames(page);
    const c = new Map();
    for (const n of names) c.set(n, (c.get(n) ?? 0) + 1);
    for (const [n, k] of c) if (k > (worst.get(n) ?? 0)) worst.set(n, k);
  }
  await page.evaluate(() => scrollTo(0, 0));

  const total = (await visibleActionNames(page)).length;
  const dups = [...worst.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
  return { path, total, dups };
}

const b = await chromium.launch({
  executablePath: CHROME,
  args: PROXY
    ? [`--proxy-server=${PROXY}`, "--proxy-bypass-list=127.0.0.1;localhost", "--ignore-certificate-errors", "--no-sandbox"]
    : ["--no-sandbox"],
});
// ขนาดมือถือที่คนไทยใช้เยอะที่สุด
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "th-TH" });
const page = await ctx.newPage();

const pages = [...PUBLIC_PAGES];
if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
  await page.goto(BASE + "/login");
  await page.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD);
  await page.getByRole("button", { name: /เข้าสู่ระบบ|ลงชื่อ/ }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => null);
  pages.push(...PRIVATE_PAGES);
} else {
  console.log("⚠️  ไม่มี TEST_EMAIL/TEST_PASSWORD — ตรวจได้เฉพาะหน้าสาธารณะ");
  console.log("    หน้าหลังล็อกอินคือจุดที่ปุ่มซ้ำกันมากที่สุด (มีทั้งแถบล่าง ปุ่มลอย และปุ่มในหน้า)\n");
}

console.log(`\n== ปุ่มซ้ำบนจอมือถือ 390px (${BASE}) ==\n`);
let totalDup = 0;
for (const p of pages) {
  const r = await scan(page, p);
  if (r.dups.length === 0) {
    console.log(`  ถูก  ${r.path}  (ปุ่มที่มองเห็น ${r.total})`);
  } else {
    totalDup += r.dups.length;
    console.log(`  ซ้ำ  ${r.path}  (ปุ่มที่มองเห็น ${r.total})`);
    for (const [name, c] of r.dups) console.log(`         ${c}× "${name}"`);
  }
}
console.log(`\nสรุป: พบชื่อปุ่มที่ซ้ำ ${totalDup} รายการ\n`);
await b.close();
process.exit(0);
