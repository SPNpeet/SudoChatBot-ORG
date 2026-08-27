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
      // ⚠️ ด่านนี้เคยมองไม่เห็นของจริง (วัดบนมือถือ 6 ส.ค. 2569 เจอ 8 จุดที่ด่านบอก "ไม่พบ")
      // สาเหตุ: มองหาแต่ <button> ที่มี py-1/py-1.5 — แต่ตัวที่แย่ที่สุดคือ <summary>
      // ของ FAQ ซึ่งไม่มีคลาส padding เลย ความสูงจึงเท่าบรรทัดข้อความ = 20px
      // บทเรียน: "ไม่ประกาศความสูงไว้เลย" อันตรายกว่า "ประกาศไว้ว่าเตี้ย"
      if (!/<button|<summary|role="(button|radio)"/.test(line)) return;
      const block = lines.slice(i, i + 4).join(" ");
      // ผ่านถ้าประกาศความสูงถึงเกณฑ์ไว้ชัดเจนแล้ว
      if (/min-h-\[(4[4-9]|[5-9]\d)px\]|\bh-(1[1-9]|[2-9]\d)\b/.test(block)) return;
      // <summary> ต้องประกาศความสูงเสมอ · <button> ยังใช้เกณฑ์เดิม (มี py เตี้ย ๆ)
      if (!/<summary/.test(line) && !/\bpy-(1|1\.5)\b/.test(block)) return;
      hits.push(`${rel(f)}:${i + 1}`);
    });

    // ⚠️ กฎเพิ่ม (6 ส.ค. 2569): "ประกาศความสูงไว้ต่ำกว่าเกณฑ์" ก็ผิดเหมือนกัน
    // ด่านเดิมมองหาแต่ py เตี้ย ๆ เลยมองข้าม min-h-[36px] / min-h-[40px] / min-h-[30px]
    // ซึ่งใช้อยู่จริง 12 จุดทั่วระบบ รวมถึงหน้าสมัครสมาชิกและหน้าเข้าสู่ระบบ
    // (วัดบนมือถือจริงแล้วเจอ ทั้งที่ด่านรายงานว่า "ไม่พบ")
    lines.forEach((line, i) => {
      const m = line.match(/min-h-\[(\d+)px\]/);
      if (!m || Number(m[1]) >= 44) return;
      const around = lines.slice(Math.max(0, i - 3), i + 2).join(" ");
      if (!/<button|<summary|<Link|<a |role="(button|radio)"/.test(around)) return;
      hits.push(`${rel(f)}:${i + 1}`);
    });
  }
  console.log(`\n== เป้ากดต่ำกว่า 44px ในหน้าลูกค้า (แจ้งเพื่อทราบ ไม่บล็อก) ==`);
  console.log(hits.length ? `  พบ ${hits.length} จุด: ${hits.slice(0, 8).join(" · ")}${hits.length > 8 ? " ..." : ""}`
    : "  ไม่พบ");
}

// ---------- 3.5 ตัวอักษร: ความหนาที่ฟอนต์ไม่มีจริง + ขนาดนอกสเกล ----------
//
// ⚠️ เกิดจริง 6 ส.ค. 2569: เจ้าของบอกว่า "ฟอนต์ไม่สวย มั่วจัด"
// วัดในเบราว์เซอร์แล้วเจอสองอย่างที่อ่านจากโค้ดเฉย ๆ ไม่มีทางเห็น:
//  1. พาดหัวใหญ่สุดของเว็บใช้ font-extrabold (800) แต่ IBM Plex Sans Thai
//     โหลดมาแค่ 400/500/600/700 -> เบราว์เซอร์ "ปลอมตัวหนา" ให้ ขอบตัวอักษรเยิน
//     เป็นความต่างที่คนทั่วไปบอกไม่ถูกว่าอะไรผิด รู้แค่ว่า "ดูถูก ๆ"
//  2. ทั้งหน้าใช้ขนาดตัวอักษร 9 ขนาด (มี 10px กับ 11px ปนอยู่ด้วย)
//     ขนาดที่ไม่ได้อยู่ในสเกลไม่ได้ทำให้ข้อมูลชัดขึ้น แค่ทำให้หน้าดูไม่ได้ตั้งใจทำ
//
// สเกลที่ตกลงกัน: 12 · 13 · 14 · 16 · 24 · 34/40 (ต่ำกว่า 12px ห้ามใช้ในหน้าลูกค้า)
console.log("\n== ตัวอักษร: ความหนาที่ฟอนต์ไม่มี + ขนาดนอกสเกล ==");
{
  const weightHits = [];
  const sizeHits = [];
  for (const f of files) {
    if (/\/admin\//.test(rel(f))) continue;
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      // ข้ามบรรทัดคอมเมนต์ — คำอธิบายว่า "ห้ามใช้ font-extrabold" ไม่ใช่การใช้มันจริง
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/font-(extrabold|black)|font-\[(800|900)\]/.test(line)) weightHits.push(`${rel(f)}:${i + 1}`);
      if (/text-\[1[01]px\]/.test(line)) sizeHits.push(`${rel(f)}:${i + 1}`);
    });
  }
  if (weightHits.length) {
    failures++;
    console.log(`  ผิด  ความหนาเกิน 700 ที่ฟอนต์ไม่มีจริง ${weightHits.length} จุด: ${weightHits.slice(0, 5).join(" · ")}`);
    console.log("        เบราว์เซอร์จะปลอมตัวหนาให้ ตัวอักษรจะเยิน — ใช้ font-bold (700) แทน");
  } else {
    console.log("  ถูก  ไม่มีความหนาที่เกินกว่าฟอนต์มีจริง");
  }
  if (sizeHits.length) {
    console.log(`  แจ้ง  ตัวอักษรต่ำกว่า 12px ในหน้าลูกค้า ${sizeHits.length} จุด: ${sizeHits.slice(0, 5).join(" · ")}`);
  } else {
    console.log("  ถูก  ไม่มีตัวอักษรต่ำกว่า 12px ในหน้าลูกค้า");
  }
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

// ---------- 5. คลาสตระกูลเดียวกัน + breakpoint เดียวกัน ซ้ำในสตริงเดียว ----------
//
// เกิดจริง 31 ก.ค. 2569: แถวรายการสินค้าในฟอร์มเอกสารเขียนไว้ว่า
//   grid-cols-[...4 ช่อง] sm:grid-cols-[...4 ช่อง] items-center gap-2 sm:grid-cols-[...5 ช่อง]
// มี sm:grid-cols- สองอันในคลาสเดียว CSS ตัดสินจากลำดับในไฟล์สไตล์ ไม่ใช่ลำดับที่เขียน
// ผลคือบางจอได้กริด 4 ช่องทั้งที่มีลูก 5 ตัว ปุ่มลบตกบรรทัดและช่องกรอกเบียดจนล้นกรอบ
// เจ้าของเจอเองว่า "ช่องกรอกมั่ว เตลิดกรอบไปไกล" — build/typecheck/lint ไม่มีใครฟ้อง
//
// ตระกูลเดียวกับเคส Logo (ข้อ 1) ต่างกันที่อันนั้นมาจากการต่อ prop
// อันนี้เขียนซ้ำในสตริงเดียวไปเลย จึงต้องมีด่านแยก
//
// ⚠️ ตรวจเฉพาะสตริงตรง ๆ ไม่ตรวจใน cn() เพราะ twMerge จัดการให้อยู่แล้ว
// และตรวจเฉพาะตระกูลที่ "ซ้ำแล้วพังจริง" (โครงเลย์เอาต์) ไม่ตรวจ padding/สี ที่ซ้ำได้ตามปกติ
console.log("\n== คลาสจัดเลย์เอาต์ซ้ำตัวเองในสตริงเดียว ==");
{
  const FAMILY = /^((?:sm|md|lg|xl|2xl):)?(grid-cols|flex-col|flex-row|hidden|inline-flex|justify|items|absolute|fixed|relative|sticky|col-span|order)(-|$)/;
  let found = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/className="([^"]{10,})"/g)) {
      const seen = new Map();
      for (const t of m[1].split(/\s+/)) {
        const g = t.match(FAMILY);
        if (!g) continue;
        const key = (g[1] || "") + g[2];
        const prev = seen.get(key);
        if (!prev) { seen.set(key, [t]); continue; }
        if (!prev.includes(t)) prev.push(t);
      }
      for (const [key, list] of seen) {
        if (list.length < 2) continue;
        found++;
        const line = src.slice(0, m.index).split("\n").length;
        fail(`${rel(f)}:${line} — "${key}" ถูกกำหนดซ้ำ: ${list.join("  กับ  ")}`);
        console.log("         CSS เลือกจากลำดับในไฟล์สไตล์ ไม่ใช่ลำดับที่เขียน = ผลลัพธ์เดาไม่ได้");
        console.log("         ให้เหลือชุดเดียว หรือใช้ cn() ให้ twMerge ตัดตัวที่ทับกันออก");
      }
    }
  }
  if (!found) console.log("  ถูก  ไม่มีคลาสจัดเลย์เอาต์ที่ซ้ำตัวเองในสตริงเดียว");
}

// ============================================================
//  ช่องตารางทุกช่องต้องมีชื่อฟิลด์กำกับ เว้นช่องที่ CSS ซ่อนป้ายอยู่แล้ว
//
//  ⚠️ ทำไมต้องมี (28 ส.ค. 2569)
//  มือถือแสดงตารางเป็นการ์ดใบละแถว (.rtable ใน globals.css) และชื่อฟิลด์
//  มาจาก data-label ของ <Td label="..."> ช่องที่ไม่มี label จะกลายเป็นค่าลอย ๆ
//  ไม่มีอะไรบอกว่าคืออะไร ซึ่งเจ้าของแจ้งมาเองว่าอ่านไม่รู้เรื่อง
//
//  ช่องที่ไม่ต้องมีมีสามแบบเท่านั้น และเป็นเหตุผลทางการแสดงผลจริง:
//    1. ช่องแรกของแถว — CSS ใช้เป็นหัวการ์ดและซ่อนป้ายอยู่แล้ว
//    2. ช่องที่มี colSpan — แถวรวมหรือแถวข้อความ ไม่ใช่ช่องข้อมูล
//    3. ช่องว่างที่ปิดตัวเอง — td:empty ซ่อนให้อยู่แล้ว
//  นอกจากสามแบบนี้ถือว่าลืมใส่ ห้ามปล่อยผ่าน
// ============================================================
{
  console.log("\n== ช่องตารางที่ไม่มีชื่อฟิลด์กำกับบนมือถือ ==");
  let missing = 0, exempt = 0, labelled = 0;
  for (const f of files) {
    if (!f.endsWith(".tsx")) continue;
    const src = readFileSync(f, "utf8");
    if (!src.includes("<Td")) continue;
    for (const rowMatch of src.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...rowMatch[1].matchAll(/<Td\b([^>]*)>/g)];
      cells.forEach((c, i) => {
        const attrs = c[1];
        if (/\blabel=/.test(attrs)) { labelled++; return; }
        if (i === 0 || /\bcolSpan=/.test(attrs) || attrs.trim().endsWith("/")) { exempt++; return; }
        missing++;
        const line = src.slice(0, rowMatch.index + c.index).split("\n").length;
        fail(rel(f) + ":" + line + " — <Td> ที่ไม่ใช่ช่องแรกของแถวแต่ไม่มี label — บนมือถือจะเป็นค่าลอย ๆ");
      });
    }
  }
  if (!missing) console.log("  ถูก  ช่องข้อมูลมีชื่อฟิลด์ครบ " + labelled + " ช่อง · ยกเว้นโดยตั้งใจ " + exempt + " ช่อง (หัวการ์ด/colSpan/ช่องว่าง)");
}

console.log(failures === 0
  ? "\nสรุปด่าน UI: ผ่านทั้งหมด\n"
  : `\nสรุปด่าน UI: ไม่ผ่าน ${failures} ข้อ — ห้าม deploy จนกว่าจะแก้\n`);
process.exit(failures === 0 ? 0 : 1);
