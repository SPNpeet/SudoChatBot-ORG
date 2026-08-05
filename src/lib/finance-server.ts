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
  // 4190 เป็นบัญชีหักรายได้ (contra-revenue) สำหรับใบลดหนี้
  // แยกจาก 4010 เพื่อให้งบกำไรขาดทุนเห็นยอดรับคืน/ลดราคา ไม่ใช่ซ่อนไว้ในยอดขายสุทธิ
  //
  // ⚠️ เคยพลาด: ครั้งแรกใช้รหัส 4090 ซึ่งชนกับ "รายได้อื่น" ที่มีอยู่แล้วในผังบัญชีตั้งต้น
  // คำสั่งสร้างบัญชีมี where not exists จึงไม่ทำอะไรเลยแบบเงียบ ๆ และค่าคงที่นี้
  // ก็เลยชี้ไปที่บัญชีผิดโดยไม่มีอะไรฟ้อง
  // บทเรียน: เพิ่มบัญชีใหม่ทุกครั้งต้องตรวจว่ารหัสนั้นว่างจริง และตรวจ "ชื่อ" หลังรันด้วย
  // ไม่ใช่แค่นับจำนวนแถว
  SALES: "4010", SALES_RETURN: "4190", COGS: "5010", OTHER_EXPENSE: "5990",
  // ทรัพย์สินถาวรและค่าเสื่อมราคา
  FIXED_ASSET: "1210", ACC_DEPRECIATION: "1290", DEPRECIATION: "5210",
  RETAINED_EARNINGS: "3020",
  // ภาษีขายของงานบริการที่ยังไม่ได้รับเงิน — ความรับผิดยังไม่เกิดตาม ม.78/1
  // พักไว้เป็นหนี้สินก่อน แล้วย้ายเข้า 2030 ตอนรับเงินจริง
  VAT_OUT_DEFERRED: "2035",
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
  // ข้อความนี้ผู้ใช้ทั่วไปได้เห็นจริงตอนเอกสารยอด 0 (เกิดจริง 4 ส.ค. 2569)
  // เจ้าของบอกว่า "ถ้าผมไม่ใช่คนทำระบบนี้ลูกค้างงตาย" — ต้องบอกว่าต้องทำอะไรต่อ ไม่ใช่ศัพท์บัญชี
  if (!lines.length) return { ok: false, error: "ยอดเงินเป็น 0 จึงไม่มีอะไรให้ลงบัญชี — กลับไปใส่ราคาในรายการก่อน" };

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

/**
 * ลงสมุดรายวัน แล้ว "โยน error" ถ้าไม่สำเร็จ — ใช้แทน postJournal ทุกที่ที่เรียกจาก server action
 *
 * ⚠️ ทำไมต้องมี: เดิมทุกจุดเรียก postJournal แล้วทิ้งผลลัพธ์ (9 จุด)
 * ถ้าลงบัญชีไม่ผ่าน (เช่น เดบิตไม่เท่าเครดิต หรือไม่พบรหัสบัญชีในผังบัญชี)
 * ระบบจะเดินหน้าอัปเดตสถานะเอกสารต่อเหมือนสำเร็จ ผู้ใช้เห็น "บันทึกแล้ว"
 * แต่เอกสารนั้นหายจากสมุดรายวัน งบทดลอง และงบกำไรขาดทุน โดยไม่มีใครรู้
 * จนกว่าจะปิดงบแล้วเจอว่าตัวเลขไม่ตรง ซึ่งตอนนั้นย้อนหาสาเหตุแทบไม่ได้
 *
 * server action ทุกตัวหุ้มด้วย try/catch ที่แปลง error เป็นข้อความให้ผู้ใช้อยู่แล้ว
 * การโยน error จึงทำให้ "ไม่สำเร็จก็บอกว่าไม่สำเร็จ" แทนที่จะเงียบแล้วข้อมูลหาย
 */
export async function postJournalOrThrow(
  svc: SupabaseClient, shopId: string, userId: string | null, input: PostJournalInput,
): Promise<{ entryId: string; entryNumber: string }> {
  const r = await postJournal(svc, shopId, userId, input);
  if (!r.ok) throw new Error(`ลงบัญชีไม่สำเร็จ (${input.memo.slice(0, 60)}): ${r.error}`);
  return { entryId: r.entryId, entryNumber: r.entryNumber };
}

/** กลับรายการ (reversal) ทุก entry ของเอกสารต้นทาง — ใช้ตอนยกเลิกเอกสาร */
export async function reverseJournalOf(
  svc: SupabaseClient, shopId: string, userId: string | null,
  sourceId: string, memo: string,
): Promise<void> {
  // ⚠️ ทุก error ในฟังก์ชันนี้ต้องโยนออกไป ห้ามกลืน
  // เดิมกลืนทุกจุด (อ่านใบสำคัญพัง -> entries เป็น null -> ลูปไม่ทำงาน แล้วคืนสำเร็จเฉย ๆ)
  // ผลคือผู้ใช้กด "ยกเลิกเอกสาร" แล้วระบบตอบว่าสำเร็จ ทั้งที่ไม่มีรายการกลับบัญชีเกิดขึ้นเลย
  // -> รายได้/ภาษีขายของใบที่ยกเลิกยังค้างในสมุดรายวัน งบทดลอง และ ภ.พ.30 ตลอดไป
  // ซึ่งชนกฎ "รายงานต้องตรงสมุดรายวัน" ตรง ๆ และไม่มีตัวตรวจไหนจับได้
  const { data: entries, error: readErr } = await svc.from("journal_entries")
    .select("id, entry_number, entry_date, journal_lines(account_id, debit, credit)")
    .eq("shop_id", shopId).eq("source_id", sourceId).neq("source_type", "reversal");
  if (readErr) throw new Error(`อ่านรายการบัญชีเดิมไม่สำเร็จ: ${readErr.message}`);

  // ⚠️ ต้องรู้ว่าใบไหน "กลับไปแล้ว" ก่อนกลับซ้ำ
  // เอกสารหนึ่งใบมีใบสำคัญได้หลายใบ (ของจริง 13 จาก 72 ใบมี 2-3 ใบสำคัญ)
  // ถ้าใบที่ 1 กลับสำเร็จแล้วใบที่ 2 พัง ผู้ใช้จะกดใหม่ -> เดิมจะกลับใบที่ 1 ซ้ำอีกรอบ
  // ผลคือต้นฉบับ 2 ใบ แต่รายการกลับ 3 ใบ = รายได้/ภาษีขายหายไปหนึ่งชุดถาวร
  // และงบยังสมดุลอยู่ (รายการกลับสมดุลในตัวเอง) จึงไม่มีตัวตรวจไหนจับได้
  const { data: doneRows, error: doneErr } = await svc.from("journal_entries")
    .select("memo").eq("shop_id", shopId).eq("source_id", sourceId).eq("source_type", "reversal");
  if (doneErr) throw new Error(`ตรวจรายการกลับเดิมไม่สำเร็จ: ${doneErr.message}`);
  // memo ของรายการกลับขึ้นต้นด้วย "กลับรายการ <เลขใบสำคัญต้นฉบับ>:" จึงใช้เป็นลายเซ็นได้
  const alreadyReversed = new Set(
    (doneRows ?? []).map((d) => String(d.memo ?? "").match(/^กลับรายการ\s+(\S+?):/)?.[1]).filter(Boolean) as string[],
  );

  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  for (const e of entries ?? []) {
    if (alreadyReversed.has(String(e.entry_number))) continue;   // กลับไปแล้ว ห้ามกลับซ้ำ
    const lines = (e.journal_lines ?? []) as { account_id: string; debit: number; credit: number }[];
    if (!lines.length) continue;

    /**
     * วันที่ของรายการกลับ = วันที่หลังสุดระหว่าง "วันนี้" กับ "วันของรายการต้นฉบับ"
     *
     * ปกติต้นฉบับอยู่ในอดีต -> กลับรายการวันนี้ ซึ่งถูกต้อง เพราะห้ามแตะงวดที่ยื่นภาษีไปแล้ว
     *
     * แต่ถ้าต้นฉบับลงวันที่ไว้ในอนาคต (เช่น กรอก พ.ศ. ลงช่อง ค.ศ. จนกลายเป็นปี 2069)
     * การกลับรายการ "วันนี้" จะทำให้งบทดลอง ณ วันใด ๆ ก่อนวันนั้น
     * เห็นแต่รายการกลับโดยไม่มีต้นฉบับมาหักล้าง = เดบิตไม่เท่าเครดิต
     * ของจริงที่เจอ: เอกสาร 63,750 บาทลงวันที่ 19/06/2069 ถ้ากดยกเลิกจะทำให้งบเพี้ยนทันที
     *
     * ใช้ max() แล้วงบสมดุลที่ทุกจุดเวลา ไม่ว่าต้นฉบับจะอยู่อดีตหรืออนาคต
     */
    const originDate = String((e as { entry_date?: string }).entry_date ?? today);
    const revDate = originDate > today ? originDate : today;

    const { data: num, error: numErr } = await svc.rpc("next_fin_doc_number", { p_shop_id: shopId, p_doc_type: "journal" });
    if (numErr || !num) throw new Error(`ออกเลขใบสำคัญกลับรายการไม่สำเร็จ: ${numErr?.message ?? "ไม่ได้เลขที่"}`);
    const { data: rev, error: revErr } = await svc.from("journal_entries").insert({
      shop_id: shopId, entry_number: num as string, entry_date: revDate,
      memo: `กลับรายการ ${e.entry_number}: ${memo}`.slice(0, 500),
      source_type: "reversal", source_id: sourceId, created_by: userId,
    }).select("id").single();
    // เดิม `if (!rev) continue;` = ข้ามเงียบ ๆ แล้วบอกผู้ใช้ว่าสำเร็จ
    if (revErr || !rev) throw new Error(`สร้างใบสำคัญกลับรายการไม่สำเร็จ: ${revErr?.message ?? "ไม่ทราบสาเหตุ"}`);
    const { error: lineErr } = await svc.from("journal_lines").insert(lines.map((l, i) => ({
      entry_id: rev.id, shop_id: shopId, account_id: l.account_id,
      debit: Number(l.credit), credit: Number(l.debit), sort: i,
    })));
    // หัวใบสำเร็จแต่บรรทัดไม่เข้า = ใบสำคัญเปล่าที่ไม่มีตัวตรวจไหนเห็น
    // (jv_balance มองไม่เห็นเพราะไม่มีบรรทัดให้ join · void_no_reversal นับได้ 2 = ดูเหมือนกลับครบ)
    // ต้องเก็บกวาดหัวใบทิ้งแล้วโยน ไม่ใช่ปล่อยขยะไว้ในสมุดรายวัน
    if (lineErr) {
      await svc.from("journal_entries").delete().eq("id", rev.id);
      throw new Error(`ลงบรรทัดกลับรายการไม่สำเร็จ: ${lineErr.message}`);
    }
  }
}

/** วันที่ธุรกิจไทยวันนี้ (UTC+7) รูปแบบ YYYY-MM-DD */
export function bkkToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export interface PayableDoc {
  id: string; doc_number: string; doc_type: string;
  total: number; wht_amount: number; paid_amount: number; contact_name: string | null;
  // ต้อง select มาด้วยทุกที่ที่เรียก applyPaymentToDoc — ถ้าไม่มีจะถือว่า delivery (พฤติกรรมเดิม)
  tax_point?: string | null; vat_amount?: number | null;
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
    await postJournalOrThrow(svc, shopId, userId, {
      date, memo: `รับชำระ ${doc.doc_number}${doc.contact_name ? ` — ${doc.contact_name}` : ""}`,
      sourceType: "receipt", sourceId: doc.id,
      lines: [
        { code: cashAcc, debit: amount },
        { code: ACC.WHT_ASSET, debit: wht },
        { code: ACC.AR, credit: amount + wht },
      ],
    });

    // งานบริการที่ขายเชื่อ: ความรับผิด VAT เพิ่งเกิดตอนนี้ (ม.78/1)
    // ย้ายภาษีขายที่พักไว้ออกมาเป็นภาษีขายจริง "ตามสัดส่วนเงินที่ได้รับงวดนี้"
    // ต้องคิดตามสัดส่วน เพราะใบเดียวรับเงินหลายงวดข้ามเดือนได้
    // และ ภ.พ.30 ต้องลงเดือนที่รับเงินจริง ไม่ใช่เดือนที่ออกใบแจ้งหนี้
    if (doc.tax_point === "payment" && Number(doc.vat_amount ?? 0) > 0) {
      const cashDueTotal = Number(doc.total) - Number(doc.wht_amount);
      const alreadyPaid = Number(doc.paid_amount);
      const totalVat = Number(doc.vat_amount);

      // งวดสุดท้ายปัดเศษให้ลงตัวพอดี กันภาษีขายค้างเป็นเศษสตางค์ในบัญชี 2035 ตลอดไป
      const paidAfter = Math.round((alreadyPaid + amount + wht) * 100) / 100;
      const isFinal = paidAfter >= cashDueTotal + Number(doc.wht_amount) - 0.01;
      const recognizedBefore = Math.round(totalVat * (alreadyPaid + (alreadyPaid > 0 ? wht : 0)) / Number(doc.total) * 100) / 100;
      const vatNow = isFinal
        ? Math.round((totalVat - recognizedBefore) * 100) / 100
        : Math.round(totalVat * ((amount + wht) / Number(doc.total)) * 100) / 100;

      if (vatNow > 0) {
        await postJournalOrThrow(svc, shopId, userId, {
          date, memo: `รับรู้ภาษีขายเมื่อรับชำระ (ม.78/1) ${doc.doc_number}`,
          sourceType: "receipt", sourceId: doc.id,
          lines: [
            { code: ACC.VAT_OUT_DEFERRED, debit: vatNow },
            { code: ACC.VAT_OUT, credit: vatNow },
          ],
        });
        // เก็บแยกไว้ให้ ภ.พ.30 หยิบไปใช้ตามเดือนที่รับเงินจริง
        await svc.from("vat_recognitions").insert({
          shop_id: shopId, doc_id: doc.id, recognized_on: date,
          base_amount: Math.round((amount + wht - vatNow) * 100) / 100,
          vat_amount: vatNow,
        });
      }
    }
  } else if (doc.doc_type === "expense") {
    await postJournalOrThrow(svc, shopId, userId, {
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
