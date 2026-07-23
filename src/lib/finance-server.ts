// ============================================================
//  เครื่องยนต์ลงบัญชี (server-only) — แกนกลาง GL
//  ทุกธุรกรรมของระบบวิ่งผ่าน postJournal: เดบิต = เครดิตเสมอ ไม่งั้นไม่บันทึก
//  รหัสบัญชีระบบ (seed ใน migration 051):
//   1010 เงินสด · 1020 ธนาคาร · 1130 ลูกหนี้ · 1154 ภาษีซื้อ · 1155 ภาษีถูกหัก ณ ที่จ่าย
//   1160 สินค้าคงเหลือ · 2010 เจ้าหนี้ · 2030 ภาษีขาย · 2045 ภาษีหัก ณ ที่จ่ายค้างนำส่ง
//   4010 รายได้ขาย · 5010 ต้นทุนขาย · 5xxx ค่าใช้จ่ายตามหมวด
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACC = {
  CASH: "1010", BANK: "1020", AR: "1130", VAT_IN: "1154", WHT_ASSET: "1155",
  INVENTORY: "1160", AP: "2010", VAT_OUT: "2030", WHT_PAYABLE: "2045",
  SALES: "4010", COGS: "5010", OTHER_EXPENSE: "5990",
} as const;

export interface JournalLineInput {
  code: string;          // รหัสบัญชีในผังบัญชี
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface PostJournalInput {
  date: string;          // YYYY-MM-DD
  memo: string;
  sourceType: "sale" | "receipt" | "expense" | "payment" | "stock" | "manual" | "reversal";
  sourceId?: string | null;
  lines: JournalLineInput[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** ลงสมุดรายวัน — ตัดบรรทัดยอด 0 ทิ้ง ตรวจเดบิต=เครดิตก่อนบันทึกเสมอ */
export async function postJournal(
  svc: SupabaseClient, shopId: string, userId: string | null, input: PostJournalInput,
): Promise<{ ok: true; entryId: string; entryNumber: string } | { ok: false; error: string }> {
  const lines = input.lines
    .map((l) => ({ ...l, debit: r2(Number(l.debit ?? 0)), credit: r2(Number(l.credit ?? 0)) }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  if (!lines.length) return { ok: false, error: "ไม่มีบรรทัดบัญชีให้ลง" };

  const dr = r2(lines.reduce((a, l) => a + l.debit, 0));
  const cr = r2(lines.reduce((a, l) => a + l.credit, 0));
  if (Math.abs(dr - cr) > 0.01) {
    return { ok: false, error: `เดบิต (${dr}) ไม่เท่ากับเครดิต (${cr}) — ระบบไม่บันทึกรายการที่ไม่สมดุล` };
  }

  // resolve รหัสบัญชี -> id ของร้านนี้
  const codes = [...new Set(lines.map((l) => l.code))];
  const { data: accounts, error: accErr } = await svc.from("chart_of_accounts")
    .select("id, code").eq("shop_id", shopId).in("code", codes);
  if (accErr) return { ok: false, error: accErr.message };
  const byCode = new Map((accounts ?? []).map((a) => [a.code, a.id]));
  for (const c of codes) {
    if (!byCode.has(c)) return { ok: false, error: `ไม่พบบัญชีรหัส ${c} ในผังบัญชี` };
  }

  const { data: num, error: numErr } = await svc.rpc("next_fin_doc_number", { p_shop_id: shopId, p_doc_type: "journal" });
  if (numErr || !num) return { ok: false, error: numErr?.message ?? "ออกเลขสมุดรายวันไม่สำเร็จ" };

  const { data: entry, error: entErr } = await svc.from("journal_entries").insert({
    shop_id: shopId, entry_number: num as string, entry_date: input.date,
    memo: input.memo.slice(0, 500), source_type: input.sourceType,
    source_id: input.sourceId ?? null, created_by: userId,
  }).select("id").single();
  if (entErr || !entry) return { ok: false, error: entErr?.message ?? "บันทึกสมุดรายวันไม่สำเร็จ" };

  const { error: lineErr } = await svc.from("journal_lines").insert(lines.map((l, i) => ({
    entry_id: entry.id, shop_id: shopId, account_id: byCode.get(l.code)!,
    debit: l.debit, credit: l.credit, memo: l.memo?.slice(0, 300) ?? null, sort: i,
  })));
  if (lineErr) {
    await svc.from("journal_entries").delete().eq("id", entry.id);
    return { ok: false, error: lineErr.message };
  }
  return { ok: true, entryId: entry.id, entryNumber: num as string };
}

/** กลับรายการ (reversal) ทุก entry ของเอกสารต้นทาง — ใช้ตอนยกเลิกเอกสาร */
export async function reverseJournalOf(
  svc: SupabaseClient, shopId: string, userId: string | null,
  sourceId: string, memo: string,
): Promise<void> {
  const { data: entries } = await svc.from("journal_entries")
    .select("id, entry_number, journal_lines(account_id, debit, credit)")
    .eq("shop_id", shopId).eq("source_id", sourceId).neq("source_type", "reversal");
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  for (const e of entries ?? []) {
    const lines = (e.journal_lines ?? []) as { account_id: string; debit: number; credit: number }[];
    if (!lines.length) continue;
    const { data: num } = await svc.rpc("next_fin_doc_number", { p_shop_id: shopId, p_doc_type: "journal" });
    const { data: rev } = await svc.from("journal_entries").insert({
      shop_id: shopId, entry_number: num as string, entry_date: today,
      memo: `กลับรายการ ${e.entry_number}: ${memo}`.slice(0, 500),
      source_type: "reversal", source_id: sourceId, created_by: userId,
    }).select("id").single();
    if (!rev) continue;
    await svc.from("journal_lines").insert(lines.map((l, i) => ({
      entry_id: rev.id, shop_id: shopId, account_id: l.account_id,
      debit: Number(l.credit), credit: Number(l.debit), sort: i,
    })));
  }
}

/** วันที่ธุรกิจไทยวันนี้ (UTC+7) รูปแบบ YYYY-MM-DD */
export function bkkToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export interface PayableDoc {
  id: string; doc_number: string; doc_type: string;
  total: number; wht_amount: number; paid_amount: number; contact_name: string | null;
}

/** ลงบัญชีรับ/จ่ายเงินของเอกสาร + อัปเดตยอด/สถานะ — ใช้ทั้ง dashboard และหน้าเอกสารสาธารณะ */
export async function applyPaymentToDoc(
  svc: SupabaseClient, shopId: string, userId: string | null,
  doc: PayableDoc, amount: number, method: string, paidAt: string,
): Promise<string> {
  const firstPayment = Number(doc.paid_amount) === 0;
  const wht = firstPayment ? Number(doc.wht_amount) : 0;
  const cashAcc = method === "cash" ? ACC.CASH : ACC.BANK;
  const date = paidAt.slice(0, 10);

  if (doc.doc_type === "invoice") {
    await postJournal(svc, shopId, userId, {
      date, memo: `รับชำระ ${doc.doc_number}${doc.contact_name ? ` — ${doc.contact_name}` : ""}`,
      sourceType: "receipt", sourceId: doc.id,
      lines: [
        { code: cashAcc, debit: amount },
        { code: ACC.WHT_ASSET, debit: wht },
        { code: ACC.AR, credit: amount + wht },
      ],
    });
  } else if (doc.doc_type === "expense") {
    await postJournal(svc, shopId, userId, {
      date, memo: `จ่ายชำระ ${doc.doc_number}${doc.contact_name ? ` — ${doc.contact_name}` : ""}`,
      sourceType: "payment", sourceId: doc.id,
      lines: [
        { code: ACC.AP, debit: amount + wht },
        { code: cashAcc, credit: amount },
        { code: ACC.WHT_PAYABLE, credit: wht },
      ],
    });
  }

  const newPaid = Math.round((Number(doc.paid_amount) + amount) * 100) / 100;
  const cashDue = Number(doc.total) - Number(doc.wht_amount);
  const newStatus = newPaid >= cashDue - 0.01 ? "paid" : "partial";
  await svc.from("fin_docs").update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() }).eq("id", doc.id);
  return newStatus;
}
