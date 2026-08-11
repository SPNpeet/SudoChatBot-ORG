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
//
//  ⚠️ นับในฐานข้อมูล ไม่ดึงแถวออกมานับที่นี่
//  หน้านี้เปิดบ่อยที่สุดในระบบ เวอร์ชันแรกดึงเอกสารมาถึง 700 แถวทุกครั้ง
//  เพื่อจะได้ตัวเลข 3 ตัว พอร้านมีเอกสารหลักพันจะกินแบนด์วิดท์ฟรี ๆ ทุกการเปิดหน้า
// ============================================================
import Link from "next/link";
import { TriangleAlert, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTION_CHIP } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

interface Health {
  tax_id_ok: boolean;
  address_ok: boolean;
  bad_partners: number;
  partner_names: string;
  odd_dates: number;
  odd_list: string;
  error?: string;
}

interface Issue { text: string; href: string; cta: string }

export default async function DataHealth({ shopId }: { shopId: string }) {
  // ใช้ client ของผู้ใช้ (ไม่ใช่ service role) — ฟังก์ชันเช็คสมาชิกภาพเองอีกชั้น
  const supabase = await createClient();
  const { data } = await supabase.rpc("shop_data_health", { p_shop_id: shopId });
  const h = data as Health | null;
  if (!h || h.error) return null;

  const issues: Issue[] = [];

  const missing: string[] = [];
  if (!h.tax_id_ok) missing.push("เลขประจำตัวผู้เสียภาษี");
  if (!h.address_ok) missing.push("ที่อยู่");
  if (missing.length) {
    issues.push({
      text: `ข้อมูลกิจการยังไม่ครบ (${missing.join(" · ")}) — ออกใบกำกับภาษีเต็มรูปตามมาตรา 86/4 ไม่ได้ ลูกค้านิติบุคคลจะขอคืนภาษีซื้อไม่ได้`,
      href: "/dashboard/settings", cta: "ไปกรอกข้อมูลกิจการ",
    });
  }

  if (h.bad_partners > 0) {
    issues.push({
      text: `${h.bad_partners} คู่ค้าที่หักภาษี ณ ที่จ่ายไว้ ยังไม่มีเลขผู้เสียภาษีที่ถูกต้อง (${h.partner_names}) — ไฟล์ยื่น ภ.ง.ด. จะไม่ผ่าน`,
      href: "/dashboard/contacts", cta: "ไปแก้ข้อมูลคู่ค้า",
    });
  }

  if (h.odd_dates > 0) {
    issues.push({
      text: `${h.odd_dates} เอกสารลงวันที่ในอนาคตไกลผิดปกติ (${h.odd_list}) — น่าจะกรอก พ.ศ. ลงช่อง ค.ศ. เอกสารพวกนี้จะไม่โผล่ในรายงานงวดไหนเลย`,
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
          <li key={i.cta} className="text-[12px] leading-relaxed text-amber-800">
            {i.text}
            {/* ปุ่มจริง — เรื่องที่กระทบภาษีต้องกดง่าย ไม่ใช่ข้อความขีดเส้นใต้กลางย่อหน้า */}
            <Link href={i.href} className={cn(ACTION_CHIP, "ml-1.5 border-amber-300 text-amber-900 hover:text-amber-950")}>
              {i.cta}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
