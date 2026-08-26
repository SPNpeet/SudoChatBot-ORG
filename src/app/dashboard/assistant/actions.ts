"use server";
// ============================================================
//  ผู้จัดการร้าน AI — server action
//  · ตรวจสิทธิ์ owner/admin ก่อนเสมอ (agent สั่งแก้ราคา/ตั้งค่าไม่ได้)
//  · โควตา 100 ข้อความ/วัน/ร้าน (แพลตฟอร์มออกค่า AI — purpose 'assistant')
//  · คืน {ok} เสมอ ห้าม throw
// ============================================================
import { assertMember } from "@/lib/shop";
import { platformAiGuard, consumeAiQuota } from "@/lib/ai-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { friendlyAiError } from "@/lib/ai-errors";
import { runAssistant, type AssistantCtx } from "./engine";

export interface AssistantTurn { role: "user" | "assistant"; content: string }
export interface AssistantReply {
  ok: boolean;
  text?: string;
  toolCalls?: { name: string; label: string }[];
  artifacts?: { label: string; href: string }[];   // ปุ่มลิงก์เอกสารที่ AI เพิ่งสร้าง
  choices?: { label: string; reply: string }[];    // ปุ่มตอบคำถาม AI / ปุ่มทำต่อ — ไม่ต้องพิมพ์เอง
  error?: string;
  quotaExceeded?: boolean;   // โควตา AI หมด -> หน้าบ้านโชว์ paywall สวยๆ ไม่ใช่ error
}

const MAX_HISTORY = 20;
const MAX_LEN = 2000;

export async function assistantReply(shopId: string, history: AssistantTurn[]): Promise<AssistantReply> {
  try {
    // เก็บ role ไว้ส่งต่อให้ engine — เครื่องมือที่แก้ค่าตั้งค่าบังคับ owner/admin ในโค้ด (OWNER_ONLY_TOOLS)
    const { user, role } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    // ด่าน 0: เกราะแพลตฟอร์ม (kill switch + เพดานค่า AI/วัน) — เช็คก่อนกินโควตาผู้ใช้
    const guard = await platformAiGuard(svc, "งานเอกสาร/บัญชีคีย์เองใช้ได้ตามปกติค่ะ");
    if (!guard.ok) return { ok: false, error: guard.error };

    // เช็คสถานะกิจการ "ก่อน" ตัดโควตา — เดิมตัดโควตาแล้วค่อยเช็ค กิจการที่ถูกระงับ
    // จึงเสียโควตาฟรีทั้งที่ถูกปฏิเสธอยู่ดี · ด่านปฏิเสธเฉย ๆ ต้องมาก่อนด่านที่ตัดโควตาเสมอ
    const { data: shop } = await svc.from("shops").select("name,status,settings").eq("id", shopId).single();
    if (!shop || shop.status !== "active") return { ok: false, error: "บัญชีธุรกิจถูกระงับการใช้งาน — ติดต่อผู้ดูแลระบบ" };

    // โควตากลางต่อ "เจ้าของ" (นับรวมทุกกิจการ กันปั๊มโควตาหลายบริษัท) + แจ้งเตือน 80%/95% อัตโนมัติ
    const quota = await consumeAiQuota(svc, shopId, "งานเอกสาร/บัญชีคีย์เองใช้ได้ตามปกติค่ะ");
    if (!quota.ok) return { ok: false, error: quota.error, quotaExceeded: quota.quotaExceeded };

    const trimmed = history
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.trim())
      .slice(-MAX_HISTORY)
      .map((h) => ({ role: h.role, content: h.content.slice(0, MAX_LEN) }));
    if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") {
      return { ok: false, error: "ไม่มีข้อความให้ตอบ" };
    }

    const ctx: AssistantCtx = {
      svc, shopId, shopName: shop.name, role, userId: user.id, history: trimmed,
      assistantName: String(((shop.settings ?? {}) as Record<string, unknown>).assistant_name ?? "").trim() || undefined,
    };
    const r = await runAssistant(ctx);
    return { ok: true, text: r.text, toolCalls: r.toolCalls, artifacts: r.artifacts, choices: r.choices };
  } catch (e) {
    const m = (e as Error).message;
    if (m === "AI_NOT_CONFIGURED") return { ok: false, error: "แพลตฟอร์มยังไม่ได้ตั้งค่า AI — ผู้ดูแลระบบต้องใส่ API key ก่อน" };
    if (m.includes("forbidden")) return { ok: false, error: "สิทธิ์ของคุณใช้ผู้ช่วยบัญชี AI สั่งงานไม่ได้" };
    return { ok: false, error: friendlyAiError(m) };
  }
}

// ============================================================
//  โหลดเอกสารมาแสดง "บนใบจริง" ข้างแชท (19 ส.ค. 2569)
//
//  ทำไม: เดิมออกเอกสารเสร็จได้แค่ปุ่ม "เปิด <เลขที่>" ซึ่งพาออกจากแชทไปอีกหน้า
//  ผู้ใช้เสียบริบทที่กำลังคุยอยู่ และถ้าจะสั่งต่อต้องกดย้อนกลับมา
//  การเห็นใบจริงคาแชทคือสิ่งที่ทำให้ "สั่งด้วยคำพูด" น่าเชื่อถือขึ้นทันที
//  เพราะผู้ใช้ตรวจได้เองว่าที่ AI บอกว่าทำให้แล้ว หน้าตาออกมาเป็นแบบไหน
//
//  ⚠️ ใช้ตัวเลขที่ "บันทึกไว้บนเอกสารแล้ว" ตรง ๆ ห้ามคำนวณใหม่ที่นี่เด็ดขาด
//  เอกสารที่ออกไปแล้วคือความจริงที่ส่งถึงลูกค้า ถ้าคำนวณใหม่แล้วสูตรต่างกันแม้บาทเดียว
//  หน้าจอจะโชว์เลขคนละตัวกับใบที่ลูกค้าถืออยู่ ซึ่งจับได้ยากมากและทำลายความเชื่อถือ
// ============================================================
export interface DocPreviewData {
  docType: string; docNumber: string;
  seller: { name: string; address?: string | null; taxId?: string | null; branch?: string | null };
  buyer: { name: string; address?: string | null; taxId?: string | null };
  rows: { name: string; qty: number; unit: string; unitPrice: number }[];
  totals: { subtotal: number; discount: number; exVat: number; vat: number; total: number; wht: number; cashDue: number };
  issueDate: string; dueDate: string; vatMode: string; whtRate: number; notes: string;
}

export async function getDocPreview(
  shopId: string, docId: string,
): Promise<{ ok: true; data: DocPreviewData } | { ok: false; error: string }> {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(docId)) return { ok: false, error: "รหัสเอกสารไม่ถูกต้อง" };
    await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    const [{ data: d }, { data: shop }] = await Promise.all([
      svc.from("fin_docs").select("*, fin_doc_items(*)").eq("id", docId).eq("shop_id", shopId).maybeSingle(),
      svc.from("shops").select("name,billing_name,billing_address,tax_id").eq("id", shopId).maybeSingle(),
    ]);
    if (!d) return { ok: false, error: "ไม่พบเอกสารนี้" };

    const items = ((d.fin_doc_items ?? []) as Record<string, unknown>[])
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    const n = (v: unknown) => Number(v ?? 0) || 0;

    return {
      ok: true,
      data: {
        docType: String(d.doc_type),
        docNumber: String(d.doc_number ?? ""),
        seller: {
          name: String(shop?.billing_name || shop?.name || ""),
          address: shop?.billing_address ?? null, taxId: shop?.tax_id ?? null, branch: null,
        },
        buyer: {
          name: String(d.contact_name ?? ""),
          address: (d.contact_address as string | null) ?? null,
          taxId: (d.contact_tax_id as string | null) ?? null,
        },
        rows: items.map((it) => ({
          name: String(it.name ?? ""), qty: n(it.qty), unit: String(it.unit ?? ""), unitPrice: n(it.unit_price),
        })),
        totals: {
          subtotal: n(d.subtotal), discount: n(d.discount),
          // มูลค่าก่อนภาษีของใบนี้ = ยอดรวม - VAT ที่พิมพ์อยู่บนใบ (ไม่คิดใหม่จากอัตรา)
          exVat: n(d.total) - n(d.vat_amount), vat: n(d.vat_amount), total: n(d.total),
          wht: n(d.wht_amount), cashDue: n(d.total) - n(d.wht_amount),
        },
        issueDate: String(d.issue_date ?? ""), dueDate: String(d.due_date ?? ""),
        vatMode: String(d.vat_mode ?? "none"), whtRate: n(d.wht_rate), notes: String(d.notes ?? ""),
      },
    };
  } catch (e) {
    const m = (e as Error).message;
    if (m.includes("forbidden")) return { ok: false, error: "ไม่มีสิทธิ์ดูเอกสารนี้" };
    return { ok: false, error: "เปิดเอกสารไม่สำเร็จ" };
  }
}
