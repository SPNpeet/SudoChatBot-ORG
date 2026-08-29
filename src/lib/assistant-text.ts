// ============================================================
//  ทำความสะอาดข้อความตอบของผู้ช่วย AI ก่อนถึงตาผู้ใช้
//
//  ⚠️ เกิดจริงบน production (เจ้าของแคปมา 29 ส.ค. 2569)
//  ผู้ใช้ขอ PDF แล้วได้ข้อความหน้าตาแบบนี้ในแชท:
//    **ใบเสร็จรับเงินเลขที่ RC-2026-0004 ยอด 8,000 บาท** ออกให้เรียบร้อยแล้วครับ
//    [ลิงก์ส่งลูกค้า](https://example.com/doc/3b4b6603-...)
//  พังสองชั้นพร้อมกัน:
//    1. หน้าแชทวาดข้อความเป็น plain text (whitespace-pre-wrap) ไม่ได้แปลง markdown
//       ดาวคู่กับวงเล็บเหลี่ยมจึงโผล่เป็นตัวอักษรดิบ อ่านแล้วเหมือนระบบเสีย
//    2. tool คืนลิงก์เป็น path สั้น (/doc/xxx) โมเดลเลยเติมโดเมนเอาเองเป็น example.com
//       ลูกค้ากดแล้วออกไปเว็บที่ไม่ใช่ของเรา — แย่กว่าไม่มีลิงก์เลย
//
//  กติกาโปรเจกต์ข้อ 3: ห้ามแก้ด้วยการเขียน prompt ขอให้โมเดลเลิกทำ
//  (prompt ข้อ 8 สั่งห้าม markdown อยู่แล้ว แต่โมเดลยังทำ) ต้องบังคับที่โค้ด
//
//  แยกมาเป็นไฟล์ล้วน ๆ ไม่พึ่ง supabase/env เพื่อให้ด่านตรวจ (scripts/check-assistant-text.mjs)
//  เรียกกฎ "ตัวเดียวกับที่ผู้ใช้เจอจริง" ได้ ไม่ใช่เขียนกฎซ้ำอีกชุดแล้วเพี้ยนกันวันหลัง
// ============================================================

export interface TextArtifact { label: string; href: string }

const MD_LINK_RE = /\[([^\]\n]{1,80})\]\(\s*(\S+?)\s*\)/g;

/**
 * เปลี่ยน URL ที่โมเดลเขียนมาให้เหลือ path ในระบบเรา — คืน null ถ้าไม่ใช่ลิงก์ที่รับได้
 * ลิงก์ในแชทของผู้ช่วยชี้ออกนอกระบบไม่ได้อยู่แล้วโดยออกแบบ โดเมนอะไรที่โมเดลเติมมาเองจึงตัดทิ้งเสมอ
 */
export function internalPath(raw: string): string | null {
  const s = raw.trim();
  if (s.startsWith("//")) return null;              // protocol-relative = ออกนอกระบบ
  if (s.startsWith("/")) return s;
  if (!/^https?:\/\//i.test(s)) return null;        // mailto:, tel:, ข้อความมั่ว
  try {
    const u = new URL(s);
    return u.pathname + u.search;
  } catch { return null; }
}

/**
 * ถอด markdown ที่หลุดมา และยกลิงก์ขึ้นไปเป็นปุ่ม
 * คืนข้อความที่สะอาดแล้ว + ปุ่มที่ควรเพิ่ม (ผู้เรียกเอาไปรวมกับปุ่มที่มีอยู่)
 */
export function sanitizeAssistantText(
  text: string,
  existing: TextArtifact[] = [],
  maxArtifacts = 6,
): { text: string; artifacts: TextArtifact[] } {
  const artifacts: TextArtifact[] = [];
  if (!text) return { text, artifacts };

  const taken = new Set(existing.map((a) => a.href));
  let t = text.replace(MD_LINK_RE, (_m, label: string, href: string) => {
    const path = internalPath(href);
    const name = String(label).trim();
    if (!path) return name;   // ลิงก์ใช้ไม่ได้ = ตัดทิ้ง เหลือข้อความที่ยังอ่านรู้เรื่อง
    if (existing.length + artifacts.length < maxArtifacts && !taken.has(path)) {
      taken.add(path);
      artifacts.push({ label: name.slice(0, 40) || "เปิดดู", href: path });
    }
    return name;
  });

  // ตัวหนา/ตัวเอียง/หัวข้อ/บุลเล็ต — หน้าแชทวาด plain text จึงต้องถอดออกให้หมด
  t = t
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*-]\s+/gm, "· ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: t, artifacts };
}
