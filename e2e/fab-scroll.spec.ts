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

// ⚠️ ย้ายจากหน้า /dashboard มาหน้าเอกสารขาย (5 ก.ย. 2569)
// หน้าภาพรวมไม่มีปุ่มลอยแล้ว — มีปุ่ม "ออกบิล/ใบเสร็จ" กับ "ถ่ายรูปบิล" อยู่ในจอแรกแทน
// (ปุ่มลอยที่นั่นทับตัวเลข "ลูกหนี้ค้างรับ" จนอ่านไม่ครบ · ดู quick-create.tsx)
// พฤติกรรม "หลบตอนเลื่อน" ยังต้องถูกตรวจ จึงย้ายมาตรวจบนหน้าที่ยังมีปุ่มลอยจริง
test("ปุ่ม + ลอย หลบตอนเลื่อนลง และกลับมาตอนเลื่อนขึ้น", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/sales");

  const fab = page.getByRole("button", { name: "สร้างเอกสารใหม่" });
  await expect(fab).toBeVisible();

  // ต้องมีอะไรให้เลื่อนจริง ไม่งั้นเทสต์นี้ผ่านแบบไม่ได้ตรวจอะไรเลย
  // กิจการทดสอบมีเอกสารไม่กี่ใบ จึงโคลนแถวให้ยาวพอก่อน
  const scrollable = await page.evaluate(() => {
    // ทำให้หน้ายาวพอจะเลื่อนโดยไม่ต้องพึ่งโครงสร้างรายการ (มือถือ/เดสก์ท็อปคนละโครง)
    // สิ่งที่เทสต์นี้ตรวจคือ "ปุ่มหลบเมื่อเลื่อน" ซึ่งขึ้นกับระยะเลื่อนล้วน ๆ
    const pad = document.createElement("div");
    pad.style.height = "2000px";
    document.querySelector("main")?.appendChild(pad);
    return document.documentElement.scrollHeight - window.innerHeight;
  });
  expect(scrollable, "หน้าต้องยาวพอจะเลื่อน ไม่งั้นเทสต์นี้วัดอะไรไม่ได้").toBeGreaterThan(300);

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

// ============================================================
//  หน้าภาพรวมบนมือถือ: งานหลักต้องอยู่จอแรก และตัวเลขเงินต้องไม่ถูกอะไรทับ
//
//  ⚠️ ทำไมต้องมี (5 ก.ย. 2569 — เจ้าของบอกว่า "ใช้งานยากมาก ปุ่มก็งง มองก็ยาก รก")
//  วัดจริงตอนนั้น: จอแรกทั้งจอไม่มีงานให้ทำเลย มีแต่ช่องแชทกับตัวอย่างคำสั่ง 3 อัน
//  ส่วนปุ่มสร้างเอกสารซ่อนอยู่หลังปุ่ม + ลอย ซึ่งลอยไปทับตัวเลข "ลูกหนี้ค้างรับ 10,700"
//  จนอ่านไม่ครบ · เทสต์นี้กันไม่ให้ทั้งสองอย่างกลับมา
// ============================================================
test("หน้าภาพรวมมือถือ: มีปุ่มงานจริงในจอแรก และไม่มีอะไรทับตัวเลขเงิน", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.waitForTimeout(1200);

  const bill = page.getByRole("link", { name: /ออกบิล\/ใบเสร็จ/ });
  await expect(bill, "ต้องมีปุ่มออกบิลบนหน้าภาพรวม").toBeVisible();
  const box = (await bill.boundingBox())!;
  expect(box.y, `ปุ่มออกบิลต้องอยู่ในจอแรก แต่อยู่ที่ ${Math.round(box.y)}px`).toBeLessThan(844);

  // ปุ่ม + ลอยต้องไม่มีบนหน้านี้ (ซ้ำกับปุ่มด้านบน และเคยทับตัวเลข)
  await expect(page.getByRole("button", { name: "สร้างเอกสารใหม่" })).toHaveCount(0);

  // ตัวเลขเงินทุกตัวในจอแรกต้องกดโดนตัวเอง = ไม่มีอะไรลอยทับ
  const covered = await page.evaluate(() => {
    const vis = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return [...document.querySelectorAll("p")]
      .filter((el) => /[0-9],?[0-9]*\.[0-9]{2}/.test((el as HTMLElement).innerText) && vis(el))
      // ⚠️ แถบเมนูล่างเป็น fixed สูงราว 64px — ของที่อยู่ใต้มันไม่ใช่ "ถูกทับ"
      // แค่ยังไม่ได้เลื่อนถึง (วัดจริง 5 ก.ย. 2569: การ์ดใบที่ 5 ตกอยู่ใต้แถบนั้นพอดี)
      // ที่ต้องกันคือของที่ลอยทับกลางจอ เช่นปุ่ม + ลอย
      .filter((el) => { const r = el.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 70 || r.bottom < 0) return false;
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!hit && !el.contains(hit) && hit !== el; })
      .map((el) => (el as HTMLElement).innerText.slice(0, 30));
  });
  expect(covered, `มีตัวเลขเงินถูกอะไรทับ: ${covered.join(" / ")}`).toEqual([]);
});

// ============================================================
//  วันที่ในฟอร์มต้องอ่านเป็นภาษาไทย ไม่ใช่ 09/05/2026
//
//  ⚠️ Chrome แสดง input[type=date] เป็น mm/dd/yyyy แม้ตั้ง locale th-TH (วัดจริง 5 ก.ย. 2569)
//  ช่องนี้คือ "วันที่เอกสาร" ของใบกำกับภาษี — อ่านผิดเดือน = ยื่นภาษีผิดงวด
//  ถ้าวันหลังมีคนถอด overlay ออกเพราะคิดว่าไม่จำเป็น เทสต์นี้คือสิ่งที่ฟ้อง
// ============================================================
test("ช่องวันที่ในฟอร์มออกเอกสารอ่านเป็นไทย และยังกดเปิดปฏิทินได้", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/sales/new?type=invoice");
  await page.waitForTimeout(1000);

  const r = await page.evaluate(() => {
    const inp = document.querySelector('input[type="date"]') as HTMLInputElement;
    const b = inp.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + 40, b.y + b.height / 2);
    const thai = [...document.querySelectorAll("span")]
      .map((s) => (s as HTMLElement).innerText || "")
      .find((t) => /^\d+ (มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม) 25\d{2}$/.test(t.trim()));
    return { thai: thai?.trim() ?? "", hitIsDateInput: (hit as HTMLInputElement)?.type === "date" };
  });
  expect(r.thai, "ต้องเห็นวันที่เป็นภาษาไทย พ.ศ. ในช่อง").not.toBe("");
  expect(r.hitIsDateInput, "กดกลางช่องต้องยังโดน input วันที่ (overlay ห้ามบัง)").toBe(true);
});
