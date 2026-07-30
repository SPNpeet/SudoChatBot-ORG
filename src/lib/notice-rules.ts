// ============================================================
//  กฎของกล่องจดหมายระบบ — ส่วนที่เป็นตรรกะล้วน ไม่แตะฐานข้อมูล
//
//  ทำไมต้องแยกไฟล์: notices.ts import @/lib/supabase/server ซึ่งลาก next/headers มาด้วย
//  เทสต์ที่รันด้วย node จึง import ไม่ได้เลย = เกณฑ์ 80/95 ไม่มีใครตรวจ
//  บทเรียนเดียวกับที่ย้ายตัวประกอบบรรทัดไฟล์ยื่นสรรพากรออกมาไว้ src/lib/rd.ts
//  (ลำดับคอลัมน์อยู่ในไฟล์หน้าเว็บ เทสต์มองไม่เห็น สลับคอลัมน์แล้วไม่มีใครรู้)
//
//  ⚠️ ห้าม import อะไรที่แตะ request/cookies/ฐานข้อมูลเข้ามาในไฟล์นี้
// ============================================================

export type NoticeTone = "critical" | "warn" | "info";

export interface Notice {
  /** กุญแจผูกกับสถานะจริง — เปลี่ยนเมื่อสถานะเปลี่ยน */
  key: string;
  tone: NoticeTone;
  title: string;
  body?: string;
  href?: string;
  cta?: string;
  /** ISO — ใช้เรียงลำดับ ถ้าไม่มีถือว่าเป็นเรื่องที่เป็นอยู่ตอนนี้ */
  at?: string;
}



/** รูปร่างของ get_ai_quota_status เท่าที่ใช้ที่นี่ — ตัวเต็มอยู่ที่ ai-quota-bar.tsx */
export interface QuotaLike {
  allowed?: boolean; reason?: string | null; pct?: number;
  used_today?: number; cap_today?: number | null;
}

export const TONE_ORDER: Record<NoticeTone, number> = { critical: 0, warn: 1, info: 2 };

/**
 * ข้อความเตือนเรื่องโควตา AI — แยกออกมาเป็นฟังก์ชันล้วนเพื่อให้เทสต์เห็น
 *
 * ⚠️ ทำไมต้องมีทั้งที่มีแถบโควตาในเมนูซ้ายอยู่แล้ว:
 * แถบนั้น render ที่ sidebar-parts.tsx ที่เดียว และอยู่ใน {!collapsed && ...}
 * แปลว่า **มือถือไม่เห็นเลย** (มือถือไม่มีแถบเมนูซ้าย) และ **พับเมนูก็ไม่เห็น**
 * คนที่ใช้มือถือเป็นหลักจะโดนตัด AI กลางงานโดยไม่มีสัญญาณอะไรมาก่อน
 * ไม่ซ้ำกับแถบ เพราะแถบคือมาตรวัดที่ดูเมื่ออยากดู ส่วนนี่คือการเตือนเมื่อถึงเกณฑ์
 *
 * เกณฑ์ 80/95 ยึดตามสีของแถบโควตา (ai-quota-bar.tsx) ให้ผู้ใช้เห็นเรื่องเดียวกัน
 * ถ้าแก้ที่นี่ต้องแก้ที่นั่นด้วย ไม่งั้นแถบเหลืองแต่กระดิ่งเงียบ = ผู้ใช้ไม่รู้จะเชื่ออะไร
 */
export function quotaNotice(q: QuotaLike | null | undefined): Notice | null {
  if (!q) return null;
  const pct = Math.round((Number(q.pct) || 0) * 100);

  if (q.allowed === false) {
    return {
      key: `ai_quota:blocked:${q.reason ?? "unknown"}`,
      tone: "critical",
      title: "ผู้ช่วยบัญชี AI ใช้งานไม่ได้ชั่วคราว",
      body: (q.reason ?? "ถึงเพดานที่ตั้งไว้")
        + " · งานบัญชีอื่นทั้งหมดยังใช้ได้ปกติ บันทึกเอกสารด้วยมือได้เลย",
      href: "/dashboard/billing", cta: "ดูแพ็กเกจ",
    };
  }
  if (pct < 80) return null;

  return {
    // เก็บเป็นช่วง (80/95) ไม่ใช่ตัวเลขเป๊ะ — ไม่งั้นกุญแจเปลี่ยนทุกครั้งที่ถาม AI
    // แล้วข้อความจะเด้งขึ้นใหม่ทุกคำถามแม้กดอ่านไปแล้ว
    key: `ai_quota:${pct >= 95 ? 95 : 80}`,
    tone: pct >= 95 ? "critical" : "warn",
    title: `โควตาผู้ช่วยบัญชี AI ใช้ไป ${pct}% แล้ว`,
    body: (q.cap_today
      ? `วันนี้ ${Number(q.used_today ?? 0).toLocaleString()}/${Number(q.cap_today).toLocaleString()} ครั้ง · `
      : "")
      + (pct >= 95
        ? "ใกล้ถูกตัดแล้ว ถ้าหมดจะบันทึกด้วยมือต่อได้ปกติ ไม่กระทบข้อมูลบัญชี"
        : "ถ้าใช้หนักช่วงปิดงบ เผื่อโควตาไว้หรืออัปแพ็กเกจก่อนถึงวันยื่นภาษี"),
    href: "/dashboard/billing", cta: "ดูแพ็กเกจ",
  };
}
