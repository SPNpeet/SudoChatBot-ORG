// ============================================================
//  รัน tool ของผู้ช่วย AI กับ "ข้อมูลจริง" แบบอ่านอย่างเดียว แล้วตามไปกดลิงก์ที่มันส่งให้
//
//  ⚠️ ทำไมต้องมี (8 ส.ค. 2569)
//  ชุดทดสอบเดิม (assistant-dryrun) วัดได้แค่ว่า "โมเดลเลือก tool ถูกไหม"
//  ไม่ได้พิสูจน์เลยว่า tool นั้นทำงานได้จริง และลิงก์ที่มันส่งกลับไปกดแล้วเปิดได้จริง
//  ซึ่งเป็นคนละเรื่องกันโดยสิ้นเชิง — เลือกถูกแต่คืนลิงก์เสียก็ไม่มีประโยชน์
//  (เกิดจริงวันนี้: get_doc_links คืน print_link ผิดเส้นทาง กดแล้วจะเจอ 404)
//
//  ⚠️ กติกาเหล็กของไฟล์นี้: **เรียกได้เฉพาะ tool ฝั่งอ่าน**
//  tool ฝั่งเขียนจะไปสร้าง/แก้เอกสารในบัญชีลูกค้าจริง ห้ามเด็ดขาด
//  รายชื่อ tool ที่อนุญาตถูกล็อกไว้ข้างล่าง และมีการตรวจซ้ำก่อนเรียกทุกครั้ง
//
//  วิธีใช้:  npm run e2e:assistant
// ============================================================
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { executeTool } from "../src/app/dashboard/assistant/engine.ts";

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

/** tool ที่อ่านอย่างเดียว — นอกรายการนี้ห้ามเรียกจากสคริปต์นี้ */
const READ_ONLY = new Set([
  "get_overview", "list_docs", "get_doc", "get_doc_links", "get_aging",
  "get_tax_summary", "search_contacts", "search_products", "get_expense_categories",
  "get_billing_status", "get_report_files",
]);

let failures = 0;
const bad = (m) => { failures++; console.log(`  ผิด  ${m}`); };
const ok = (m) => console.log(`  ถูก  ${m}`);

async function call(ctx, name, input = {}) {
  if (!READ_ONLY.has(name)) throw new Error(`สคริปต์นี้ห้ามเรียก tool ฝั่งเขียน: ${name}`);
  return JSON.parse(await executeTool(ctx, name, input));
}

console.log("\n== ผู้ช่วย AI กับข้อมูลจริง (อ่านอย่างเดียว) ==");

// เลือกกิจการที่มีเอกสารขายจริงอยู่แล้ว — ไม่สร้างอะไรใหม่
const { data: doc } = await svc.from("fin_docs")
  .select("id,shop_id,doc_number,doc_type,share_key")
  .in("doc_type", ["invoice", "receipt"]).not("share_key", "is", null)
  .neq("status", "void").order("created_at", { ascending: false }).limit(1).maybeSingle();

if (!doc) {
  console.log("  ข้าม  ยังไม่มีเอกสารขายในระบบให้ทดสอบ\n");
  process.exit(0);
}

const { data: shop } = await svc.from("shops").select("id,name").eq("id", doc.shop_id).single();
const { data: member } = await svc.from("shop_members")
  .select("user_id,role").eq("shop_id", shop.id).eq("role", "owner").limit(1).maybeSingle();

const ctx = {
  svc, shopId: shop.id, shopName: shop.name, role: member?.role ?? "owner",
  userId: member?.user_id ?? "00000000-0000-0000-0000-000000000000", history: [],
};

// ---- 1. ภาพรวม + ยอดค้าง + สรุปภาษี ต้องคืนตัวเลขได้จริง ----
for (const name of ["get_overview", "get_aging", "get_tax_summary"]) {
  const r = await call(ctx, name);
  if (r?.error) bad(`${name} คืน error: ${r.error}`);
  else ok(`${name} ทำงานได้ (${Object.keys(r).length} ช่องข้อมูล)`);
}

// ---- 2. ลิงก์เอกสารทุกแบบ แล้วตามไปกดจริง ----
const links = await call(ctx, "get_doc_links", { doc_number: doc.doc_number });
if (links?.error) {
  bad(`get_doc_links คืน error: ${links.error}`);
} else {
  ok(`get_doc_links คืนลิงก์ของ ${links.doc_number}`);

  // ลิงก์ส่งลูกค้าเป็นลิงก์สาธารณะ — ต้องเปิดได้โดยไม่ต้องล็อกอิน
  // นี่คือสิ่งเดียวในชุดนี้ที่ลูกค้าปลายทางเป็นคนกด จึงต้องพิสูจน์ด้วยการกดจริง
  if (links.share_link) {
    const res = await fetch(`${BASE}${links.share_link}`);
    const html = await res.text();
    if (res.status !== 200) bad(`ลิงก์ส่งลูกค้า ${links.share_link} ตอบ ${res.status}`);
    else if (!html.includes(doc.doc_number)) bad(`ลิงก์ส่งลูกค้าเปิดได้แต่ไม่มีเลขเอกสาร ${doc.doc_number} ในหน้า`);
    else ok(`ลิงก์ส่งลูกค้าเปิดได้จริงโดยไม่ต้องล็อกอิน และมีเลข ${doc.doc_number} ในหน้า`);
  } else {
    bad("เอกสารขายควรมีลิงก์ส่งลูกค้า แต่ไม่มี");
  }

  // หน้าในระบบต้องกันคนนอก — เปิดโดยไม่ล็อกอินต้องไม่เห็นข้อมูล
  for (const [label, href] of [["เปิดในระบบ", links.view_link], ["พิมพ์/PDF", links.print_link]]) {
    if (!href) { bad(`ไม่มีลิงก์ ${label}`); continue; }
    const res = await fetch(`${BASE}${href}`, { redirect: "manual" });
    if (res.status === 200) bad(`${label} (${href}) เปิดได้ทั้งที่ไม่ได้ล็อกอิน — ข้อมูลรั่ว`);
    else if (res.status === 404) bad(`${label} (${href}) ไม่มีหน้านี้อยู่จริง`);
    else ok(`${label} กันคนไม่ล็อกอินแล้ว (${res.status})`);
  }
}

// ---- 3. ไฟล์รายงานที่ผู้ช่วยส่งให้ ----
const rep = await call(ctx, "get_report_files", {});
if (rep?.error) bad(`get_report_files คืน error: ${rep.error}`);
else {
  ok(`get_report_files คืนลิงก์งวด ${rep.period}`);
  const res = await fetch(`${BASE}${rep.accountant_xlsx}`, { redirect: "manual" });
  if (res.status === 200) bad(`ไฟล์ Excel ส่งนักบัญชีโหลดได้ทั้งที่ไม่ได้ล็อกอิน — ข้อมูลรั่ว`);
  else if (res.status === 404) bad(`ไฟล์ Excel ส่งนักบัญชี: ไม่มี endpoint นี้อยู่จริง`);
  else ok(`ไฟล์ Excel ส่งนักบัญชีกันคนไม่ล็อกอินแล้ว (${res.status})`);
}

// ---- 4. เปิดเอกสารเต็มใบ ----
const full = await call(ctx, "get_doc", { doc_number: doc.doc_number });
if (full?.error) bad(`get_doc คืน error: ${full.error}`);
else if (!full.doc_number) bad("get_doc ไม่คืนเลขเอกสาร");
else ok(`get_doc เปิด ${full.doc_number} ได้ (ยอด ${full.total})`);

console.log(failures === 0
  ? "\n  ผ่านทุกข้อ — ไม่มีการเขียนข้อมูลใด ๆ ในระบบ\n"
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ\n`);
process.exit(failures === 0 ? 0 : 1);
