// ============================================================
//  ด่านกันบั๊ก UI ที่ typecheck / lint / build จับไม่ได้
//
//  ทำไมต้องมี: 30 ก.ค. 2569 ผู้ใช้เจอโลโก้ซ้อนกัน 2 อันบนมือถือ
//  ต้นเหตุคือ Logo รับ prop className มาแล้วต่อด้วยสตริงแทน cn()
//  ทำให้คลาส display ที่ผู้เรียกส่งมา (hidden) โดนคลาสฐาน (inline-flex) ทับ
//  เพราะ CSS ตัดสินคลาสน้ำหนักเท่ากันจากลำดับในไฟล์สไตล์ ไม่ใช่ลำดับใน class
//  build ผ่าน typecheck ผ่าน lint ผ่าน — เห็นได้ทางเดียวคือเปิดดูด้วยตา
//
//  ⚠️ ตรวจเฉพาะ "รูปแบบที่เคยทำให้พังจริง" เท่านั้น ไม่ตรวจสไตล์การเขียนทั่วไป
//  ด่านที่ดังบ่อยเกินจะถูกคนมองข้าม แล้วก็ไร้ประโยชน์
//
//  โดยเฉพาะ: การต่อสตริงเพื่อสลับ "สี" ตามเงื่อนไขในไฟล์เดียว (เช่น
//  text-emerald-600 กับ text-red-600) ไม่ใช่อันตราย เพราะไม่มีคลาสฐานให้ชน
//  อันตรายคือตอนที่ component เปิดรับ className จากข้างนอกแล้วไม่ยอมให้ทับของตัวเอง
// ============================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ผิด   ${msg}`); };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p, out); continue; }
    if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk("src");
const rel = (p) => p.replace(/\\/g, "/");

// ---------- 1. component ที่รับ className แล้วต่อสตริงเอง ----------
console.log("\n== component ที่รับ className มาแล้วไม่ใช้ cn() ==");
{
  let found = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    // ต้องเป็นไฟล์ที่ "เปิดรับ className จากข้างนอก" เท่านั้น
    if (!/className\s*[=:,}]/.test(src) || !/\bclassName\s*(=\s*""|[,}:])/.test(src)) continue;
    if (!/\{\s*className\b|className\s*=\s*""|className\?\s*:/.test(src)) continue;

    // แล้วเอา prop นั้นไปต่อสตริงใน template literal
    for (const m of src.matchAll(/className=\{`[^`]*\$\{\s*className\s*\}[^`]*`\}/g)) {
      found++;
      fail(`${rel(f)} — ต่อ prop className ด้วยสตริง: ${m[0].slice(0, 60)}...`);
      console.log("         ผู้เรียกจะทับคลาสฐานไม่ได้ (เคส Logo 30 ก.ค. 2569) ให้ใช้ cn(\"ฐาน\", className)");
    }
  }
  if (!found) console.log("  ถูก  ทุก component ที่รับ className ใช้ cn() หมด");
}

// ---------- 2. Server Component ดึงฟังก์ชันจากไฟล์ "use client" ----------
console.log('\n== Server Component import ฟังก์ชันจากไฟล์ "use client" ==');
{
  const clientFiles = new Set();
  for (const f of files) {
    if (/^\s*["']use client["']/m.test(readFileSync(f, "utf8").slice(0, 200))) {
      clientFiles.add(rel(f).replace(/\.tsx?$/, ""));
    }
  }
  let found = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (/^\s*["']use client["']/m.test(src.slice(0, 200))) continue;
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g)) {
      // ข้าม type import — ถูกลบตอน compile ไม่ข้ามเส้นจริง
      const runtime = m[1].split(",").map((s) => s.trim()).filter((n) => n && !n.startsWith("type "));
      // component ตัวใหญ่ส่งข้ามเส้นได้ ที่พังคือฟังก์ชัน/ค่าธรรมดา (ตัวเล็ก)
      const plain = runtime.filter((n) => /^[a-z]/.test(n));
      if (!plain.length) continue;
      const dir = rel(f).split("/").slice(0, -1).join("/");
      const target = new URL(m[2], `file:///${dir}/`).pathname.slice(1);
      if (![...clientFiles].some((c) => c === target)) continue;
      found++;
      fail(`${rel(f)} — import ${plain.join(", ")} จาก "${m[2]}" ซึ่งเป็นไฟล์ "use client"`);
      console.log("         เรียกจากฝั่งเซิร์ฟเวอร์แล้วพังตอนรันจริง (build ผ่านเพราะหน้าเป็น force-dynamic) ให้ย้ายไป src/lib/");
    }
  }
  if (!found) console.log('  ถูก  ไม่มี Server Component ดึงฟังก์ชันจากไฟล์ "use client"');
}

// ---------- 3. useEffect ที่สั่งเลื่อนจอโดยไม่มีเงื่อนไข ----------
console.log("\n== useEffect ที่เลื่อนจอตอน mount (จอเด้งเองตอนเปิดหน้า) ==");
{
  let found = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    // จับ useEffect ที่มี scrollIntoView แต่ในตัว effect ไม่มี early return / เงื่อนไขกันไว้เลย
    for (const m of src.matchAll(/useEffect\(\(\)\s*=>\s*\{?([\s\S]{0,320}?)\}?,\s*\[/g)) {
      const body = m[1];
      if (!body.includes("scrollIntoView")) continue;
      if (/return|length === 0|length > 0|\.length/.test(body)) continue;   // มีเงื่อนไขแล้ว
      found++;
      fail(`${rel(f)} — useEffect สั่ง scrollIntoView โดยไม่เช็คว่ามีอะไรให้เลื่อนไปหา`);
      console.log('         effect วิ่งตอน mount ด้วย -> เปิดหน้ามาจอเด้งไปกลางหน้าเอง');
      console.log('         (เกิดจริง 2 รอบ: หน้าผู้ช่วย AI และหน้าแรก) ให้ใส่ if (xxx.length === 0) return;');
    }
  }
  if (!found) console.log("  ถูก  ทุก scrollIntoView มีเงื่อนไขกันไว้แล้ว");
}

// ---------- 3. รายงานเป้ากดที่เล็กกว่าเกณฑ์ (บอกเฉย ๆ ไม่บล็อก) ----------
// ไม่ทำให้ build ไม่ผ่าน เพราะของเดิมที่ใช้งานได้อยู่ไม่ควรถูกบังคับให้รื้อ
// แต่ต้องเห็นตัวเลข จะได้ทยอยแก้ตอนแตะไฟล์นั้นอยู่แล้ว
{
  const hits = [];
  for (const f of files) {
    if (/\/admin\//.test(rel(f))) continue;          // หน้าเจ้าของแพลตฟอร์ม ไม่ใช่หน้าลูกค้า
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/<button|role="(button|radio)"/.test(line)) return;
      const block = lines.slice(i, i + 4).join(" ");
      if (!/\bpy-(1|1\.5)\b/.test(block)) return;
      if (/min-h-\[(3[6-9]|4\d|5\d)px\]|h-1[01]\b/.test(block)) return;
      hits.push(`${rel(f)}:${i + 1}`);
    });
  }
  console.log(`\n== เป้ากดต่ำกว่า 44px ในหน้าลูกค้า (แจ้งเพื่อทราบ ไม่บล็อก) ==`);
  console.log(hits.length ? `  พบ ${hits.length} จุด: ${hits.slice(0, 8).join(" · ")}${hits.length > 8 ? " ..." : ""}`
    : "  ไม่พบ");
}

// ---------- 4. ข้อมูลส่วนบุคคลในไฟล์เอกสารที่ commit (repo เป็น public) ----------
//
// เกิดจริง 30 ก.ค. 2569: ผมเขียนอีเมลลูกค้าจริงลง HANDOFF.md แล้ว push
// ขึ้น repo ที่ visibility = public โดยไม่ได้ตรวจว่า repo เป็น public หรือ private
// อีเมลบวกชื่อกิจการบวกยอดเงิน = ข้อมูลส่วนบุคคลตาม PDPA เผยแพร่สู่สาธารณะ
// ลบออกจากไฟล์ได้ แต่ git history ลบไม่ได้ถ้าไม่ rewrite ทั้ง repo
//
// ด่านนี้จับเฉพาะอีเมลของผู้ให้บริการฟรีที่คนใช้เป็นอีเมลส่วนตัว
// ไม่จับ @sudochatbot.online (อีเมลระบบ) และ example.com (ตัวอย่างในเอกสาร)
console.log("\n== อีเมลส่วนบุคคลในไฟล์เอกสาร (repo เป็น public) ==");
{
  let found = 0;
  const docs = readdirSync(".").filter((f) => /\.md$/i.test(f));
  for (const f of [...docs, ...(() => { try { return readdirSync("docs").map((d) => `docs/${d}`); } catch { return []; } })()]) {
    if (!/\.md$/i.test(f)) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/[A-Za-z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo|live|icloud)\.[a-z.]+/gi)) {
      found++;
      fail(`${f} — มีอีเมลส่วนบุคคล: ${m[0].slice(0, 3)}***@${m[0].split("@")[1]}`);
      console.log("         repo เป็น public ห้ามเขียนอีเมลจริงลงไฟล์ ให้เรียกเป็นบทบาทแทน");
    }
  }
  if (!found) console.log("  ถูก  ไม่มีอีเมลส่วนบุคคลในไฟล์เอกสาร");
}

console.log(failures === 0
  ? "\nสรุปด่าน UI: ผ่านทั้งหมด\n"
  : `\nสรุปด่าน UI: ไม่ผ่าน ${failures} ข้อ — ห้าม deploy จนกว่าจะแก้\n`);
process.exit(failures === 0 ? 0 : 1);
