// ============================================================
//  ตรวจว่าคลังความรู้ภาษี "ค้นเจอจริง" ด้วยคำถามแบบที่ลูกค้าถาม
//
//  ⚠️ ทำไมต้องมี
//  คลังที่มีคำตอบอยู่แต่ค้นไม่เจอ **แย่กว่าคลังว่าง** เพราะผู้ช่วยจะตอบว่า
//  "ไม่มีข้อมูลยืนยัน" แล้วเราจะนึกว่าเนื้อหายังไม่ครบ ไปเติมเนื้อหาเพิ่มเรื่อย ๆ
//  ทั้งที่ปัญหาอยู่ที่ "หาไม่เจอ" ไม่ใช่ "ไม่มี" — อาการนี้ไม่มี error ให้เห็นเลยสักบรรทัด
//
//  วัดจริง 13 ส.ค. 2569 ด้วยคำถาม 6 ข้อชุดนี้:
//    ก่อนมีคอลัมน์ keywords -> ถูก 1 ใน 6
//    หลังมี                 -> ถูก 6 ใน 6 (อันดับ 1 ทุกข้อ)
//
//  ⚠️ คิดคะแนนด้วย RPC tax_kb_match_debug ซึ่งใช้นิพจน์เดียวกับ search_tax_knowledge เป๊ะ
//     ห้ามคำนวณเองฝั่ง node — สูตรเพี้ยนนิดเดียวด่านจะบอกว่าผ่านทั้งที่ระบบจริงค้นไม่เจอ
//
//  ⚠️ ด่านนี้ต้องต่อฐานข้อมูลจึงไม่อยู่ใน `npm run verify` (ซึ่งต้องรันได้โดยไม่มีคีย์)
//     ไม่มีคีย์ = ข้ามพร้อมบอกเหตุผล ห้ามผ่านเงียบ ๆ
//
//  วิธีรัน:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run check:taxkb
// ============================================================
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("\n== คลังความรู้ภาษี: ค้นเจอจริงไหม ==");
if (!URL || !KEY) {
  console.log("  ข้าม  ไม่มี SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  console.log("        ⚠️ แปลว่ายังไม่ได้ตรวจ ไม่ใช่ว่าผ่าน\n");
  process.exit(0);
}

const svc = createClient(URL, KEY, { auth: { persistSession: false } });

/** คำถามแบบที่ลูกค้าพิมพ์จริง คู่กับหัวข้อที่ต้องค้นเจอ */
const CASES = [
  ["เช่าโกดังหักกี่เปอร์เซ็นต์", "อัตราหักภาษี ณ ที่จ่ายที่ใช้บ่อย"],
  ["จ้างฟรีแลนซ์ทำเว็บ ต้องหักภาษีไหม", "อัตราหักภาษี ณ ที่จ่ายที่ใช้บ่อย"],
  ["ซื้อรถกระบะเอาแวทมาหักได้ไหม", "ภาษีซื้อที่นำมาหักไม่ได้"],
  ["ลูกค้าคืนของ ต้องทำยังไง", "ใบลดหนี้และใบเพิ่มหนี้ใช้เมื่อไหร่"],
  ["เลยกำหนดยื่นแล้วโดนอะไรบ้าง", "กำหนดเวลายื่นแบบภาษีรายเดือน"],
  ["ขายของออนไลน์ต้องจดแวทเมื่อไหร่", "อัตราภาษีมูลค่าเพิ่ม (VAT) ปัจจุบัน"],
];

/** ไม่เกี่ยวกับภาษีเลย — ต้อง **ไม่** เจอ ไม่งั้นผู้ช่วยจะเอาความรู้ผิดเรื่องไปตอบ */
const MUST_MISS = ["วันนี้อากาศเป็นยังไง", "แนะนำร้านกาแฟแถวนี้หน่อย"];

/** ต้องตรงกับ p_min_text ใน search_tax_knowledge */
const MIN = 0.30;
/** ผู้ช่วยได้ผลลัพธ์สูงสุด 4 อัน — อยู่ใน 4 อันดับแรกถือว่าใช้ได้ */
const TOP_N = 4;

let failures = 0;
const bad = (m) => { failures++; console.log(`  ผิด  ${m}`); };

const { data: rows, error } = await svc.from("tax_knowledge").select("topic,keywords");
if (error) { console.log(`  ผิด  อ่านคลังไม่ได้: ${error.message}\n`); process.exit(1); }
if (!rows?.length) {
  console.log("  ผิด  คลังว่าง — ผู้ช่วยจะตอบว่าไม่มีข้อมูลยืนยันทุกคำถามกฎหมายภาษี\n");
  process.exit(1);
}
console.log(`  คลังมี ${rows.length} เรื่อง · ตรวจ ${CASES.length} คำถามจริง + ${MUST_MISS.length} คำถามนอกเรื่อง`);

async function rank(q) {
  const { data, error } = await svc.rpc("tax_kb_match_debug", { p_query: q });
  if (error) throw new Error(`tax_kb_match_debug: ${error.message}`);
  return data ?? [];
}

for (const [q, want] of CASES) {
  const ranked = await rank(q);
  const at = ranked.findIndex((r) => r.topic === want);
  const top = ranked[0];
  if (at < 0 || at >= TOP_N || ranked[at].sim < MIN) {
    bad(`"${q}"`);
    console.log(`        ควรเจอ: ${want}`);
    console.log(`        ได้จริง: ${top ? `${top.topic} (${Number(top.sim).toFixed(3)})` : "ไม่มีอะไรเลย"}`);
    console.log("        แก้ด้วยการเติม 'คำที่ผู้ใช้พิมพ์จริง' ให้เรื่องนั้นที่ /dashboard/admin/tax-kb");
  }
}

for (const q of MUST_MISS) {
  const ranked = await rank(q);
  if (ranked[0] && Number(ranked[0].sim) >= MIN) {
    bad(`"${q}" ไม่เกี่ยวกับภาษีแต่ค้นเจอ "${ranked[0].topic}" (${Number(ranked[0].sim).toFixed(3)}) — ผู้ช่วยจะเอาความรู้ผิดเรื่องไปตอบ`);
  }
}

const noKw = rows.filter((r) => !(r.keywords ?? "").trim());
if (noKw.length) {
  bad(`${noKw.length} เรื่องไม่มีคำที่ผู้ใช้พิมพ์จริง — ผู้ใช้ที่ถามด้วยคำของตัวเองจะหาไม่เจอ:`);
  for (const r of noKw) console.log(`        · ${r.topic}`);
}

console.log(failures === 0
  ? "  ถูก  ค้นเจอครบทุกคำถาม และไม่เจอคำถามนอกเรื่อง\n"
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ — ผู้ช่วยจะตอบว่า "ไม่มีข้อมูลยืนยัน" ทั้งที่คลังมีคำตอบอยู่\n`);
process.exit(failures === 0 ? 0 : 1);
