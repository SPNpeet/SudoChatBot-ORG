"use server";
// ============================================================
//  ทะเบียนทรัพย์สิน · ค่าเสื่อมราคา · ปิดบัญชีสิ้นปี
//
//  ทั้งสามเรื่องเป็นงานสิ้นงวดที่ระบบเดิมไม่มี ทำให้
//   · ทรัพย์สินไม่ถูกทยอยตัดเป็นค่าใช้จ่าย -> กำไรสูงเกินจริง เสียภาษีเกิน
//   · รายได้/ค่าใช้จ่ายสะสมข้ามปี -> งบดุลผิดตั้งแต่ปีที่สองเป็นต้นไป
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";
import { postJournalOrThrow, ACC, bkkToday } from "@/lib/finance-server";
import { monthlyDepreciation, type AssetForDep } from "@/lib/depreciation";

export type Result = { ok: true; message: string } | { ok: false; error: string };

function friendly(e: unknown, fallback: string): string {
  const m = (e as Error).message ?? String(e);
  if (m.includes("forbidden")) return "คุณไม่มีสิทธิ์ทำรายการนี้";
  return m || fallback;
}

/** เพิ่มทรัพย์สินเข้าทะเบียน + ลงบัญชีซื้อทรัพย์สิน (ถ้าเลือกให้ลง) */
export async function addFixedAsset(shopId: string, formData: FormData): Promise<Result> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    const name = String(formData.get("name") ?? "").trim().slice(0, 200);
    const cost = Number(formData.get("cost"));
    const salvage = Number(formData.get("salvage") ?? 1);
    const acquired = String(formData.get("acquired_on") ?? "").trim();
    const life = Number(formData.get("life_years"));

    if (!name) return { ok: false, error: "ต้องมีชื่อทรัพย์สิน" };
    if (!(cost > 0)) return { ok: false, error: "ราคาทุนต้องมากกว่า 0" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(acquired)) return { ok: false, error: "เลือกวันที่ได้ทรัพย์สินมา" };
    if (!(life > 0)) return { ok: false, error: "ต้องระบุอายุการใช้งาน (ปี)" };
    // ประมวลรัษฎากรให้เหลือราคาซากไว้อย่างน้อย 1 บาทจนกว่าจะจำหน่ายออกไป
    if (salvage < 1) return { ok: false, error: "ราคาซากต้องไม่ต่ำกว่า 1 บาท ตามประมวลรัษฎากร" };
    if (salvage >= cost) return { ok: false, error: "ราคาซากต้องน้อยกว่าราคาทุน" };

    const { error } = await svc.from("fixed_assets").insert({
      shop_id: shopId, name, cost, salvage, acquired_on: acquired,
      life_years: life, note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
      created_by: user.id,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/assets");
    return { ok: true, message: `เพิ่ม ${name} เข้าทะเบียนแล้ว` };
  } catch (e) {
    return { ok: false, error: friendly(e, "เพิ่มทรัพย์สินไม่สำเร็จ") };
  }
}

/**
 * ลงค่าเสื่อมราคาของเดือนที่ระบุ ให้ทรัพย์สินทุกชิ้นที่ยังไม่ครบอายุ
 * กดซ้ำได้ปลอดภัย — ตาราง depreciation_runs มี unique (asset_id, period_month)
 * และเราเช็คก่อนลงทุกครั้ง จึงไม่มีทางลงซ้ำแม้กดรัว ๆ
 */
export async function runDepreciation(shopId: string, month: string): Promise<Result> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin"]);
    if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "เลือกเดือนก่อน" };
    const monthStart = `${month}-01`;

    // ลงค่าเสื่อมของเดือนที่ยังไม่จบไม่ได้ — ตัวเลขจะเปลี่ยนอีกถ้าซื้อ/ขายทรัพย์สินกลางเดือน
    const today = bkkToday();
    const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
      .toISOString().slice(0, 10);
    if (today < nextMonth) return { ok: false, error: "ลงค่าเสื่อมได้เมื่อสิ้นเดือนนั้นผ่านไปแล้ว" };

    const svc = createServiceClient();
    const { data: assetsRaw } = await svc.from("fixed_assets")
      .select("id,name,cost,salvage,acquired_on,life_years,disposed_on")
      .eq("shop_id", shopId).lte("acquired_on", `${month}-31`);
    const assets = (assetsRaw ?? []) as unknown as AssetForDep[];
    if (!assets.length) return { ok: false, error: "ยังไม่มีทรัพย์สินในทะเบียน" };

    const { data: doneRows } = await svc.from("depreciation_runs")
      .select("asset_id,amount,period_month").eq("shop_id", shopId);
    const done = (doneRows ?? []) as { asset_id: string; amount: number; period_month: string }[];

    const alreadyThisMonth = new Set(done.filter((d) => d.period_month === monthStart).map((d) => d.asset_id));
    const takenByAsset = new Map<string, number>();
    for (const d of done) {
      takenByAsset.set(d.asset_id, Math.round(((takenByAsset.get(d.asset_id) ?? 0) + Number(d.amount)) * 100) / 100);
    }

    const rows: { asset: AssetForDep; amount: number }[] = [];
    for (const a of assets) {
      if (alreadyThisMonth.has(a.id)) continue;                 // ลงไปแล้ว ข้าม
      const amt = monthlyDepreciation(a, monthStart, takenByAsset.get(a.id) ?? 0);
      if (amt > 0) rows.push({ asset: a, amount: amt });
    }
    if (!rows.length) return { ok: false, error: `เดือน ${month} ไม่มีค่าเสื่อมต้องลง (ลงครบแล้ว หรือทรัพย์สินหมดอายุแล้ว)` };

    const total = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    // ลงวันสุดท้ายของเดือน ตามแนวปฏิบัติของงานปิดบัญชีรายเดือน
    const entryDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
      .toISOString().slice(0, 10);

    const { entryId } = await postJournalOrThrow(svc, shopId, user.id, {
      date: entryDate, memo: `ค่าเสื่อมราคาประจำเดือน ${month} (${rows.length} รายการ)`,
      sourceType: "manual",
      lines: [
        { code: ACC.DEPRECIATION, debit: total },
        { code: ACC.ACC_DEPRECIATION, credit: total },
      ],
    });

    const { error } = await svc.from("depreciation_runs").insert(rows.map((r) => ({
      shop_id: shopId, asset_id: r.asset.id, period_month: monthStart,
      amount: r.amount, entry_id: entryId,
    })));
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/assets");
    revalidatePath("/dashboard/journal");
    return { ok: true, message: `ลงค่าเสื่อมเดือน ${month} แล้ว ${rows.length} รายการ รวม ${total.toLocaleString()} บาท` };
  } catch (e) {
    return { ok: false, error: friendly(e, "ลงค่าเสื่อมไม่สำเร็จ") };
  }
}

/**
 * ปิดบัญชีสิ้นปี — ล้างยอดบัญชีรายได้และค่าใช้จ่ายทั้งหมดเข้ากำไรสะสม (3020)
 *
 * ถ้าไม่ทำ ยอดในบัญชีรายได้/ค่าใช้จ่ายจะสะสมข้ามปีไปเรื่อย ๆ
 * งบกำไรขาดทุนปีถัดไปจะรวมของปีก่อนมาด้วย และงบดุลไม่มีกำไรสะสม
 */
export async function closeFiscalYear(shopId: string, yearEnd: string): Promise<Result> {
  try {
    const { user } = await assertMember(shopId, ["owner"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(yearEnd)) return { ok: false, error: "เลือกวันสิ้นรอบบัญชี" };
    if (yearEnd >= bkkToday()) return { ok: false, error: "ปิดบัญชีได้เมื่อวันสิ้นรอบผ่านไปแล้ว" };

    const svc = createServiceClient();
    const { data: prev } = await svc.from("fiscal_closes")
      .select("year_end").eq("shop_id", shopId).eq("year_end", yearEnd).maybeSingle();
    if (prev) return { ok: false, error: `ปิดบัญชีรอบสิ้นสุด ${yearEnd} ไปแล้ว` };

    // เริ่มนับจากวันถัดจากรอบที่ปิดล่าสุด ถ้ายังไม่เคยปิดเลยก็นับตั้งแต่เปิดกิจการ
    const { data: last } = await svc.from("fiscal_closes")
      .select("year_end").eq("shop_id", shopId).lt("year_end", yearEnd)
      .order("year_end", { ascending: false }).limit(1).maybeSingle();
    const from = last?.year_end
      ? new Date(new Date(last.year_end + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10)
      : "1900-01-01";

    const { data: lines } = await svc.from("journal_lines")
      .select("debit, credit, chart_of_accounts!inner(code,name,type), journal_entries!inner(entry_date)")
      .eq("shop_id", shopId)
      .gte("journal_entries.entry_date", from)
      .lte("journal_entries.entry_date", yearEnd)
      .in("chart_of_accounts.type", ["income", "expense"]);

    type L = { debit: number; credit: number; chart_of_accounts: { code: string; name: string; type: string } };
    const byAcc = new Map<string, { type: string; net: number }>();
    for (const l of (lines ?? []) as unknown as L[]) {
      const a = l.chart_of_accounts;
      const cur = byAcc.get(a.code) ?? { type: a.type, net: 0 };
      // income: ยอดปกติอยู่ด้านเครดิต · expense: ด้านเดบิต
      cur.net += a.type === "income" ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
      byAcc.set(a.code, cur);
    }

    // กลับด้านทุกบัญชีให้เหลือศูนย์ แล้วส่วนต่างเข้ากำไรสะสม
    const closing: { code: string; debit?: number; credit?: number }[] = [];
    let income = 0, expense = 0;
    for (const [code, v] of byAcc) {
      const amt = Math.round(v.net * 100) / 100;
      if (Math.abs(amt) < 0.005) continue;
      if (v.type === "income") { closing.push({ code, debit: amt }); income += amt; }
      else { closing.push({ code, credit: amt }); expense += amt; }
    }
    if (!closing.length) return { ok: false, error: "รอบบัญชีนี้ไม่มีรายได้หรือค่าใช้จ่ายให้ปิด" };

    const netProfit = Math.round((income - expense) * 100) / 100;
    // กำไร -> เครดิตกำไรสะสม · ขาดทุน -> เดบิตกำไรสะสม
    closing.push(netProfit >= 0
      ? { code: ACC.RETAINED_EARNINGS, credit: netProfit }
      : { code: ACC.RETAINED_EARNINGS, debit: Math.abs(netProfit) });

    const { entryId } = await postJournalOrThrow(svc, shopId, user.id, {
      date: yearEnd,
      memo: `ปิดบัญชีรอบสิ้นสุด ${yearEnd} — ${netProfit >= 0 ? "กำไร" : "ขาดทุน"}สุทธิ ${Math.abs(netProfit).toLocaleString()} บาท`,
      sourceType: "manual",
      lines: closing,
    });

    await svc.from("fiscal_closes").insert({
      shop_id: shopId, year_end: yearEnd, net_profit: netProfit,
      entry_id: entryId, closed_by: user.id,
    });

    revalidatePath("/dashboard/assets");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/journal");
    return {
      ok: true,
      message: `ปิดบัญชีรอบสิ้นสุด ${yearEnd} แล้ว — ${netProfit >= 0 ? "กำไร" : "ขาดทุน"}สุทธิ ${Math.abs(netProfit).toLocaleString()} บาท เข้ากำไรสะสม`,
    };
  } catch (e) {
    return { ok: false, error: friendly(e, "ปิดบัญชีสิ้นปีไม่สำเร็จ") };
  }
}
