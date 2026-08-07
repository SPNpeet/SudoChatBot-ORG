// ============================================================
//  เอาเมนู LINE ขึ้นใช้งานจริง — สร้าง LIFF app (ถ้ายังไม่มี) แล้วสร้าง/ตั้งเมนู
//
//  ⚠️ ทำไมต้องมีสคริปต์ ทั้งที่มีปุ่มในหน้าแอดมินอยู่แล้ว
//  ปุ่มในหน้าแอดมินต้องล็อกอินด้วยบัญชีเจ้าของ ซึ่งผู้ช่วยทำแทนไม่ได้
//  สคริปต์นี้ใช้ service role จากเครื่องเจ้าของ จึงเอาเมนูขึ้นได้เลยโดยไม่ต้องรอ
//  ทั้งสองทางเรียกโค้ดชุดเดียวกัน (lib/line-menu-deploy) เมนูจึงหน้าตาเหมือนกันเสมอ
//
//  วิธีใช้:  npm run line:menu
// ============================================================
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { deployRichMenu, ensureLiffApp } from "../src/lib/line-menu-deploy.ts";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const ORIGIN = process.env.APP_ORIGIN || "https://sudochatbot.online";
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log("\n== เอาเมนู LINE ขึ้นใช้งาน ==\n");

const liff = await ensureLiffApp(svc, `${ORIGIN}/liff`);
if (!liff.ok) {
  console.log(`  ข้าม LIFF: ${liff.error}`);
  console.log("  (เมนูจะยังใช้ลิงก์เว็บธรรมดา ซึ่งใช้งานได้ แต่เปิดนอกแอปไลน์)\n");
} else {
  console.log(`  LIFF: ${liff.liffId} ${liff.created ? "(สร้างใหม่)" : "(ใช้ตัวที่มีอยู่)"}`);
}

const r = await deployRichMenu(svc, ORIGIN);
if (!r.ok) {
  console.log(`\n  ไม่สำเร็จ: ${r.error}\n`);
  process.exit(1);
}
console.log(`  เมนู: ${r.richMenuId}`);
console.log(`  ปุ่ม: ${r.buttons} · โหมด: ${r.mode}`);
console.log(`  ${r.note}\n`);
console.log("  เปิดแชท OA ในมือถือดูได้เลย (อาจต้องปิด-เปิดแชทใหม่หนึ่งครั้ง)\n");
