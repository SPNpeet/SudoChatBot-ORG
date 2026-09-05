// ============================================================
//  จุดที่ "วัดแล้วพัง" จากรอบกวาดการจัดวาง 5 ก.ย. 2569 (62 หน้า-จอ)
//
//  ทุกข้อในนี้เคยเป็นบั๊กจริงบน production ที่ typecheck/build ผ่านสบาย:
//  เมนูซ้ายถูกตัดที่จอ 900px · ตัวเลขวันที่ของเบราว์เซอร์ทับข้อความไทย ·
//  ทูลทิปทำให้ทั้งหน้าเลื่อนแนวนอน · ช่องกรอกถูก flex บีบเหลือ 29px ·
//  ปุ่มลอยทับตัวเลขบนหน้ารายงาน · ป้ายสถานะตกบรรทัด · ชื่อผู้ช่วยถูกเฉือนวรรณยุกต์
//
//  เทสต์นี้ยึด "ค่าที่วัดได้" (getComputedStyle / getBoundingClientRect / elementFromPoint)
//  ไม่ใช่การมีอยู่ของ class — class มีได้แต่ถูกทับ ซึ่งคือสิ่งที่เกิดขึ้นจริงมาแล้ว
// ============================================================
import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').first().fill(EMAIL!);
  await page.locator('input[type="password"]').first().fill(PASSWORD!);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

const MOBILE = { width: 390, height: 844 };

test.describe("หน้าสาธารณะ", () => {
  test("ลิงก์เอกสารที่ไม่มีอยู่ ได้หน้าอธิบายภาษาคน ไม่ใช่ 404 เปล่า", async ({ page }) => {
    await page.goto("/doc/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("ไม่พบเอกสารตามลิงก์นี้")).toBeVisible();
  });

  test("หน้าลืมรหัสผ่านและตั้งรหัสใหม่ ไม่ถูกเก็บเข้าดัชนี", async ({ page }) => {
    for (const path of ["/forgot-password", "/reset-password"]) {
      await page.goto(path);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(robots ?? "", path).toMatch(/noindex/);
    }
  });

  test("og:url ของหน้าราคาชี้หน้าราคา ไม่ใช่หน้าแรก", async ({ page }) => {
    await page.goto("/pricing");
    const og = await page.locator('meta[property="og:url"]').getAttribute("content");
    expect(og?.replace(/\/$/, "")).toBe("https://sudochatbot.online/pricing");
  });

  test("/try — หัวเรื่องเป็นหัวเรื่องจริง และช่องกรอกบนมือถือสูงพอกด", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/try");
    const h1Size = await page.locator("h1").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(h1Size).toBeGreaterThanOrEqual(20);
    const heights = await page.locator("input[type='text'], input:not([type])").evaluateAll(
      (els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(43);
  });
});

test.describe("หลังเข้าสู่ระบบ", () => {
  test.skip(!EMAIL || !PASSWORD,
    "ข้ามทั้งชุด — ยังไม่ได้ตั้ง TEST_EMAIL/TEST_PASSWORD ⚠️ แปลว่าจุดที่เคยพังยังไม่ถูกตรวจซ้ำ");

  test("เมนูซ้ายที่จอ 1440x900 — ทุกรายการกดได้จริง ไม่ถูกตัดหาย", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    const nav = page.locator("aside nav").first();
    // ต้นเหตุจริง: flex child ไม่มี min-h-0 จึงไม่เคย overflow → ไม่มี scrollbar → รายการล่างหาย
    expect(await nav.evaluate((el) => getComputedStyle(el).minHeight)).toBe("0px");
    for (const label of ["ตั้งค่า", "คู่มือใช้งาน", "แพ็กเกจและเครดิต"]) {
      const link = page.locator("aside nav a", { hasText: label }).first();
      await link.scrollIntoViewIfNeeded();
      const clickable = await link.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && (hit === el || el.contains(hit));
      });
      expect(clickable, `เมนู "${label}" ต้องกดได้`).toBe(true);
    }
  });

  test("ช่องวันที่ — ตัวเลขของเบราว์เซอร์โปร่งใสเสมอ ไม่ทับข้อความไทย", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/sales/new?type=invoice");
    const colors = await page.locator('input[type="date"]').evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) expect(c).toBe("rgba(0, 0, 0, 0)");
  });

  test("ตั้งค่า > การรับเงิน บนมือถือ — ทั้งหน้าต้องไม่เลื่อนแนวนอน และปุ่ม ? กดได้ 44px", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page);
    await page.goto("/dashboard/settings?s=payment");
    const [scrollW, innerW] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scrollW).toBeLessThanOrEqual(innerW + 1);
    const hint = page.locator('button[aria-label="ดูคำอธิบาย"]').first();
    const box = await hint.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(43);
  });

  test("ช่องกรอกในแถว flex-col บนมือถือ — ไม่ถูกบีบต่ำกว่า 44px", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page);
    await page.goto("/dashboard/assistant/memory");
    const mem = await page.locator("#mem-new").boundingBox();
    expect(mem?.height ?? 0).toBeGreaterThanOrEqual(43);
    await page.goto("/dashboard/settings?s=team");
    const email = await page.locator('input[name="email"]').first().boundingBox();
    expect(email?.height ?? 0).toBeGreaterThanOrEqual(43);
  });

  test("ปุ่มลอย + ไม่แสดงบนหน้าที่ตัวเลขชิดขวา แต่ยังอยู่บนหน้างานเอกสาร", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page);
    await page.goto("/dashboard/reports");
    await expect(page.locator('button[aria-label="สร้างเอกสารใหม่"]')).toHaveCount(0);
    await page.goto("/dashboard/sales");
    await expect(page.locator('button[aria-label="สร้างเอกสารใหม่"]')).toHaveCount(1);
  });

  test("ป้ายสถานะไม่ตกบรรทัด และแถบแท็บบนมือถือมีเงาบอกว่าเลื่อนได้", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page);
    await page.goto("/dashboard");
    const ws = await page.locator("span.rounded-full.ring-1").evaluateAll((els) => els.map((e) => getComputedStyle(e).whiteSpace));
    for (const w of ws) expect(w).toBe("nowrap");
    await page.goto("/dashboard/reports");
    const mask = await page.locator(".tabstrip").first().evaluate((el) => {
      const s = getComputedStyle(el) as CSSStyleDeclaration & { webkitMaskImage?: string };
      return s.maskImage || s.webkitMaskImage || "none";
    });
    expect(mask).not.toBe("none");
  });

  test("ชื่อผู้ช่วยในหัวเรื่องไม่ถูกเฉือนวรรณยุกต์", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/assistant");
    const ok = await page.locator("h1 span.truncate").first().evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    expect(ok).toBe(true);
  });
});
