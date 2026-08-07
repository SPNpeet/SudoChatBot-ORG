// ============================================================
//  ตรวจ SEO ของหน้าสาธารณะทุกหน้า — ยิงของจริงแล้วอ่าน HTML ที่ Google จะเห็น
//
//  ⚠️ ทำไมต้องมี (8 ส.ค. 2569)
//  ตรวจครั้งแรกเจอของที่ทำให้หน้าหายจาก Google ได้เลย และมองด้วยตาไม่เห็น:
//   · canonical ถูกตั้งไว้ที่ layout จึงสืบทอดไปทุกหน้า —
//     /privacy และ /login ประกาศว่าตัวเองคือ "สำเนาของหน้าแรก"
//   · /login /signup ใช้ title + description ของหน้าแรกทั้งดุ้น = สามหน้าซ้ำกันเป๊ะ
//   · sitemap มี /login (หน้าที่ไม่ควรถูกเก็บ) แต่ไม่มี /try
//     ซึ่งเป็นหน้าที่มีคุณค่าทาง SEO สูงสุด (ใช้ฟรีไม่ต้องสมัคร)
//
//  ของพวกนี้ build ผ่าน typecheck ผ่าน หน้าเว็บดูปกติทุกอย่าง
//  แต่ผลคือหน้าไม่ขึ้นใน Google ซึ่งกว่าจะรู้ก็หลายเดือน
//
//  วิธีใช้:  npm run check:seo            (ตรวจ production)
//            CHECK_BASE_URL=http://localhost:3000 npm run check:seo
// ============================================================
const BASE = process.env.CHECK_BASE_URL || "https://sudochatbot.online";

/** หน้าสาธารณะทั้งหมด + สิ่งที่แต่ละหน้าต้องมี */
const PAGES = [
  { path: "/", index: true },
  { path: "/try", index: true },
  { path: "/signup", index: true },
  { path: "/login", index: false },       // หน้าล็อกอินไม่มีเนื้อหาให้ค้นหา
  { path: "/privacy", index: true },
  { path: "/terms", index: true },
  { path: "/data-deletion", index: true },
];

let failures = 0;
const bad = (m) => { failures++; console.log(`  ผิด  ${m}`); };

const pick = (html, re) => (html.match(re)?.[1] ?? "").trim();

console.log(`\n== SEO หน้าสาธารณะ (${BASE}) ==`);

const seenTitle = new Map();
const seenDesc = new Map();

for (const p of PAGES) {
  const res = await fetch(`${BASE}${p.path}`);
  if (!res.ok) { bad(`${p.path} ตอบ ${res.status}`); continue; }
  const html = await res.text();

  const title = pick(html, /<title>([^<]*)<\/title>/);
  const desc = pick(html, /<meta name="description" content="([^"]*)"/);
  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
  const robots = pick(html, /<meta name="robots" content="([^"]*)"/);
  const lang = pick(html, /<html lang="([^"]*)"/);
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;

  const problems = [];

  // --- ชื่อหน้า ---
  if (!title) problems.push("ไม่มี <title>");
  else if (title.length > 65) problems.push(`title ยาว ${title.length} ตัว (Google ตัดที่ราว 60)`);
  else if (title.length < 15) problems.push(`title สั้นเกินไป (${title.length} ตัว)`);

  // --- คำอธิบาย ---
  if (!desc) problems.push("ไม่มี meta description");
  else if (desc.length > 175) problems.push(`description ยาว ${desc.length} ตัว (Google ตัดที่ราว 160)`);
  else if (desc.length < 50) problems.push(`description สั้นเกินไป (${desc.length} ตัว)`);

  // --- canonical ต้องชี้ตัวเอง ห้ามชี้หน้าอื่น ---
  const want = `${BASE}${p.path === "/" ? "" : p.path}`;
  if (!canonical) problems.push("ไม่มี canonical");
  else if (canonical.replace(/\/$/, "") !== want.replace(/\/$/, "")) {
    problems.push(`canonical ชี้ผิดไปที่ ${canonical} (ควรเป็น ${want}) — Google จะถือว่าหน้านี้เป็นสำเนา`);
  }

  // --- ให้เก็บเข้าดัชนีหรือไม่ ---
  const noindex = /noindex/i.test(robots);
  if (p.index && noindex) problems.push("ถูกสั่ง noindex ทั้งที่ควรถูกเก็บเข้าดัชนี");
  if (!p.index && !noindex) problems.push("ควรเป็น noindex (หน้าไม่มีเนื้อหาให้ค้นหา) แต่ไม่ได้สั่งไว้");

  // --- โครงหน้า ---
  if (lang !== "th") problems.push(`<html lang> เป็น "${lang}" ควรเป็น th`);
  if (h1Count === 0) problems.push("ไม่มี <h1> เลย");
  if (h1Count > 1) problems.push(`มี <h1> ${h1Count} ตัว (ควรมีตัวเดียว)`);

  // --- แชร์ลิงก์แล้วต้องมีการ์ดพรีวิว ---
  if (!/property="og:title"/.test(html)) problems.push("ไม่มี og:title (แชร์ลิงก์แล้วไม่มีการ์ดพรีวิว)");
  if (!/property="og:image"/.test(html)) problems.push("ไม่มี og:image");

  // --- ห้ามซ้ำกันข้ามหน้า ---
  if (title) {
    if (seenTitle.has(title)) problems.push(`title ซ้ำกับ ${seenTitle.get(title)}`);
    else seenTitle.set(title, p.path);
  }
  if (desc) {
    if (seenDesc.has(desc)) problems.push(`description ซ้ำกับ ${seenDesc.get(desc)}`);
    else seenDesc.set(desc, p.path);
  }

  if (problems.length) problems.forEach((m) => bad(`${p.path} — ${m}`));
  else console.log(`  ถูก  ${p.path}`);
}

// --- sitemap กับ robots ต้องสอดคล้องกับที่ตั้งไว้จริง ---
const sm = await fetch(`${BASE}/sitemap.xml`);
if (!sm.ok) bad(`/sitemap.xml ตอบ ${sm.status}`);
else {
  const xml = await sm.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, ""));
  for (const p of PAGES) {
    const u = `${BASE}${p.path === "/" ? "" : p.path}`.replace(/\/$/, "");
    const listed = urls.includes(u);
    if (p.index && !listed) bad(`sitemap ขาด ${p.path} ทั้งที่เป็นหน้าที่ควรถูกเก็บเข้าดัชนี`);
    if (!p.index && listed) bad(`sitemap มี ${p.path} ทั้งที่หน้านั้นถูกสั่ง noindex — ขัดกันเอง`);
  }
  console.log(`  ถูก  sitemap.xml มี ${urls.length} หน้า`);
}

const rb = await fetch(`${BASE}/robots.txt`);
if (!rb.ok) bad(`/robots.txt ตอบ ${rb.status}`);
else {
  const txt = await rb.text();
  if (!/Sitemap:/i.test(txt)) bad("robots.txt ไม่ได้บอกที่อยู่ sitemap");
  if (!/Disallow: \/dashboard/i.test(txt)) bad("robots.txt ไม่ได้กัน /dashboard");
  else console.log("  ถูก  robots.txt");
}

// --- ข้อมูลโครงสร้าง (rich result) ---
const home = await (await fetch(`${BASE}/`)).text();
const types = [...home.matchAll(/"@type":\s*"([^"]+)"/g)].map((m) => m[1]);
for (const t of ["Organization", "SoftwareApplication", "FAQPage"]) {
  if (!types.includes(t)) bad(`หน้าแรกไม่มีข้อมูลโครงสร้าง ${t}`);
}
if (types.includes("FAQPage")) {
  const qCount = (home.match(/"@type":\s*"Question"/g) ?? []).length;
  if (qCount < 3) bad(`FAQPage มีคำถามแค่ ${qCount} ข้อ — น้อยเกินกว่าจะได้ rich result`);
  else console.log(`  ถูก  ข้อมูลโครงสร้างครบ (FAQ ${qCount} ข้อ)`);
}

// --- URL ที่ไม่มีอยู่จริงต้องตอบ 404 ไม่ใช่ 200 ---
// soft 404 (ตอบ 200 ทั้งที่ไม่มีหน้า) ทำให้ Google เก็บ URL ขยะเข้าดัชนี
for (const junk of ["/no-such-page", "/abc/def"]) {
  const r = await fetch(`${BASE}${junk}`);
  if (r.status !== 404) bad(`${junk} ตอบ ${r.status} ควรเป็น 404 (soft 404 ทำให้ Google เก็บ URL ขยะ)`);
}

// --- เว็บเดียวต้องอยู่โดเมนเดียว ---
// www กับไม่มี www เสิร์ฟเนื้อหาเดียวกันทั้งคู่ = แบ่งน้ำหนักลิงก์ออกเป็นสองกอง
if (BASE.startsWith("https://") && !BASE.includes("localhost")) {
  const wwwUrl = BASE.replace("https://", "https://www.");
  const r = await fetch(`${wwwUrl}/`, { redirect: "manual" });
  if (r.status === 200) bad(`${wwwUrl} ตอบ 200 — ควรส่ง 301/308 กลับมาที่ ${BASE}`);
  else if ([301, 308].includes(r.status)) console.log(`  ถูก  www ส่งกลับโดเมนหลัก (${r.status})`);
}

// --- หัวข้อความปลอดภัยที่ทุกหน้าต้องมี ---
// ไม่ใช่เรื่อง SEO ตรง ๆ แต่ตรวจที่เดียวกันได้เพราะอ่านจาก response เดียวกัน
// และเป็นของที่หายไปเงียบ ๆ ได้ทุกครั้งที่แก้ next.config
{
  const res = await fetch(`${BASE}/`);
  const need = {
    "strict-transport-security": "บังคับ https",
    "x-content-type-options": "กันเบราว์เซอร์เดาชนิดไฟล์ (ไฟล์ที่ลูกค้าอัปโหลด)",
    "x-frame-options": "กันเอาหน้าเราไปฝัง iframe แล้ววางปุ่มปลอมทับ",
    "referrer-policy": "กันลิงก์เอกสารลับหลุดไปเว็บอื่นผ่าน referrer",
  };
  for (const [h, why] of Object.entries(need)) {
    if (!res.headers.get(h)) bad(`ไม่มี header ${h} — ${why}`);
  }
  if (Object.keys(need).every((h) => res.headers.get(h))) console.log("  ถูก  security headers ครบ");
}

console.log(failures === 0
  ? "\n  ผ่านทุกข้อ\n"
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ\n`);
process.exit(failures === 0 ? 0 : 1);
