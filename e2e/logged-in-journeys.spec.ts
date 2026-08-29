// ============================================================
//  เส้นทางหลังล็อกอิน — งานจริงที่ลูกค้าที่จ่ายเงินแล้วทำทุกวัน
//
//  ⚠️ ต้องมี TEST_EMAIL / TEST_PASSWORD ถึงจะรัน ไม่มีจะข้ามทั้งชุดพร้อมบอกเหตุผล
//     (เจตนา: ไม่มีรหัสแล้ว "ผ่าน" เงียบ ๆ อันตรายกว่าไม่รัน — จะเข้าใจผิดว่าตรวจแล้ว)
//
//  ⚠️ ห้ามสร้าง/แก้/ลบเอกสารจริงบน production
//     ทุกเทสต์ในไฟล์นี้ "เปิดดู" กับ "กดปุ่มที่ไม่บันทึกอะไร" เท่านั้น
//     ปุ่มดูตัวอย่างเอกสารจึงเป็นเป้าหมายที่ดี — มันเปิดหน้าต่างอ่านอย่างเดียวโดยเจตนา
//
//  วิธีรัน:  TEST_EMAIL=... TEST_PASSWORD=... npm run e2e
// ============================================================
import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

test.skip(!EMAIL || !PASSWORD,
  "ข้ามทั้งชุด — ยังไม่ได้ตั้ง TEST_EMAIL/TEST_PASSWORD ⚠️ แปลว่าหน้าหลังล็อกอินยังไม่ถูกตรวจเลย");

/** ล็อกอินด้วยอีเมล/รหัสผ่าน แล้วรอจนเข้าแดชบอร์ดจริง */
async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').first().fill(EMAIL!);
  await page.locator('input[type="password"]').first().fill(PASSWORD!);
  // ⚠️ ต้องเจาะจงปุ่มส่งฟอร์ม ห้ามจับด้วยชื่อปุ่ม (แก้ 27 ส.ค. 2569)
  // OAuthButtons ถูกวางไว้ "เหนือ" ฟอร์มในหน้า /login และปุ่มของมันชื่อ
  // "เข้าสู่ระบบด้วย Google" ซึ่งเข้าเงื่อนไข /เข้าสู่ระบบ/ ด้วย
  // .first() จึงไปกดปุ่ม Google แล้วเบราว์เซอร์เด้งออกไป accounts.google.com
  // ผลคือชุดทดสอบนี้ไม่เคยทดสอบการล็อกอินด้วยรหัสผ่านเลยสักครั้ง
  // และล้มทั้ง 11 เคสด้วยข้อความ timeout ที่ชี้ไปผิดที่
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("เจ้าของกิจการ SME", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("หน้าภาพรวมเปิดได้ ไม่เจอจอ error", async ({ page }) => {
    await expect(page.locator("h1").first()).toBeVisible();
    // error boundary ของเราขึ้นข้อความนี้ — ถ้าเจอแปลว่าหน้าพัง
    await expect(page.locator("body")).not.toContainText("หน้านี้โหลดไม่สำเร็จ");
  });

  test("ทุกเมนูหลักกดแล้วไปถึงจริง ไม่ค้าง ไม่พัง", async ({ page }) => {
    // นี่คือเทสต์ที่ตอบคำถาม "กดหน้าไหนก็ต้องไป ไม่ใช่ค้างนาน" ได้ตรงที่สุด
    const pages = [
      "/dashboard", "/dashboard/sales", "/dashboard/expenses", "/dashboard/money",
      "/dashboard/journal", "/dashboard/reports", "/dashboard/contacts",
      "/dashboard/products", "/dashboard/assets", "/dashboard/billing",
      "/dashboard/settings", "/dashboard/help", "/dashboard/assistant",
    ];
    for (const path of pages) {
      const t0 = Date.now();
      const res = await page.goto(path);
      const ms = Date.now() - t0;
      expect(res?.status(), `${path} ต้องตอบ 200`).toBe(200);
      await expect(page.locator("h1, h2").first(), `${path} ต้องมีหัวข้อ`).toBeVisible();
      await expect(page.locator("body"), `${path} เจอจอ error`).not.toContainText("หน้านี้โหลดไม่สำเร็จ");
      expect(ms, `${path} ใช้เวลา ${ms}ms`).toBeLessThan(15_000);
    }
  });

  test("ปุ่มดูตัวอย่างเอกสารเปิด popup ได้จริง และปิดแล้วกลับมาแก้ต่อได้", async ({ page }) => {
    await page.goto("/dashboard/sales/new");

    const preview = page.getByRole("button", { name: /ดูตัวอย่าง/ });
    if ((await preview.count()) === 0) {
      test.skip(true, "ไม่พบปุ่มดูตัวอย่าง — อาจยังไม่ได้ตั้งข้อมูลกิจการ (seller) ในกิจการทดสอบ");
    }

    await preview.first().click();
    const dialog = page.getByRole("dialog", { name: /ตัวอย่างเอกสาร/ });
    await expect(dialog).toBeVisible();
    // ⚠️ ห้ามผูกกับพาดหัวของป๊อปอัป (แก้ 27 ส.ค. 2569)
    // เดิมตรวจคำว่า "ตัวอย่างก่อนออกเอกสาร" ซึ่งถูกเปลี่ยนข้อความไปแล้วตอนเพิ่มฟีเจอร์
    // แก้สดบนใบ เทสต์เลยล้มทั้งที่ป๊อปอัปทำงานถูกต้องทุกอย่าง
    // สิ่งที่ควรตรวจคือ "คำสัญญา" ของหน้านี้ คือดูตัวอย่างแล้วต้องยังไม่บันทึกอะไร
    // ซึ่งเป็นพฤติกรรมที่ห้ามเปลี่ยน ไม่ใช่ถ้อยคำที่เปลี่ยนได้ตลอด
    await expect(dialog).toContainText(/ยังไม่บันทึกจนกว่าจะกดออกเอกสาร/);

    // ปิดแล้วต้องกลับมาที่ฟอร์ม ไม่ใช่หลุดไปหน้าอื่นหรือบันทึกอะไรไป
    // ⚠️ กับดักภาษาไทย: regex /ปิด/ ไปแมตช์ปุ่ม "เปิดปฏิทิน" ในฟอร์มที่อยู่ "หลัง" ป๊อปอัป
    // (คำว่า "เ-ปิด-ปฏิทิน" มี "ปิด" อยู่ข้างใน) ป๊อปอัปจึงบังการคลิกไว้ แล้ว timeout 45 วินาที
    // โดยที่ข้อความ error ชี้ไปที่ "กดปุ่มปิดไม่ได้" ซึ่งทำให้ไล่ผิดทาง (แก้ 27 ส.ค. 2569)
    // ต้องหาปุ่มภายในป๊อปอัปเท่านั้น และเทียบชื่อแบบตรงตัว ห้ามใช้ regex กว้าง ๆ
    await dialog.getByRole("button", { name: "ปิด", exact: true }).first().click();
    await expect(dialog).toBeHidden();
    expect(page.url()).toContain("/dashboard/sales/new");
  });
});

test.describe("การ์ดเริ่มต้นใช้งาน", () => {
  // ⚠️ เทสต์นี้มีไว้ปิดช่องว่างที่จงใจบันทึกไว้ 12 ส.ค. 2569:
  //    ขั้น "เปิดแจ้งเตือนงานค้าง" ถูกเพิ่มเข้าการ์ดโดยที่ยังไม่มีใครเห็นบนจอจริงเลย
  //    (ในเครื่องที่ build ไม่มี TEST_EMAIL จึงล็อกอินไม่ได้)
  //    ตั้งแต่นี้ไป ใครมีรหัสทดสอบแล้วรัน `npm run e2e` จะได้คำตอบทันทีโดยไม่ต้องไล่กดเอง
  test("ขั้น 'เปิดแจ้งเตือนงานค้าง' มีจริงและลิงก์ไปแท็บแจ้งเตือนถูกตัว", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const step = page.getByRole("link", { name: /เปิดแจ้งเตือนงานค้าง/ });
    if ((await step.count()) === 0) {
      // ครบทุกข้อแล้วการ์ดจะหายไปทั้งใบ — ไม่ใช่ความผิดพลาด แต่ต้องบอกให้รู้ว่าไม่ได้ตรวจ
      test.skip(true, "ไม่พบขั้นนี้ — กิจการทดสอบอาจเปิดแจ้งเตือนไว้แล้ว (การ์ดจึงหายไป)");
    }

    // พารามิเตอร์ต้องเป็น `s` ไม่ใช่ `tab` — ใส่ผิดจะไม่ error แต่ไปโผล่แท็บข้อมูลกิจการเงียบ ๆ
    await expect(step.first()).toHaveAttribute("href", "/dashboard/settings?s=notify");

    await step.first().click();
    await page.waitForURL(/\/dashboard\/settings/);
    // ถึงแท็บแจ้งเตือนจริง ไม่ใช่แท็บตั้งต้น
    await expect(page.getByText(/แจ้งเตือนบนเครื่องนี้/)).toBeVisible();
  });
});

test.describe("มือถือหลังล็อกอิน", () => {
  test("หน้าที่ใช้บ่อยไม่ล้นแนวนอนบนจอเล็ก", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "มือถือ", "ตรวจเฉพาะโปรเจกต์มือถือ");
    await login(page);

    for (const path of ["/dashboard", "/dashboard/sales", "/dashboard/money", "/dashboard/reports"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} ล้นแนวนอน ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("หน้าทดสอบกับผู้ใช้จริง (UAT)", () => {
  test("เปิดได้ · เริ่มจับเวลาแล้วมีปุ่มบันทึกผลครบ 3 ทาง", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/uat");
    await expect(page.getByRole("heading", { name: /ทดสอบกับผู้ใช้จริง/ })).toBeVisible();

    const start = page.getByRole("button", { name: /เริ่มจับเวลา/ });
    if ((await start.count()) === 0) test.skip(true, "บทบาทนี้จัดการทดสอบไม่ได้ (ต้องเป็น owner/admin)");

    await start.click();
    // สามทางเลือกต้องมีครบ — ถ้าขาด "ต้องช่วยบอก" ข้อมูลจะเพี้ยนเป็นผ่านหมด
    await expect(page.getByRole("button", { name: /ทำได้เอง/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /ต้องช่วยบอก/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /ยอมแพ้/ })).toBeVisible();
  });
});

// ============================================================
//  มือถือหลังล็อกอิน — กลุ่มผู้ใช้หลักของระบบนี้
//
//  ⚠️ ช่องโหว่ที่เพิ่งปิด (29 ส.ค. 2569)
//  เทสต์ "ไม่ล้นแนวนอน" เดิมมีเฉพาะหน้าสาธารณะ 5 หน้า
//  แต่หน้าที่ลูกค้าที่จ่ายเงินแล้วใช้ทุกวันคือหน้าหลังล็อกอิน ซึ่งไม่เคยถูกตรวจเรื่องนี้เลย
//  รอบนี้เพิ่งรื้อรายการเอกสารขาย/ค่าใช้จ่าย/การเงิน เป็นการ์ดบนมือถือ
//  ถ้าไม่มีด่านนี้ วันหลังใครแก้แล้วล้นจอจะไม่มีอะไรจับได้จนกว่าเจ้าของจะแคปมาเอง
// ============================================================
test.describe("มือถือหลังล็อกอิน", () => {
  test("หน้าที่ใช้ทุกวันไม่ล้นออกนอกจอแนวนอน", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "มือถือ", "ตรวจเฉพาะโปรเจกต์มือถือ");
    await login(page);

    for (const path of ["/dashboard", "/dashboard/sales", "/dashboard/expenses",
      "/dashboard/money", "/dashboard/reports", "/dashboard/contacts"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} ล้นแนวนอน ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
