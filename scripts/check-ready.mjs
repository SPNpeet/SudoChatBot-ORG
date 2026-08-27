// ============================================================
//  เช็กความพร้อมของระบบ — คำสั่งเดียวบอกว่าอะไรยังขาด และต้องทำอะไรต่อ
//
//  ⚠️ ทำไมต้องมี (6 ส.ค. 2569)
//  มีงานอยู่ 4 อย่างที่ผู้ช่วยทำแทนไม่ได้เพราะต้องใช้บัญชี/เครื่อง/ตัวตนของเจ้าของ
//  (บัญชีทดสอบ · คีย์ Stripe · CRON_SECRET · LINE Login)
//  ทั้งสี่ข้อค้างข้ามหลายวันเพราะมันกระจายอยู่คนละที่ ต้องจำเองว่าเหลืออะไร
//  และไม่มีทางรู้ว่า "ตั้งค่าไปแล้วใช้ได้จริงหรือยัง" นอกจากลองใช้แล้วพัง
//
//  ไฟล์นี้เปลี่ยนของค้าง 4 อย่างให้เหลือคำสั่งเดียวที่ตอบได้ว่า
//  พร้อมแล้วกี่ข้อ · ข้อไหนยังขาด · ขาดแล้วลูกค้าเจออะไร · ต้องทำอะไรต่อ
//
//  ตรวจจาก "ของจริง" ทั้งหมด (Vault / ฐานข้อมูล / endpoint จริง)
//  ไม่ได้เดาจากไฟล์ตั้งค่า — ตั้งค่าไว้แต่ใช้ไม่ได้ ต้องนับว่ายังไม่พร้อม
//
//  วิธีใช้:  npm run check:ready
// ============================================================
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const BASE = process.env.CHECK_BASE_URL || "https://sudochatbot.online";
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const items = [];
const add = (name, ready, impact, howto) => items.push({ name, ready, impact, howto });

// ---- 1. คีย์ Stripe (ปลดล็อกการขายทั้งหมด) ----
{
  const { data: sk } = await svc.rpc("get_platform_stripe_key");
  const { data: wh } = await svc.rpc("get_platform_stripe_webhook_secret");
  const hasKey = typeof sk === "string" && sk.trim().length > 0;
  const hasWh = typeof wh === "string" && wh.trim().length > 0;
  // ⚠️ มีคีย์ครบ != รับเงินจริงได้ (แก้ 8 ส.ค. 2569)
  // เดิมด่านนี้ขึ้น "พร้อม" ทันทีที่มีคีย์สองตัว ทั้งที่คีย์เป็น sk_test_
  // ซึ่งรับได้แค่บัตรทดสอบ — ลูกค้าจริงจ่ายไม่ผ่านสักคน
  // และแม้เป็นคีย์ live ถ้าบัญชี Stripe ยังไม่ผ่านการยืนยันตัวตน (charges_enabled=false)
  // ก็ยังรับเงินไม่ได้อยู่ดี ต้องถาม Stripe ตรง ๆ ไม่ใช่เดาจากการมีคีย์
  const isTest = hasKey && sk.trim().startsWith("sk_test");
  let chargesEnabled = false;
  let acctNote = "";
  if (hasKey) {
    try {
      const r = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${sk.trim()}` } });
      const a = await r.json();
      chargesEnabled = a?.charges_enabled === true;
      if (!chargesEnabled) acctNote = " · บัญชี Stripe ยังไม่ผ่านการยืนยันตัวตน (charges_enabled=false)";
    } catch { acctNote = " · ถาม Stripe ไม่ได้"; }
  }
  add(
    "รับเงินค่าแพ็กเกจ (Stripe)",
    hasKey && hasWh && !isTest && chargesEnabled,
    !hasKey ? "ไม่มีใครสมัครแพ็กเสียเงินได้เลย — หน้าแพ็กเกจซ่อนปุ่มสมัคร"
      : !hasWh ? "มี secret key แต่ยังไม่มี webhook secret = จ่ายเงินแล้วระบบจะไม่รู้ว่าจ่ายแล้ว"
      : isTest ? `คีย์ที่ใส่เป็นคีย์ทดสอบ (sk_test) รับได้เฉพาะบัตรทดสอบ ลูกค้าจริงจ่ายไม่ผ่านสักคน${acctNote}`
      : `คีย์เป็น live แล้วแต่ Stripe ยังไม่ให้รับเงิน${acctNote}`,
    isTest || !chargesEnabled
      ? "เปิดใช้บัญชี Stripe จริง (กรอกข้อมูลธุรกิจ + บัญชีธนาคาร) -> เปิด PromptPay ในโหมด live -> สร้าง webhook ของโหมด live -> ใส่คีย์ sk_live + whsec ใหม่ที่ /dashboard/admin/billing"
      : "สมัคร Stripe บัญชีไทย -> เปิด PromptPay -> ตั้ง webhook ไป /api/billing/stripe/webhook -> ใส่ 2 คีย์ที่ /dashboard/admin/billing",
  );
}

// ---- 2. งานตามเวลา (สำรองข้อมูล + สรุปรายสัปดาห์) ----
{
  // ⚠️ ยิง HTTP เปล่า ๆ แยกไม่ออกอีกแล้ว (แก้ 28 ส.ค. 2569)
  // ตั้งแต่ migration 106 ความลับเก็บได้ทั้งใน env และใน Vault
  // คำขอที่ไม่มีความลับต้องได้ 503 เสมอ ซึ่งถูกต้องแล้ว แต่แปลว่า 503
  // ไม่ได้บอกว่า "ยังไม่ได้ตั้ง" อีกต่อไป ถ้ายังวัดแบบเดิมกระดานจะขึ้นแดงค้าง
  // ทั้งที่งานเดินอยู่จริง — ด่านที่พูดไม่ตรงความจริงทำให้เจ้าของเลิกเชื่อทั้งกระดาน
  let cronReady = false;
  let cronNote = "";
  try {
    const { data: dbSecret } = await svc.rpc("get_cron_secret");
    if (typeof dbSecret === "string" && dbSecret.trim()) {
      cronReady = true;
      cronNote = " · ความลับเก็บใน Vault และงานตั้งเวลาอยู่ในฐานข้อมูล ไม่ต้องพึ่ง env";
    }
  } catch { /* ยังไม่ได้ apply migration 106 */ }
  if (!cronReady) {
    const res = await fetch(`${BASE}/api/cron/backup`).catch(() => null);
    cronReady = !!res && res.status !== 503;
  }

  // ⚠️ ต้องนับชั้นกู้คืนในฐานข้อมูลด้วย (แก้ 27 ส.ค. 2569)
  // migration 100 เพิ่ม snapshot รายวันในฐานข้อมูลเอง ซึ่งทำงานอยู่จริงและตรวจได้
  // แต่ด่านนี้ยังดูแค่ endpoint ของ Vercel แล้วรายงานว่า "ไม่มีไฟล์สำรองอัตโนมัติเลย"
  // ซึ่งไม่จริงอีกต่อไป — ด่านที่พูดไม่ตรงความจริงทำให้เจ้าของเลิกเชื่อทั้งกระดาน
  let snapNote = "";
  try {
    const { data } = await svc.rpc("snapshot_status");
    const latest = String(data?.latest ?? "").replace("snapshot_", "").replace(/_/g, "-");
    if (latest) {
      const ageDays = Math.floor((Date.now() - Date.parse(latest)) / 86_400_000);
      snapNote = ageDays <= 2
        ? ` · มีจุดกู้คืนในฐานข้อมูลอยู่แล้ว ${data.count} วัน (ล่าสุด ${latest})`
        : ` · จุดกู้คืนในฐานข้อมูลค้างมา ${ageDays} วัน (ล่าสุด ${latest}) — ต้องเช็คว่างานตามเวลาในฐานข้อมูลยังทำงานไหม`;
    }
  } catch { /* ยังไม่มีฟังก์ชันนี้ = ยังไม่ได้ apply migration 100 */ }

  add(
    `สำรองข้อมูลออกนอกฐาน + สรุปรายสัปดาห์${cronReady ? cronNote : ""}`,
    cronReady,
    `ยังไม่มีไฟล์สำรองที่เก็บออกนอกฐานข้อมูล และยังไม่ส่งสรุปรายสัปดาห์${snapNote}`,
    "ตั้ง CRON_SECRET ใน Vercel (Settings > Environment Variables) แล้ว redeploy",
  );
}

// ---- 3. LINE Login (ทางเข้าที่คนไทยใช้มากที่สุด) ----
{
  const res = await fetch(`${BASE}/api/auth/line/status`).catch(() => null);
  let enabled = false;
  try { enabled = !!(await res?.json())?.enabled; } catch { /* ปิดอยู่ */ }
  add(
    "เข้าสู่ระบบด้วย LINE",
    enabled,
    "ลูกค้าต้องจำอีเมล+รหัสผ่าน ซึ่งเป็นจุดที่คนไทยเลิกกลางทางมากที่สุด",
    "สร้าง LINE Login channel -> ใส่ LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET ใน Vercel -> callback https://sudochatbot.online/api/auth/line/callback",
  );
}

// ---- 4. บัญชีทดสอบ (ปลดล็อกการตรวจหน้าหลังล็อกอิน) ----
{
  const has = !!(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);
  add(
    "ชุดตรวจหน้าหลังล็อกอิน",
    has,
    "หน้าหลังล็อกอิน 18 หน้ายังไม่เคยถูกเปิดดูของจริงเลยสักหน้า — รู้แค่ว่าโค้ดคอมไพล์ผ่าน",
    "สมัครบัญชีเปล่าที่ /signup (ห้ามใช้บัญชีที่มีข้อมูลลูกค้าจริง) -> ใส่ TEST_EMAIL/TEST_PASSWORD ใน .env.local -> npm run check:ui:auth",
  );
}

// ---- 5. ตรวจสลิปอัตโนมัติ (ไม่บังคับแล้ว แต่บอกสถานะไว้) ----
{
  const { data: pf } = await svc.from("platform_billing_settings").select("slip_provider").eq("id", true).maybeSingle();
  const { data: key } = await svc.rpc("get_platform_slip_key");
  const ready = !!pf?.slip_provider && pf.slip_provider !== "manual" && !!key;
  add(
    "ตรวจสลิปอัตโนมัติ (ไม่บังคับ)",
    ready,
    "ลูกค้าของร้านยังส่งสลิปได้ปกติ แต่ร้านต้องกดยืนยันเอง (ไม่ตัดยอดให้อัตโนมัติ)",
    "สมัคร SlipOK แพ็กฟรี -> ใส่คีย์ที่ /dashboard/admin/billing",
  );
}

const ready = items.filter((i) => i.ready).length;
console.log(`\n== ความพร้อมของระบบ: ${ready}/${items.length} ==\n`);
for (const i of items) {
  console.log(`  ${i.ready ? "พร้อม  " : "ยังขาด "} ${i.name}`);
  if (!i.ready) {
    console.log(`           ผลตอนนี้: ${i.impact}`);
    console.log(`           ต้องทำ:   ${i.howto}`);
  }
}
console.log(
  ready === items.length
    ? "\n  ครบทุกข้อแล้ว\n"
    : `\n  เหลือ ${items.length - ready} ข้อ — ทุกข้อต้องทำในบัญชี/เครื่องของเจ้าของเอง ผู้ช่วยทำแทนไม่ได้\n`,
);
// ไม่ทำให้ deploy ล้ม — เป็นรายงานสถานะ ไม่ใช่ด่านกันบั๊ก
process.exit(0);
