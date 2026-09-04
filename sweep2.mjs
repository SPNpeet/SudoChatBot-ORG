import { chromium } from "@playwright/test";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const B = "https://sudochatbot.online";
const b = await chromium.launch();
const check = async (p, name) => {
  const r = await p.evaluate(() => {
    const t = document.body.innerText;
    const bad = [];
    const en = t.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g);
    if (en) bad.push("เดือนอังกฤษ:" + [...new Set(en)].join(","));
    if (/\b\d{2}\/\d{2}\/20\d{2}\b/.test(t)) bad.push("วันที่ mm/dd/yyyy");
    if (/undefined|NaN|\[object/.test(t)) bad.push("ค่าเพี้ยน");
    if (/mm\/dd\/yyyy/i.test(t)) bad.push("placeholder ดิบ");
    // ปุ่ม/ลิงก์ที่ไม่มีชื่อให้อ่าน (โปรแกรมอ่านหน้าจอ + คนตาดีก็งง)
    const nameless = [...document.querySelectorAll("a[href],button")].filter((el) => {
      const r2 = el.getBoundingClientRect(); if (r2.width === 0) return false;
      return !(el.innerText||"").trim() && !el.getAttribute("aria-label") && !el.getAttribute("title");
    }).length;
    if (nameless) bad.push(`ปุ่มไม่มีชื่อ ${nameless}`);
    // เป้ากดเล็กกว่า 44px ในหน้าลูกค้า
    const small = [...document.querySelectorAll("a[href],button")].filter((el) => {
      const r2 = el.getBoundingClientRect();
      return r2.width > 0 && r2.height > 0 && r2.height < 32;
    }).length;
    if (small > 2) bad.push(`เป้ากดเล็ก ${small}`);
    return { bad, overflow: document.documentElement.scrollWidth > innerWidth + 1, h: document.documentElement.scrollHeight };
  });
  if (r.overflow) r.bad.push("ล้นแนวนอน");
  console.log(`${name.padEnd(20)} สูง ${String(r.h).padStart(5)}px${r.bad.length ? "  <<< " + r.bad.join(" · ") : ""}`);
  return r.bad.length > 0;
};

console.log("=== หน้าสาธารณะ (มือถือ) ===");
let p = await b.newPage({ viewport: { width: 390, height: 844 } });
for (const [n, path] of [["หน้าแรก","/"],["ลองใช้","/try"],["ราคา","/pricing"],["สมัคร","/signup"],["เข้าระบบ","/login"],["ลืมรหัส","/forgot-password"],["เกี่ยวกับ","/about"],["ติดต่อ","/contact"],["เงื่อนไข","/terms"],["ความเป็นส่วนตัว","/privacy"],["คืนเงิน","/refund"]]) {
  await p.goto(B + path); await p.waitForTimeout(1200); await check(p, n);
}
await p.close();

console.log("\n=== หลังล็อกอิน (เดสก์ท็อป 1440) ===");
p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(B + "/login");
await p.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL);
await p.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD);
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL(/\/dashboard/, { timeout: 30000 });
for (const [n, path] of [["ภาพรวม","/dashboard"],["ผู้ช่วย","/dashboard/assistant"],["ขาย","/dashboard/sales"],["ออกบิล","/dashboard/sales/new?type=invoice"],["ค่าใช้จ่าย","/dashboard/expenses"],["การเงิน","/dashboard/money"],["สมุดรายวัน","/dashboard/journal"],["รายงาน","/dashboard/reports"],["ทรัพย์สิน","/dashboard/assets"],["คู่มือ","/dashboard/help"],["ตั้งค่า","/dashboard/settings"],["งานอัตโนมัติ","/dashboard/assistant/workflows"]]) {
  await p.goto(B + path); await p.waitForTimeout(1300); await check(p, n);
}
await b.close();
