// ============================================================
//  ปุ่ม + ลอย ต้องหลบให้ตอนกำลังเลื่อนอ่าน
//
//  ⚠️ ทำไมต้องมีเทสต์นี้ (29 ส.ค. 2569)
//  เจ้าของแคปหน้าจอมาหลายหน้า: ปุ่มลอยทับป้าย "ชำระแล้ว" ในรายการเอกสาร
//  และทับตัวเลข "ค้างรับ / ค้างจ่าย" ในการ์ดสรุปหน้ารายงาน
//  padding ล่างของ MainArea แก้ได้แค่บรรทัดสุดท้ายของหน้า ไม่ได้แก้ตอนเลื่อนกลางหน้า
//
//  ⚠️ ตรวจด้วย Browser pane ไม่ได้ — pane ที่ถูกซ่อนอยู่ throttle rAF และไม่ยอมเลื่อนจอ
//  วัดแล้วได้ scrollY = 0 ตลอดทั้งที่เนื้อหาสูง 2691px (false positive ของเครื่องมือ ไม่ใช่บั๊ก)
//  เทสต์นี้จึงต้องรันบนเบราว์เซอร์จริงของ Playwright เท่านั้น
// ============================================================
import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

test.skip(!EMAIL || !PASSWORD,
  "ข้ามทั้งชุด — ยังไม่ได้ตั้ง TEST_EMAIL/TEST_PASSWORD ⚠️ แปลว่าพฤติกรรมปุ่มลอยยังไม่ถูกตรวจเลย");

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').first().fill(EMAIL!);
  await page.locator('input[type="password"]').first().fill(PASSWORD!);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("ปุ่ม + ลอย หลบตอนเลื่อนลง และกลับมาตอนเลื่อนขึ้น", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const fab = page.getByRole("button", { name: "สร้างเอกสารใหม่" });
  await expect(fab).toBeVisible();

  // ต้องมีอะไรให้เลื่อนจริง ไม่งั้นเทสต์นี้ผ่านแบบไม่ได้ตรวจอะไรเลย
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(scrollable, "หน้าภาพรวมต้องยาวพอจะเลื่อน ไม่งั้นเทสต์นี้วัดอะไรไม่ได้").toBeGreaterThan(300);

  const fabBottom = async () => (await fab.boundingBox())!.y + (await fab.boundingBox())!.height;
  const restingBottom = await fabBottom();

  // เลื่อนลง = กำลังอ่าน ปุ่มต้องหลบพ้นขอบจอ
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY), "ต้องเลื่อนได้จริง").toBeGreaterThan(300);
  expect(await fabBottom(), "เลื่อนลงแล้วปุ่มต้องหลบต่ำกว่าตำแหน่งปกติ").toBeGreaterThan(restingBottom + 40);

  // เลื่อนขึ้น = กำลังหาที่จะกด ปุ่มต้องกลับมา
  await page.evaluate(() => window.scrollTo({ top: 350, behavior: "instant" }));
  await page.waitForTimeout(500);
  expect(await fabBottom(), "เลื่อนขึ้นแล้วปุ่มต้องกลับมาที่เดิม").toBeLessThan(restingBottom + 10);
});

test("เปิดเมนูปุ่ม + แล้วทุกใบกว้างเท่ากัน ไม่เป็นขั้นบันได", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/sales");

  await page.getByRole("button", { name: "สร้างเอกสารใหม่" }).click();
  await page.waitForTimeout(300);

  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/new"]')]
      .map((a) => a.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({ left: Math.round(r.left), width: Math.round(r.width) })));

  expect(boxes.length, "เมนูต้องมีอย่างน้อย 4 ใบ").toBeGreaterThanOrEqual(4);
  const lefts = new Set(boxes.map((b) => b.left));
  expect(lefts.size, `ขอบซ้ายต้องตรงกันทุกใบ แต่ได้ ${[...lefts].join(",")}`).toBe(1);
});

// ============================================================
//  หัวตารางต้องหนึบบนเดสก์ท็อป
//
//  ⚠️ ของที่พังง่ายและพังเงียบ (29 ส.ค. 2569)
//  sticky จะทำงานก็ต่อเมื่อ "ไม่มีบรรพบุรุษตัวไหนเป็น scroll container"
//  กล่องหุ้มตารางเดิมเป็น overflow-x:auto ซึ่งตามสเปกบังคับให้ overflow-y เป็น auto ตาม
//  = กลายเป็น scroll container แล้ว sticky ตายเงียบ ๆ โดยไม่มี error อะไรเลย
//  ถ้าวันหลังมีคนเห็น overflow-x-clip แล้วคิดว่า "auto น่าจะถูกกว่า" แล้วแก้กลับ
//  หัวตารางจะเลิกหนึบทันทีโดยไม่มีอะไรฟ้อง — เทสต์นี้คือสิ่งที่ฟ้อง
//
//  ต้องโคลนแถวให้ตารางยาวก่อน เพราะกิจการทดสอบมีเอกสารไม่กี่ใบ
//  ถ้าไม่โคลน หน้าจะไม่ยาวพอให้เลื่อน แล้วเทสต์จะ "ผ่าน" แบบไม่ได้ตรวจอะไรเลย
// ============================================================
test("หัวตารางหนึบตอนเลื่อนอ่านรายการยาว (เดสก์ท็อป)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "เดสก์ท็อป", "พฤติกรรมนี้มีเฉพาะจอ lg ขึ้นไป");
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard/sales");
  await page.waitForTimeout(800);

  const th = page.locator(".rtable th").first();
  await expect(th).toHaveCSS("position", "sticky");

  const scrollable = await page.evaluate(() => {
    const tb = document.querySelector(".rtable tbody");
    const row = tb?.querySelector("tr");
    if (!tb || !row) return 0;
    for (let i = 0; i < 60; i++) tb.appendChild(row.cloneNode(true));
    return document.documentElement.scrollHeight - window.innerHeight;
  });
  expect(scrollable, "ต้องยาวพอจะเลื่อน ไม่งั้นเทสต์นี้วัดอะไรไม่ได้").toBeGreaterThan(500);

  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => Math.round(window.scrollY)), "ต้องเลื่อนได้จริง").toBeGreaterThan(500);

  const top = (await th.boundingBox())!.y;
  expect(top, `เลื่อนแล้วหัวตารางหลุดจอไปที่ ${top}px — sticky ไม่ทำงาน`).toBeLessThan(120);
  expect(top).toBeGreaterThanOrEqual(-1);
});
