import { chromium } from "@playwright/test";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const B = "http://localhost:3212";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(B + "/login");
await p.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL);
await p.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD);
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL(/\/dashboard/, { timeout: 30000 });
await p.goto(B + "/dashboard"); await p.waitForTimeout(1500);
await p.screenshot({ path: "audit-shots/after-d-dash.png" });
await p.goto(B + "/dashboard/admin"); await p.waitForTimeout(1500);
await p.screenshot({ path: "audit-shots/after-d-admin.png" });
// มือถือ: แผ่นเพิ่มเติม + แดชบอร์ด
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(B + "/dashboard"); await p.waitForTimeout(1200);
await p.screenshot({ path: "audit-shots/after-m-dash.png" });
await p.getByRole("button", { name: /เพิ่มเติม/ }).click(); await p.waitForTimeout(400);
await p.screenshot({ path: "audit-shots/after-m-more.png" });
// landing: sticky ต้องยังไม่โผล่ก่อนเลื่อน
const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
await p2.goto(B + "/"); await p2.waitForTimeout(1200);
const before = await p2.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find(d => d.className.includes("fixed inset-x-0 bottom-0"));
  return el ? el.getBoundingClientRect().top < innerHeight : null;
});
await p2.evaluate(() => window.scrollTo({ top: innerHeight * 1.2, behavior: "instant" }));
await p2.waitForTimeout(500);
const after = await p2.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find(d => d.className.includes("fixed inset-x-0 bottom-0"));
  return el ? el.getBoundingClientRect().top < innerHeight : null;
});
console.log("sticky ก่อนเลื่อน(ต้องซ่อน):", before, "· หลังเลื่อน(ต้องโชว์):", after);
await b.close();
