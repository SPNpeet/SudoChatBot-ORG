// ============================================================
//  ตรวจว่าลิงก์ที่ผู้ช่วย AI ส่งให้ผู้ใช้ "มีหน้าอยู่จริง" (เพิ่ม 8 ส.ค. 2569)
//
//  ⚠️ ทำไมต้องมี
//  ผู้ช่วยตอบกลับพร้อมปุ่มลิงก์ (view_link / print_link / share_link ฯลฯ)
//  ซึ่งเป็นสิ่งที่ผู้ใช้กดต่อทันที ถ้าเส้นทางผิดแม้ตัวเดียว ผู้ใช้จะเจอ 404
//  ในจังหวะที่เพิ่งออกเอกสารสำเร็จ — ดูเหมือนระบบทำงานไม่จบ ทั้งที่เอกสารออกแล้วจริง
//
//  เกิดจริงวันนี้: ตอนเพิ่ม tool get_doc_links ผมเขียน print_link เป็น
//  /dashboard/sales/<id>/print แต่หน้าพิมพ์จริงอยู่ที่ /dashboard/print/<id>
//  typecheck จับไม่ได้เพราะมันเป็นแค่สตริง — ต้องมีด่านเทียบกับ route จริงในโปรเจกต์
// ============================================================
import { readFileSync, existsSync, readdirSync } from "node:fs";

const SRC = "src/app/dashboard/assistant/engine.ts";
const code = readFileSync(SRC, "utf8");

let failures = 0;
const bad = (msg) => { failures++; console.log(`  ผิด  ${msg}`); };

const found = new Set();
for (const m of code.matchAll(/\b\w*(?:_link|_xlsx|_report|_balance):\s*`([^`]+)`/g)) found.add(m[1]);
for (const m of code.matchAll(/\b\w*(?:_link|_xlsx|_report|_balance):\s*"(\/[^"]+)"/g)) found.add(m[1]);

console.log("\n== ลิงก์ที่ผู้ช่วย AI ส่งให้ผู้ใช้ ==");
if (found.size === 0) bad("ไม่พบลิงก์เลยในไฟล์ engine — ตัวตรวจน่าจะพัง ไม่ใช่โค้ดถูก");

const DYN = "§";      // ตัวแทนส่วนที่เป็นค่าจากตัวแปร

/**
 * แตกลิงก์เป็นเส้นทางที่เป็นไปได้ทั้งหมด
 * ternary ของสตริงคงที่ เช่น ${x ? "expenses" : "sales"} ต้องตรวจทั้งสองทาง
 * เพราะทั้งสองทางคือเส้นทางที่ผู้ใช้จะได้จริง
 */
function expand(link) {
  // ⚠️ ห้ามตัด query ด้วย split("?") ก่อนแทนค่าตัวแปร
  // เพราะ ternary ข้างใน ${...} ก็มี "?" อยู่ จะโดนตัดกลางเส้นทาง
  let out = [link];
  for (;;) {
    const next = [];
    let changed = false;
    for (const p of out) {
      const m = p.match(/\$\{([^}]*)\}/);
      if (!m) { next.push(p); continue; }
      changed = true;
      const tern = m[1].match(/\?\s*"([^"]+)"\s*:\s*"([^"]+)"/);
      if (tern) {
        next.push(p.replace(m[0], tern[1]), p.replace(m[0], tern[2]));
      } else {
        next.push(p.replace(m[0], DYN));
      }
    }
    out = next;
    if (!changed) break;
  }
  return out.map((p) => p.split("?")[0].replace(/\/$/, ""));
}

function dynamicDir(dir) {
  try {
    const hit = readdirSync(dir).find((n) => n.startsWith("[") && n.endsWith("]"));
    return hit ? `${dir}/${hit}` : null;
  } catch { return null; }
}

function routeExists(pathname) {
  let dir = "src/app";
  for (const part of pathname.split("/").filter(Boolean)) {
    if (part === DYN) {
      const dyn = dynamicDir(dir);
      if (!dyn) return false;
      dir = dyn;
      continue;
    }
    const next = `${dir}/${part}`;
    if (existsSync(next)) { dir = next; continue; }
    const dyn = dynamicDir(dir);
    if (dyn) { dir = dyn; continue; }
    return false;
  }
  return ["page.tsx", "route.ts", "route.tsx"].some((f) => existsSync(`${dir}/${f}`));
}

let checked = 0;
for (const link of [...found].sort()) {
  if (!link.startsWith("/")) { bad(`${link} — ลิงก์ต้องขึ้นต้นด้วย / (เป็น path ในระบบเท่านั้น)`); continue; }
  for (const p of expand(link)) {
    checked++;
    if (!routeExists(p)) bad(`${link} → ${p} ไม่มีหน้านี้อยู่จริงในโปรเจกต์`);
  }
}

console.log(failures === 0
  ? `  ถูก  ตรวจ ${checked} เส้นทาง มีหน้าอยู่จริงทุกเส้น\n`
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ — ผู้ใช้จะกดแล้วเจอ 404 ห้าม deploy\n`);
process.exit(failures === 0 ? 0 : 1);
