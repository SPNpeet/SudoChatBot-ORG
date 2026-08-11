// ============================================================
//  ชุดทดสอบเส้นทางผู้ใช้จริง (E2E)
//
//  ทำไมต้องมี: ด่าน `npm run verify` ทั้ง 9 ด่านตรวจ "โค้ดถูกไหม" ได้ดีมาก
//  แต่ตรวจ "คนใช้ได้ไหม" ไม่ได้เลย — build ผ่านแล้วหน้าเว็บพังยังเกิดได้เสมอ
//  โดยเฉพาะหน้า force-dynamic ที่ไม่ถูก render ตอน build (กติกาข้อ 5)
//
//  ชุดนี้เปิดเบราว์เซอร์จริง กดจริง อ่านหน้าจอจริง — เป็นหลักฐานระดับ "วัดแล้ว"
//  ไม่ใช่ "อ่านโค้ดแล้วเชื่อว่า"
//
//  ยิงใส่ production เป็นค่าเริ่มต้น เพราะนั่นคือของที่ลูกค้าใช้จริง
//  เปลี่ยนเป้าหมายได้ด้วย E2E_BASE_URL (เช่นชี้ไป preview ของ Vercel หรือ localhost)
//
//  ⚠️ ทุกเทสต์ในชุดนี้ต้อง "อ่านอย่างเดียว" กับ production — ห้ามสร้าง/แก้/ลบข้อมูลจริง
//     เส้นทางที่ต้องเขียนข้อมูลให้ทดสอบบนกิจการทดสอบเท่านั้น และต้องล้างหลังเสร็จ
// ============================================================
import { defineConfig, devices } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://sudochatbot.online";

/**
 * ใช้ Chromium ที่ติดตั้งไว้ในเครื่องแล้ว แทนที่จะให้ Playwright โหลดใหม่
 *
 * ⚠️ เวอร์ชัน Playwright กับเลข build ของเบราว์เซอร์ผูกกัน ถ้าไม่ตรงจะขึ้น
 * "Executable doesn't exist" แล้วชวนให้รัน `playwright install` ซึ่งบางเครื่อง
 * (เช่น CI ที่ปิดเน็ตออกนอก) ทำไม่ได้ — ชี้ path ตรงจึงทนกว่า
 * ตั้ง E2E_CHROME ทับได้ถ้าเครื่องไหนวางไว้คนละที่
 */
const PROXY = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "";

const CHROME = process.env.E2E_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const hasLocalChrome = (() => {
  try { return require("node:fs").existsSync(CHROME); } catch { return false; }
})();

export default defineConfig({
  testDir: "./e2e",
  // เน็ตจริงช้ากว่าเครื่อง local — ให้เวลาพอสมควรแต่ไม่ปล่อยให้ค้างยาว
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // ยิง production พร้อมกันเยอะ ๆ ไม่สุภาพ และทำให้ตัวเลขเวลาเพี้ยน
  workers: process.env.CI ? 2 : 3,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // ⚠️ ห้ามตั้ง `proxy:` ตรงนี้ — มันไปทับ --proxy-bypass-list ใน launchOptions
    //    ทำให้ 127.0.0.1 ถูกส่งเข้า proxy อีก (วัดแล้ว: ตั้งแล้วตก 17 เทสต์ เอาออกแล้วผ่าน)
    //    เรื่อง proxy จัดการที่ args ของ Chromium ที่เดียวเท่านั้น
    ...(PROXY ? { ignoreHTTPSErrors: true } : {}),
  },
  projects: [
    // ลูกค้าจริงส่วนใหญ่เป็นแม่ค้า/เจ้าของกิจการที่อยู่บนมือถือ — จอเล็กต้องมาก่อน
    {
      name: "มือถือ",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          ...(hasLocalChrome ? { executablePath: CHROME } : {}),
          // ส่ง proxy เป็น argument ของ Chromium ตรง ๆ — ตัวเลือก proxy ของ Playwright
          // ไม่พอในสภาพแวดล้อมที่ proxy ถอด TLS (เจอ ERR_CONNECTION_RESET)
          // --proxy-bypass-list สำคัญมาก: ถ้าไม่ใส่ Chromium จะส่ง 127.0.0.1 เข้า proxy ด้วย
          // แล้วได้ 405 จาก proxy กลับมา ซึ่ง "โหลดสำเร็จ" แต่ไม่มีเนื้อหาของเรา
          // อาการหลอกมาก: goto ไม่ throw แต่หา element ไม่เจอสักตัว
          //
          // ⚠️ ห้ามใช้ค่า `<-loopback>` — มันแปลว่า "ห้ามข้าม proxy สำหรับ loopback"
          // ซึ่งตรงข้ามกับที่ต้องการ (วัดแล้ว: <-loopback> ได้ 405 · ระบุชื่อตรง ๆ ได้ 200)
          args: PROXY
            ? [`--proxy-server=${PROXY}`, "--proxy-bypass-list=127.0.0.1;localhost", "--ignore-certificate-errors"]
            : [],
        },
      },
    },
    {
      name: "เดสก์ท็อป",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          ...(hasLocalChrome ? { executablePath: CHROME } : {}),
          // ส่ง proxy เป็น argument ของ Chromium ตรง ๆ — ตัวเลือก proxy ของ Playwright
          // ไม่พอในสภาพแวดล้อมที่ proxy ถอด TLS (เจอ ERR_CONNECTION_RESET)
          // --proxy-bypass-list สำคัญมาก: ถ้าไม่ใส่ Chromium จะส่ง 127.0.0.1 เข้า proxy ด้วย
          // แล้วได้ 405 จาก proxy กลับมา ซึ่ง "โหลดสำเร็จ" แต่ไม่มีเนื้อหาของเรา
          // อาการหลอกมาก: goto ไม่ throw แต่หา element ไม่เจอสักตัว
          //
          // ⚠️ ห้ามใช้ค่า `<-loopback>` — มันแปลว่า "ห้ามข้าม proxy สำหรับ loopback"
          // ซึ่งตรงข้ามกับที่ต้องการ (วัดแล้ว: <-loopback> ได้ 405 · ระบุชื่อตรง ๆ ได้ 200)
          args: PROXY
            ? [`--proxy-server=${PROXY}`, "--proxy-bypass-list=127.0.0.1;localhost", "--ignore-certificate-errors"]
            : [],
        },
      },
    },
  ],
});
