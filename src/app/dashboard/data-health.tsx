// ============================================================
//  แถบเตือน "ข้อมูลยังไม่ครบ" บนหน้าภาพรวม
//
//  ทำไมต้องมี: ข้อมูลที่ขาดไม่ได้ทำให้ระบบพัง มันเงียบสนิทจนถึงวันยื่นภาษี
//  แล้วค่อยระเบิดตอนที่แก้ไม่ทัน เช่น
//   · คู่ค้าไม่มีเลขผู้เสียภาษี -> ไฟล์ ภ.ง.ด. ยื่นไม่ได้ รู้ตอนสี่ทุ่มวันที่ 6
//   · กิจการไม่มีเลขผู้เสียภาษี/ที่อยู่ -> ออกใบกำกับภาษีเต็มรูปไม่ได้ตาม ม.86/4
//     ลูกค้านิติบุคคลเอาไปขอคืนภาษีซื้อไม่ได้ ต้องยกเลิก-ออกใหม่ทุกใบ
//   · เอกสารวันที่ผิดปกติ -> หายจากรายงานทุกงวดแต่ยังค้างในยอดลูกหนี้/เจ้าหนี้
//
//  ทั้งหมดนี้ระบบรู้ได้ตั้งแต่วันนี้ จึงต้องบอกตั้งแต่วันนี้ พร้อมลิงก์ไปแก้
//  ไม่ขึ้นอะไรเลยถ้าข้อมูลครบ — แถบเตือนที่ขึ้นตลอดเวลาคนจะเลิกอ่าน
// ============================================================
import Link from "next/link";
import { TriangleAlert, ArrowRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isValidTaxId, docDateTooFarFuture } from "@/lib/tax-th";

interface Issue { text: string; href: string; cta: string }

export default async function DataHealth({ shopId }: { shopId: string }) {
  const svc = createServiceClient();

  const [{ data: shop }, { data: whtDocs }, { data: oddDates }] = await Promise.all([
    svc.from("shops").select("tax_id,billing_name,name,billing_address").eq("id", shopId).maybeSingle(),
    // คู่ค้าที่เราหักภาษีไว้ — ต้องมีเลขผู้เสียภาษีถึงจะยื่น ภ.ง.ด. ได้
    svc.from("fin_docs").select("contact_name,contact_tax_id")
      .eq("shop_id", shopId).eq("doc_type", "expense").gt("wht_amount", 0)
      .not("status", "in", "(draft,void)").limit(500),
    svc.from("fin_docs").select("doc_number,issue_date")
      .eq("shop_id", shopId).not("status", "in", "(draft,void)")
      .order("issue_date", { ascending: false }).limit(200),
  ]);

  const issues: Issue[] = [];
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  // 1) ข้อมูลกิจการที่ ม.86/4 บังคับ
  const missing: string[] = [];
  if (!isValidTaxId(shop?.tax_id)) missing.push("เลขประจำตัวผู้เสียภาษี");
  if (!String(shop?.billing_address ?? "").trim()) missing.push("ที่อยู่");
  if (missing.length) {
    issues.push({
      text: `ข้อมูลกิจการยังไม่ครบ (${missing.join(" · ")}) — ออกใบกำกับภาษีเต็มรูปตามมาตรา 86/4 ไม่ได้ ลูกค้านิติบุคคลจะขอคืนภาษีซื้อไม่ได้`,
      href: "/dashboard/settings", cta: "ไปกรอกข้อมูลกิจการ",
    });
  }

  // 2) คู่ค้าที่หักภาษีไว้แต่เลขผู้เสียภาษีใช้ไม่ได้
  const badPartners = new Set(
    (whtDocs ?? []).filter((d) => !isValidTaxId(d.contact_tax_id))
      .map((d) => d.contact_name ?? "(ไม่มีชื่อ)"),
  );
  if (badPartners.size) {
    const names = [...badPartners].slice(0, 3).join(" · ");
    issues.push({
      text: `${badPartners.size} คู่ค้าที่หักภาษี ณ ที่จ่ายไว้ ยังไม่มีเลขผู้เสียภาษีที่ถูกต้อง (${names}${badPartners.size > 3 ? " และอื่น ๆ" : ""}) — ไฟล์ยื่น ภ.ง.ด. จะไม่ผ่าน`,
      href: "/dashboard/contacts", cta: "ไปแก้ข้อมูลคู่ค้า",
    });
  }

  // 3) เอกสารที่วันที่ผิดปกติ — หายจากรายงานแต่ยังค้างในยอดหนี้
  const odd = (oddDates ?? []).filter((d) => docDateTooFarFuture(d.issue_date, today));
  if (odd.length) {
    issues.push({
      text: `${odd.length} เอกสารลงวันที่ในอนาคตไกลผิดปกติ (${odd.slice(0, 2).map((d) => `${d.doc_number} = ${d.issue_date}`).join(" · ")}) — น่าจะกรอก พ.ศ. ลงช่อง ค.ศ. เอกสารพวกนี้จะไม่โผล่ในรายงานงวดไหนเลย`,
      href: "/dashboard/expenses", cta: "ไปตรวจเอกสาร",
    });
  }

  if (!issues.length) return null;

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        มี {issues.length} เรื่องที่ต้องแก้ก่อนถึงกำหนดยื่นภาษี
      </p>
      <ul className="mt-2 space-y-2">
        {issues.map((i) => (
          <li key={i.href + i.text.slice(0, 20)} className="text-[12px] leading-relaxed text-amber-800">
            {i.text}
            <Link href={i.href}
              className="ml-1 inline-flex items-center gap-0.5 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950">
              {i.cta}<ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
