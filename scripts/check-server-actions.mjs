// ============================================================
//  ด่านตรวจสิทธิ์ของ Server Action ทุกตัวในระบบ
//
//  ⚠️ ทำไมต้องมี (6 ส.ค. 2569)
//  Server Action ของ Next.js คือ **endpoint สาธารณะ** — ใครก็ยิงเข้ามาได้ตรง ๆ
//  ไม่ต้องผ่านหน้าเว็บของเรา ปุ่มที่เราซ่อนใน JSX ไม่ได้ป้องกันอะไรเลย
//  เคยเกิดจริงกับ changePlan (5 ส.ค.): เดิมรับ planCode จาก client แล้ว update
//  shops.plan ตรง ๆ โดยไม่ตรวจราคา -> เจ้าของกิจการยิงเองได้แพ็ก 999฿ ฟรี
//
//  ระบบนี้มี 67 action ใน 19 ไฟล์ และไม่เคยมีใครไล่ตรวจครบทั้งชุดเลยสักครั้ง
//  ตรวจด้วยตาทุกครั้งที่เพิ่ม action ใหม่ = ลืมแน่นอน จึงต้องเป็นด่านอัตโนมัติ
//
//  กติกา: ทุก action ที่ "แตะข้อมูล" ต้องมีด่านสิทธิ์อย่างน้อยหนึ่งอย่างก่อนเสมอ
//    assertMember / requireUser / assertPlatformAdmin / getCurrentShop
//  action ที่ไม่แตะข้อมูลเลย (เช่นคืนค่าคงที่) ยกเว้นได้ แต่ต้องไม่มี createServiceClient
//
//  ⚠️ ด่านนี้ตรวจ "มีด่านไหม" ไม่ได้ตรวจ "ด่านถูกไหม" — ตรวจว่า assertMember
//  ใส่ role ถูกต้องหรือเปล่าต้องใช้คนอ่าน ด่านนี้แค่กันเคสที่ลืมใส่ทั้งอัน
//  ซึ่งเป็นเคสที่เกิดจริงและเสียหายหนักที่สุด
// ============================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p, out); continue; }
    if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const rel = (p) => p.replace(/\\/g, "/");

// auth.getUser() + `if (!user) return` เป็นด่านที่ใช้จริงในโค้ดนี้เหมือนกัน
// (ตรวจครั้งแรกไม่ได้นับไว้ เลยได้ผลบวกปลอม 3 ตัว — ด่านที่ดังผิดคือด่านที่คนจะเลิกเชื่อ)
const GUARDS = /assertMember|requireUser|assertPlatformAdmin|getCurrentShop|assertShopAccess|auth\.getUser\(\)/;
// action ที่ตั้งใจไม่มีด่าน เพราะไม่แตะข้อมูลของใครเลย — ต้องระบุเหตุผลไว้ตรงนี้เท่านั้น
const ALLOW = new Set([
  // สมัครสมาชิก — ต้องเรียกได้ตอนยังไม่มีบัญชี จึงไม่มีด่านสิทธิ์โดยธรรมชาติ
  // ตัวกันจริงของ action นี้คือ rate limit + ตรวจโดเมนอีเมล + Supabase Auth เอง
  "src/app/signup/actions.ts:signUpDirect",
]);

let failures = 0;
let checked = 0;
const missing = [];

for (const f of walk("src")) {
  const src = readFileSync(f, "utf8");
  if (!/^\s*["']use server["']/m.test(src.slice(0, 300))) continue;

  // ตัดไฟล์เป็นก้อนต่อฟังก์ชัน export — จบก้อนเมื่อเจอ export ตัวถัดไป
  const parts = src.split(/\nexport async function /).slice(1);
  const names = [...src.matchAll(/\nexport async function (\w+)/g)].map((m) => m[1]);

  parts.forEach((body, i) => {
    const name = names[i] ?? "(ไม่ทราบชื่อ)";
    checked++;
    const key = `${rel(f)}:${name}`;
    if (ALLOW.has(key)) return;
    // แตะข้อมูลไหม
    const touchesData = /createServiceClient|createClient\(|\.from\(|\.rpc\(/.test(body);
    if (!touchesData) return;
    if (GUARDS.test(body)) return;
    missing.push(key);
  });
}

console.log("\n== Server Action ที่แตะข้อมูลโดยไม่มีด่านสิทธิ์ ==");
if (missing.length) {
  failures++;
  console.log(`  ผิด  พบ ${missing.length} ตัว:`);
  for (const m of missing) console.log(`        ${m}`);
  console.log("        Server Action = endpoint สาธารณะ ใครก็ยิงตรงได้ ปุ่มที่ซ่อนใน JSX ไม่ได้กันอะไร");
  console.log("        ต้องเรียก assertMember / requireUser / assertPlatformAdmin ก่อนแตะข้อมูลเสมอ");
} else {
  console.log(`  ถูก  ตรวจ ${checked} action — ทุกตัวที่แตะข้อมูลมีด่านสิทธิ์ครบ`);
}

process.exit(failures === 0 ? 0 : 1);
