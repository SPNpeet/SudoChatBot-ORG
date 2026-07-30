// ============================================================
//  กล่องจดหมายระบบ — รวบรวม "เรื่องที่ระบบต้องบอก" ไว้ที่เดียว
//
//  ทำไมต้องมี: เดิมมี 5 กล่องเตือนกระจายอยู่ เจ้าของบอกว่า "รกจัด ๆ"
//  รอบ 1 ย้าย 3 กล่องออกจาก layout ไปหน้าภาพรวม (ทุกหน้าอื่นสะอาดแล้ว)
//  รอบนี้ยกเข้ากระดิ่งเดียว มีสถานะอ่านแล้ว หน้าภาพรวมจึงเหลือแต่เนื้องาน
//
//  ⚠️ คำนวณสดทุกครั้ง ไม่ insert เป็นแถวเก็บไว้
//  ถ้าเก็บเป็นแถวต้องมี cron มาสร้างและลบ แล้วจะเกิดกรณีที่แย่ที่สุดคือ
//  ผู้ใช้แก้ข้อมูลครบแล้วแต่ข้อความยังค้างอยู่ — คำเตือนที่ไม่จริงทำลายความเชื่อถือ
//  ของคำเตือนทุกอันที่เหลือ ตารางที่เก็บมีแค่ notice_dismissals (ใครอ่านอะไรแล้ว)
//
//  ⚠️ กุญแจต้องผูกกับ "สถานะ" ไม่ใช่แค่ชนิดเรื่อง เช่น health:partners:3
//  ถ้าคู่ค้าที่ข้อมูลไม่ครบเพิ่มจาก 3 เป็น 5 กุญแจเปลี่ยน = เด้งขึ้นใหม่
//  กดปิดครั้งเดียวไม่ได้แปลว่าปิดปัญหาที่แย่ลงไปตลอด
// ============================================================
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { selectWhtPayableDocs } from "@/lib/vat-docs";
import { quotaNotice, TONE_ORDER, type Notice, type NoticeTone, type QuotaLike } from "@/lib/notice-rules";

// re-export ให้ที่ import จาก "@/lib/notices" เดิมไม่ต้องแก้
export { quotaNotice };
export type { Notice, NoticeTone, QuotaLike };

interface Health {
  tax_id_ok: boolean; address_ok: boolean;
  bad_partners: number; partner_names: string;
  odd_dates: number; odd_list: string;
  error?: string;
}
interface VatStatus {
  status?: "ok" | "warn" | "expired";
  rate?: number; percent?: number;
  valid_until?: string | null; days_left?: number | null; note?: string | null;
}

/**
 * รวมทุกเรื่องที่ต้องบอก แล้วคัดที่ผู้ใช้กดอ่านไปแล้วออก
 * คืน { notices, unread } — unread ใช้ขึ้นเลขบนกระดิ่ง
 *
 * ทุกแหล่งหุ้ม try/catch แยกกัน แหล่งเดียวล่มต้องไม่ทำให้กระดิ่งหายทั้งอัน
 */
export async function getNotices(shopId: string, quota?: QuotaLike | null): Promise<{ notices: Notice[]; unread: number }> {
  const all: Notice[] = [];

  const q = quotaNotice(quota);
  if (q) all.push(q);

  // ---------- ประกาศจากแพลตฟอร์ม ----------
  try {
    const { data } = await createServiceClient().from("system_alerts")
      .select("id,level,title,body,ends_at,created_at")
      .eq("active", true).order("created_at", { ascending: false }).limit(5);
    for (const a of data ?? []) {
      const row = a as { id: string; level: string; title: string; body: string | null; ends_at: string | null; created_at: string };
      if (row.ends_at && new Date(row.ends_at) <= new Date()) continue;
      all.push({
        key: `alert:${row.id}`,
        tone: row.level === "critical" ? "critical" : row.level === "warning" ? "warn" : "info",
        title: row.title, body: row.body ?? undefined, at: row.created_at,
      });
    }
  } catch { /* ประกาศอ่านไม่ได้ ไม่ควรทำให้กล่องจดหมายล่ม */ }

  // ---------- อัตรา VAT ใกล้หมดอายุ / หมดอายุแล้ว ----------
  //
  // ⚠️ ต้องรับทั้งสองสถานะ ไม่ใช่แค่ expired
  // แบนเนอร์เดิม (vat-rate-alert.tsx) ขึ้นตั้งแต่ status === "warn"
  // ตอนย้ายเข้ากล่องจดหมายรอบแรกผมทำหลุดสถานะ warn ไป
  // ผลคือช่วง "ใกล้หมดอายุ" จะไม่มีใครเตือนเลยทั้งระบบ — จับได้จากการยิง RPC
  // ดูของจริง (ตอนนี้เหลือ 62 วัน) แล้วเห็นว่ากล่องจดหมายเงียบทั้งที่ควรเตือน
  try {
    const { data } = await createServiceClient().rpc("vat_rate_status");
    const s = data as VatStatus | null;
    if (s?.status === "expired") {
      all.push({
        key: `vat:expired:${s.valid_until ?? "unknown"}`,
        tone: "critical",
        title: `อัตรา VAT ที่ระบบใช้ (${s.percent ?? 7}%) หมดอายุแล้วตั้งแต่ ${s.valid_until ?? "-"}`,
        body: "อัตรา 7% มาจาก พ.ร.ฎ.ลดอัตราที่ต่ออายุเป็นรายปี อัตราปกติตามกฎหมายคือ 10% "
          + "ระบบยังคิดอัตราเดิมอยู่ (ไม่เปลี่ยนเองเพื่อไม่ให้เอกสารเพี้ยนโดยไม่มีใครรู้) "
          + "ตรวจราชกิจจานุเบกษาแล้วแจ้งผู้ดูแลระบบให้อัปเดตทันที",
        href: "/dashboard/reports", cta: "ดูรายงานภาษี",
      });
    } else if (s?.status === "warn") {
      all.push({
        // กุญแจผูกกับวันหมดอายุ ไม่ใช่จำนวนวันที่เหลือ
        // ถ้าใส่ days_left กุญแจจะเปลี่ยนทุกวัน = เด้งขึ้นใหม่ทุกวันแม้กดอ่านแล้ว
        key: `vat:warn:${s.valid_until ?? "unknown"}`,
        tone: "warn",
        title: `อัตรา VAT ${s.percent ?? 7}% จะหมดอายุใน ${s.days_left ?? "-"} วัน (${s.valid_until ?? "-"})`,
        body: "ถ้ามีประกาศต่ออายุหรือเปลี่ยนอัตรา ผู้ดูแลระบบต้องอัปเดตตารางอัตราก่อนวันมีผล "
          + (s.note ?? ""),
        href: "/dashboard/reports", cta: "ดูรายงานภาษี",
      });
    }
  } catch { /* ข้าม */ }

  // ---------- ข้อมูลของกิจการเองที่ยังไม่ครบ ----------
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("shop_data_health", { p_shop_id: shopId });
    const h = data as Health | null;
    if (h && !h.error) {
      const missing: string[] = [];
      if (!h.tax_id_ok) missing.push("เลขประจำตัวผู้เสียภาษี");
      if (!h.address_ok) missing.push("ที่อยู่");
      if (missing.length) {
        all.push({
          key: `health:shop:${missing.join(",")}`,
          tone: "warn",
          title: `ข้อมูลกิจการยังไม่ครบ (${missing.join(" · ")})`,
          body: "ออกใบกำกับภาษีเต็มรูปตามมาตรา 86/4 ไม่ได้ ลูกค้านิติบุคคลจะเอาไปขอคืนภาษีซื้อไม่ได้",
          href: "/dashboard/settings", cta: "ไปกรอกข้อมูลกิจการ",
        });
      }
      if (h.bad_partners > 0) {
        all.push({
          key: `health:partners:${h.bad_partners}`,
          tone: "warn",
          title: `${h.bad_partners} คู่ค้าที่หักภาษี ณ ที่จ่ายไว้ ยังไม่มีเลขผู้เสียภาษีที่ถูกต้อง`,
          body: `${h.partner_names} — ไฟล์ยื่น ภ.ง.ด. จะมีช่องว่างและโปรแกรมสรรพากรไม่รับ`,
          href: "/dashboard/contacts", cta: "ไปแก้ข้อมูลคู่ค้า",
        });
      }
      if (h.odd_dates > 0) {
        all.push({
          key: `health:dates:${h.odd_dates}`,
          tone: "critical",
          title: `${h.odd_dates} เอกสารลงวันที่ในอนาคตไกลผิดปกติ`,
          body: `${h.odd_list} — น่าจะกรอก พ.ศ. ลงช่อง ค.ศ. เอกสารพวกนี้ไม่โผล่ในรายงานงวดไหนเลย `
            + "แต่ยังค้างในยอดลูกหนี้/เจ้าหนี้ตลอดไป ต้องกดยกเลิกแล้วออกใหม่",
          href: "/dashboard/expenses", cta: "ไปตรวจเอกสาร",
        });
      }
    }
  } catch { /* ข้าม */ }

  // ---------- กำหนดนำส่ง ภ.ง.ด. ที่ใกล้ถึง / เลยมาแล้ว ----------
  //
  // ⚠️ เตือนเฉพาะงวดที่ "มีภาษีต้องนำส่งจริง" เท่านั้น
  // ถ้าเตือนทุกเดือนไม่ดูข้อมูล ร้านที่ไม่เคยหักภาษีใครจะโดนเตือนทุกเดือนเปล่า ๆ
  // แล้วก็จะเลิกอ่านกระดิ่ง ซึ่งทำให้เรื่องที่สำคัญจริงถูกกลืนไปด้วย
  //
  // ดู 2 งวด: เดือนก่อนกับเดือนนี้ เพราะ ม.52 ให้ยื่นภายใน 7 วันนับจากสิ้นเดือนที่จ่าย
  // ต้นเดือนจึงมีทั้งงวดเดือนก่อน (ใกล้ครบกำหนด) และงวดเดือนนี้ (ยังสะสมอยู่)
  try {
    const supabase = await createClient();
    const now = new Date(Date.now() + 7 * 3600_000);            // เวลาไทย
    const today = now.toISOString().slice(0, 10);
    const months = [
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7),
      now.toISOString().slice(0, 7),
    ];

    for (const period of months) {
      const start = `${period}-01`;
      const [y, m] = period.split("-").map(Number);
      const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

      const { data: rows } = await supabase.from("fin_docs")
        .select("doc_type,status,wht_amount,vat_amount,total,ref_doc_id")
        .eq("shop_id", shopId).gt("wht_amount", 0)
        .gte("issue_date", start).lt("issue_date", end);
      const payable = selectWhtPayableDocs((rows ?? []) as never[]);
      if (!payable.length) continue;

      const tax = payable.reduce((a, d) => a + Number((d as { wht_amount?: number }).wht_amount ?? 0), 0);
      const { data: dueRaw } = await supabase.rpc("wht_due_dates", { p_period: period });
      const due = dueRaw as { paper?: string | null; online?: string | null } | null;
      const paper = due?.paper ?? null;
      if (!paper) continue;

      const daysLeft = Math.round((Date.parse(`${paper}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
      // เตือนเมื่อเหลือ ≤ 14 วัน หรือเลยกำหนดมาแล้ว — ก่อนนั้นยังไม่ต้องรบกวน
      if (daysLeft > 14) continue;

      const late = daysLeft < 0;
      all.push({
        // ผูกกับงวด ไม่ใช่จำนวนวัน ไม่งั้นกุญแจเปลี่ยนทุกวันแล้วเด้งใหม่ทุกวัน
        key: `wht_due:${period}`,
        tone: late || daysLeft <= 3 ? "critical" : "warn",
        title: late
          ? `เลยกำหนดนำส่งภาษีหัก ณ ที่จ่ายงวด ${period} มา ${Math.abs(daysLeft)} วัน`
          : `อีก ${daysLeft} วันครบกำหนดนำส่งภาษีหัก ณ ที่จ่ายงวด ${period}`,
        body: `${payable.length} รายการ ภาษีที่ต้องนำส่ง ${tax.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท `
          + `· ยื่นกระดาษภายใน ${paper}${due?.online ? ` · ยื่นออนไลน์ได้ถึง ${due.online}` : ""}`
          + (late ? " — ยื่นช้ามีเงินเพิ่ม 1.5% ต่อเดือนของภาษีที่ต้องนำส่ง (ม.27)" : ""),
        href: "/dashboard/reports", cta: "ไปโหลดไฟล์ยื่น",
      });
    }
  } catch { /* ข้าม */ }

  // ---------- แจ้งเตือนรายเหตุการณ์ที่บันทึกไว้จริง (ตาราง notifications) ----------
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("notifications")
      .select("id,type,title,body,created_at")
      .eq("shop_id", shopId).eq("read", false)
      .order("created_at", { ascending: false }).limit(20);
    for (const n of data ?? []) {
      const row = n as { id: string; type: string; title: string; body: string | null; created_at: string };
      all.push({
        key: `row:${row.id}`,
        tone: row.type === "bot_blocked" ? "critical" : row.type === "order_paid" ? "info" : "warn",
        title: row.title, body: row.body ?? undefined, at: row.created_at,
        href: row.type === "order_paid" ? "/dashboard/money" : "/dashboard/billing",
        cta: row.type === "order_paid" ? "ไปหน้าการเงิน" : "ไปหน้าเติมเงิน",
      });
    }
  } catch { /* ข้าม */ }

  // ---------- คัดที่กดอ่านไปแล้วออก ----------
  let seen = new Set<string>();
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("notice_dismissals")
      .select("notice_key").eq("shop_id", shopId);
    seen = new Set((data ?? []).map((d) => (d as { notice_key: string }).notice_key));
  } catch { /* อ่านไม่ได้ก็ถือว่ายังไม่อ่าน ดีกว่าซ่อนของจริง */ }

  const notices = all
    .filter((n) => !seen.has(n.key))
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || (b.at ?? "").localeCompare(a.at ?? ""));

  return { notices, unread: notices.length };
}
