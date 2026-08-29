// ============================================================
//  ด่านตรวจ: ข้อความตอบของผู้ช่วย AI ต้องไม่มี markdown ดิบ และต้องไม่มีลิงก์นอกระบบ
//
//  ⚠️ ทำไมต้องมีด่านนี้ (29 ส.ค. 2569)
//  บั๊กจริงที่ลูกค้าเจอ: ผู้ช่วยตอบมาว่า
//    [ลิงก์ส่งลูกค้า](https://example.com/doc/xxxx)
//  คือส่งลิงก์ที่ไม่ใช่โดเมนเราให้ผู้ใช้เอาไปส่งต่อลูกค้าอีกที ซึ่งอันตรายกว่าไม่มีลิงก์
//  พร้อมกับ **ดาวคู่** ที่โผล่เป็นตัวอักษรดิบเพราะหน้าแชทวาด plain text
//
//  prompt สั่งห้าม markdown อยู่แล้วแต่โมเดลยังทำ (กติกาข้อ 3: ต้องบังคับที่โค้ด)
//  ด่านนี้เรียกฟังก์ชันตัวเดียวกับที่ผู้ใช้เจอจริง ไม่ได้เขียนกฎซ้ำอีกชุด
// ============================================================
import { sanitizeAssistantText, internalPath } from "../src/lib/assistant-text.ts";

let bad = 0;
const ok = (cond, name, extra = "") => {
  if (cond) console.log(`  ถูก  ${name}`);
  else { bad++; console.log(`  ผิด  ${name}${extra ? ` — ${extra}` : ""}`); }
};

console.log("\n== ข้อความตอบของผู้ช่วย AI ==");

// 1. เคสจริงที่เจ้าของแคปมา — โดเมนปลอมต้องถูกตัดเหลือ path ในระบบเรา
{
  const raw = "**ใบเสร็จรับเงินเลขที่ RC-2026-0004 ยอด 8,000 บาท** ออกให้เรียบร้อยแล้วครับ\n"
    + "[ลิงก์ส่งลูกค้า](https://example.com/doc/3b4b6603-9947-4567-a38b-758b0f5980aa)\n"
    + "[พิมพ์/บันทึกเป็น PDF](https://example.com/dashboard/print/05240504-5992-425f-8874-0a1112e8f0c1)";
  const { text, artifacts } = sanitizeAssistantText(raw);
  ok(!text.includes("example.com"), "โดเมนปลอมไม่หลุดไปถึงผู้ใช้", text.slice(0, 60));
  ok(!/\[.+\]\(.+\)/.test(text), "ไม่เหลือ markdown link ดิบในข้อความ", text.slice(0, 60));
  ok(!text.includes("**"), "ไม่เหลือดาวคู่ของตัวหนา", text.slice(0, 60));
  ok(text.includes("RC-2026-0004"), "เนื้อความสำคัญยังอยู่ครบ");
  ok(artifacts.length === 2, `ลิงก์ถูกยกไปเป็นปุ่ม 2 ปุ่ม (ได้ ${artifacts.length})`);
  ok(artifacts.every((a) => a.href.startsWith("/")), "ปุ่มทุกอันชี้ path ในระบบเรา",
    artifacts.map((a) => a.href).join(" "));
  ok(artifacts[0]?.href === "/doc/3b4b6603-9947-4567-a38b-758b0f5980aa",
    "path ของลิงก์ส่งลูกค้าถูกต้อง", artifacts[0]?.href);
}

// 2. ลิงก์ที่พาออกนอกระบบต้องไม่กลายเป็นปุ่ม — เหลือแค่ข้อความ
{
  const { text, artifacts } = sanitizeAssistantText("ดูเพิ่มที่ [เว็บอื่น](mailto:someone@example.com) ได้");
  ok(artifacts.length === 0, "ลิงก์ที่ไม่ใช่ http(s)/path ไม่ถูกทำเป็นปุ่ม");
  ok(text.includes("เว็บอื่น") && !text.includes("mailto:"), "เหลือแค่ข้อความ ไม่มี mailto ติดมา", text);
}
ok(internalPath("//evil.example/x") === null, "ลิงก์แบบ // (protocol-relative) ถูกปฏิเสธ");
ok(internalPath("/dashboard/sales") === "/dashboard/sales", "path ในระบบผ่านตามปกติ");

// 3. ห้ามยกปุ่มซ้ำกับที่มีอยู่แล้ว และห้ามเกินเพดาน
{
  const existing = [{ label: "เปิด RC-0001", href: "/doc/abc" }];
  const { artifacts } = sanitizeAssistantText("[ลิงก์](https://x.test/doc/abc) และ [อีกอัน](/doc/def)", existing);
  ok(artifacts.length === 1 && artifacts[0].href === "/doc/def",
    "ลิงก์ที่ซ้ำกับปุ่มเดิมไม่ถูกเพิ่มซ้ำ", JSON.stringify(artifacts));
}

// 4. ข้อความปกติต้องไม่ถูกแตะ — ด่านที่แก้ของดีให้พังคือด่านที่แย่กว่าไม่มี
{
  const plain = "ออกใบแจ้งหนี้ INV-2026-0012 ยอด 15,000.00 บาท ให้แล้วครับ";
  const { text, artifacts } = sanitizeAssistantText(plain);
  ok(text === plain, "ข้อความธรรมดาไม่ถูกเปลี่ยน", text);
  ok(artifacts.length === 0, "ข้อความธรรมดาไม่มีปุ่มงอก");
}

// 5. ตัวเลขเงินที่มีดาวคั่นห้ามโดนกลืน (เคสที่ regex ตัวหนาพลาดได้)
{
  const { text } = sanitizeAssistantText("ยอด 1,500 * 2 = 3,000 บาท");
  ok(text.includes("1,500 * 2"), "เครื่องหมายคูณเดี่ยว ๆ ไม่ถูกตีเป็น markdown", text);
}

console.log(bad === 0 ? "\nสรุป: ผ่านทั้งหมด" : `\nสรุป: ผิด ${bad} ข้อ`);
process.exit(bad === 0 ? 0 : 1);
