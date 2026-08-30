// เก็บภาพจริงทุกหน้าสำคัญ ทั้งก่อนและหลังล็อกอิน สองขนาดจอ — วัตถุดิบของการวิจารณ์
import { chromium } from "@playwright/test";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const B = "https://sudochatbot.online";
const b = await chromium.launch();

// --- ไม่ล็อกอิน: สิ่งแรกที่คนแปลกหน้าเห็น ---
for (const [w, h, tag] of [[390, 844, "m"], [1440, 900, "d"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  for (const [name, path] of [["landing", "/"], ["signup", "/signup"], ["login", "/login"], ["try", "/try"]]) {
    await p.goto(B + path); await p.waitForTimeout(1200);
    await p.screenshot({ path: `audit-shots/${tag}-${name}.png` });
  }
  await p.close();
}

// --- ล็อกอิน: งานประจำวัน ---
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(B + "/login");
await p.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL);
await p.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD);
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL(/\/dashboard/, { timeout: 30000 });
for (const [name, path] of [
  ["dash", "/dashboard"], ["assistant", "/dashboard/assistant"], ["sales-new", "/dashboard/sales/new"],
  ["expenses-new", "/dashboard/expenses/new"], ["settings", "/dashboard/settings"],
  ["billing", "/dashboard/billing"], ["help", "/dashboard/help"], ["contacts", "/dashboard/contacts"],
]) {
  await p.goto(B + path); await p.waitForTimeout(1300);
  await p.screenshot({ path: `audit-shots/m-in-${name}.png` });
}
// เมนู "เพิ่มเติม" บนมือถือ — ถังรวมที่มอคอัพเคยวิจารณ์
const more = p.getByRole("button", { name: /เพิ่มเติม/ });
if (await more.count()) { await p.goto(B + "/dashboard"); await p.waitForTimeout(800); await more.first().click(); await p.waitForTimeout(400); await p.screenshot({ path: "audit-shots/m-in-more.png" }); }
await p.setViewportSize({ width: 1440, height: 900 });
for (const [name, path] of [["dash", "/dashboard"], ["settings", "/dashboard/settings"], ["sales-new", "/dashboard/sales/new"]]) {
  await p.goto(B + path); await p.waitForTimeout(1300);
  await p.screenshot({ path: `audit-shots/d-in-${name}.png` });
}
await b.close();
console.log("done", fs.readdirSync("audit-shots").length, "shots");
