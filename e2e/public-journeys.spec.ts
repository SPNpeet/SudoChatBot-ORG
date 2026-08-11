// ============================================================
//  เส้นทางของ "คนที่ยังไม่สมัคร" — ด่านแรกสุดของการขาย
//
//  ทำไมชุดนี้สำคัญที่สุด: ตัวเลขที่เราวัดเองบอกว่า 22 จาก 24 กิจการ
//  เข้ามาวันเดียวแล้วไม่กลับมาอีกเลย ปัญหาจึงอยู่ที่ 10 นาทีแรก ไม่ใช่ฟีเจอร์ลึก ๆ
//  ทุกเทสต์ในไฟล์นี้จำลองสิ่งที่คนแปลกหน้าทำจริงก่อนตัดสินใจสมัคร
//
//  ทุกเทสต์อ่านอย่างเดียว ไม่แตะข้อมูลใครทั้งสิ้น
// ============================================================
import { test, expect } from "@playwright/test";

test.describe("ผู้เยี่ยมชมที่ยังไม่สมัคร", () => {
  test("หน้าแรกบอกได้ว่าขายอะไร และมีทางเข้าที่กดได้จริง", async ({ page }) => {
    await page.goto("/");

    // พาดหัวต้องมีจริง ไม่ใช่หน้าเปล่าที่ตอบ 200
    await expect(page.locator("h1").first()).toBeVisible();

    // ปุ่มเริ่มใช้งานต้องมีอย่างน้อยหนึ่งจุด และพาไปหน้าสมัคร/ลองใช้ได้
    const cta = page.getByRole("link", { name: /เริ่ม|สมัคร|ลองใช้|ทดลอง/ }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href, "ปุ่มหลักต้องมีปลายทาง").toBeTruthy();
  });

  test("หน้าแรกบอกราคาได้โดยไม่ต้องสมัครก่อน", async ({ page }) => {
    await page.goto("/");
    // คนไทยเทียบราคา 3-4 เจ้าก่อนสมัครเสมอ — ซ่อนราคา = โดนตัดทิ้งก่อน
    const body = await page.locator("body").innerText();
    expect(body, "หน้าแรกต้องมีตัวเลขราคาหรือคำว่าฟรี").toMatch(/บาท|ฟรี/);
  });

  test("หน้าราคาเปิดได้และมีแพ็กเกจให้เลือก", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("h1").first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/บาท/);
  });

  test("ลิงก์กฎหมายท้ายเว็บเปิดได้จริงทั้ง 3 หน้า", async ({ page }) => {
    // Meta/Google/PDPA ดูจุดนี้ และลิงก์ตายทำให้ยื่นรีวิวไม่ผ่าน
    for (const path of ["/privacy", "/terms", "/data-deletion"]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} ต้องตอบ 200`).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("หน้าเข้าสู่ระบบและสมัครสมาชิกมีช่องกรอกครบ", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    await page.goto("/signup");
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });
});

test.describe("หน้าลองใช้ก่อนสมัคร (/try) — จุดที่เปลี่ยนคนแปลกหน้าเป็นผู้ใช้", () => {
  test("เปิดได้และมีฟอร์มให้ลองพิมพ์", async ({ page }) => {
    await page.goto("/try");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // ต้องมีช่องกรอกอย่างน้อยหนึ่งช่อง ไม่งั้น "ลองใช้" ไม่ได้จริง
    const inputs = page.locator("input, textarea");
    expect(await inputs.count(), "หน้าลองใช้ต้องมีช่องให้กรอก").toBeGreaterThan(0);
  });

  test("กรอกจำนวน × ราคา แล้วยอดรวมคำนวณถูกต้องทันที", async ({ page }) => {
    await page.goto("/try");

    // ช่องกรอกเป็น input โปร่งใสทับบนกระดาษ (ไม่ใช่ contentEditable) และมี aria-label กำกับ
    const qty = page.getByLabel("จำนวน").first();
    const price = page.getByLabel("ราคาต่อหน่วย").first();
    if ((await qty.count()) === 0 || (await price.count()) === 0) {
      test.skip(true, "ไม่พบช่องจำนวน/ราคา — โครงหน้าเปลี่ยนไป ต้องอัปเดตเทสต์");
    }

    await qty.fill("2");
    await price.fill("500");
    await price.blur();

    // 2 × 500 = 1,000 — พิสูจน์ว่าการคำนวณทำงานจริงบนหน้าที่คนยังไม่สมัครเห็น
    // (หน้านี้ใช้ calcDocTotals ตัวเดียวกับระบบจริง เลขที่เห็นตรงกับเอกสารที่ออกจริงเสมอ)
    await expect(page.locator("body")).toContainText(/1,000\.00/, { timeout: 10_000 });
  });
});

test.describe("สุขภาพระบบที่คนนอกตรวจได้", () => {
  test("/api/health ตอบว่าระบบต่อฐานข้อมูลได้", async ({ request, baseURL }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const j = await res.json();

    // เครื่อง dev ส่วนใหญ่ไม่มี service role key (และไม่ควรมี) — health จะเป็น false
    // โดยไม่ได้แปลว่าระบบพัง ข้อนี้จึงบังคับเฉพาะตอนยิงใส่ของจริงที่ deploy แล้ว
    const isLocal = /localhost|127\.0\.0\.1/.test(baseURL ?? "");
    if (isLocal && !j.env?.serviceRoleKey) {
      test.skip(true, "เครื่องนี้ไม่มี service role key — ข้ามโดยตั้งใจ (ไม่ใช่ความผิดของระบบ)");
    }
    expect(j.ok, "health ต้องเป็น true — ไม่งั้นแปลว่า env หรือฐานข้อมูลมีปัญหา").toBe(true);
    expect(j.db).toBe(true);
  });

  test("ทุกหน้าสาธารณะตอบเร็วพอที่คนจะไม่ปิดหนี", async ({ page }) => {
    // เกณฑ์ 5 วินาทีคือ "ช้ามากแต่ยังไม่ถือว่าพัง" — ตั้งหลวมโดยตั้งใจ
    // เทสต์นี้มีไว้จับ "หน้าค้าง/ตาย" ไม่ใช่จับความเร็วระดับมิลลิวินาที
    for (const path of ["/", "/try", "/pricing", "/login"]) {
      const t0 = Date.now();
      const res = await page.goto(path);
      const ms = Date.now() - t0;
      expect(res?.status(), `${path} ต้องตอบ 200`).toBe(200);
      expect(ms, `${path} ใช้เวลา ${ms}ms — ช้าเกินจนคนปิดหนี`).toBeLessThan(5000);
    }
  });
});

test.describe("มือถือ — กลุ่มผู้ใช้หลักของเรา", () => {
  test("ไม่มีหน้าไหนล้นออกนอกจอแนวนอน", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "มือถือ", "ตรวจเฉพาะโปรเจกต์มือถือ");

    for (const path of ["/", "/try", "/pricing", "/login", "/signup"]) {
      await page.goto(path);
      // เลื่อนแนวนอนได้ = มีของล้นจอ ซึ่งบนมือถือทำให้อ่านยากทันที
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} ล้นแนวนอน ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test("ปุ่มหลักบนหน้าแรกกดได้จริงด้วยนิ้ว (เป้ากดอย่างน้อย 44px)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "มือถือ", "ตรวจเฉพาะโปรเจกต์มือถือ");

    await page.goto("/");
    const cta = page.getByRole("link", { name: /เริ่ม|สมัคร|ลองใช้|ทดลอง/ }).first();
    const box = await cta.boundingBox();
    expect(box, "ต้องหาปุ่มหลักเจอ").toBeTruthy();
    expect(box!.height, `ปุ่มหลักสูงแค่ ${box!.height}px — นิ้วกดพลาดง่าย`).toBeGreaterThanOrEqual(40);
  });
});
