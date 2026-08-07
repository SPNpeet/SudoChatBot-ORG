// ============================================================
//  ยามเฝ้าความถูกต้องทางบัญชี — แสดงผลสด ไม่ใช่รายงานที่ตรวจครั้งเดียวแล้วจบ
//
//  ทำไมต้องมี: ตอนตรวจระบบเมื่อ 29 ก.ค. 2569 ผมเขียน SQL ไล่ตรวจ 11 ข้อด้วยมือ
//  ผ่านหมด — แต่นั่นคือ "ภาพนิ่ง" ลูกค้าบันทึกข้อมูลเข้ามาทุกวัน
//  ถ้าวันไหนบัญชีเพี้ยนจะไม่มีใครรู้จนกว่าจะมีคนมานั่งตรวจอีกรอบ
//  ซึ่งมักเป็นตอนใกล้ยื่นภาษีและแก้ไม่ทันแล้ว
//
//  การ์ดนี้เรียก RPC accounting_integrity() ทุกครั้งที่เปิดหน้า
//  ทำให้การตรวจกลายเป็นของที่ทำได้ตลอดเวลา ไม่ใช่ต้องรอให้ใครมาตรวจให้
//
//  ⚠️ ตรวจอย่างเดียว ไม่แก้ข้อมูลเอง — การซ่อมอัตโนมัติในระบบบัญชี
//     อันตรายกว่าปล่อยให้คนเห็นแล้วตัดสินใจ
// ============================================================
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ShieldCheck, TriangleAlert, CircleAlert } from "lucide-react";

interface Row {
  code: string;
  severity: "critical" | "warning";
  title: string;
  bad_count: number;
  detail: string;
}

/**
 * วิธีแก้ที่ปลอดภัยของแต่ละอาการ
 *
 * ทำไมต้องเขียนไว้: การ์ดที่บอกแค่ว่า "มีปัญหา" จะทำให้คนไปแก้ด้วยวิธีที่เร็วที่สุด
 * ซึ่งมักเป็นการรัน SQL แก้ตัวเลขในตารางตรง ๆ เพื่อให้คำเตือนหาย
 * นั่นคือทางที่อันตรายที่สุด เพราะแก้เอกสารแล้วสมุดรายวันไม่เปลี่ยนตาม
 * เอกสารกับบัญชีจะแยกกันทันที และไม่มีร่องรอยว่าใครแก้
 * เป้าหมายคือ "บัญชีถูก" ไม่ใช่ "คำเตือนหาย"
 */
const HOW_TO_FIX: Record<string, string> = {
  doc_total: "เปิดเอกสารแล้วกดยกเลิก จากนั้นออกใบใหม่ให้ถูกต้อง — ห้ามแก้ยอดในฐานข้อมูลตรง ๆ เพราะสมุดรายวันจะไม่เปลี่ยนตาม",
  vat_rate: "ตรวจว่าอัตรา VAT ในตารางตรงกับประกาศ ณ วันที่ออกเอกสารไหม ถ้าเอกสารผิดให้ยกเลิกแล้วออกใหม่",
  wht_base: "ยกเลิกเอกสารแล้วออกใหม่ โดยกรอกอัตราหัก ณ ที่จ่ายให้ถูก — ระบบคิดฐานจากยอดก่อน VAT ให้เอง",
  jv_balance: "แจ้งผู้ดูแลระบบทันที ห้ามแก้เอง — เดบิตไม่เท่าเครดิตแปลว่ามีข้อผิดพลาดระดับโปรแกรม",
  missing_jv: "แจ้งผู้ดูแลระบบ — เอกสารออกแล้วแต่ไม่ลงบัญชี ต้องตรวจว่าการลงบัญชีล้มเหลวตอนไหน",
  void_no_reversal: "แจ้งผู้ดูแลระบบ — เอกสารถูกยกเลิกแต่ไม่มีรายการกลับบัญชี ยอดในงบจะเกินจริง",
  dup_doc_number: "แจ้งผู้ดูแลระบบ — เลขที่ซ้ำเป็นเรื่องแรกที่สรรพากรถามเวลาตรวจ",
  vat_report_vs_gl: "แจ้งผู้ดูแลระบบ — รายงานภาษีไม่ตรงสมุดรายวัน ห้ามใช้ตัวเลขนี้ยื่นภาษีจนกว่าจะแก้",
  odd_date: "เปิดเอกสารแล้วกดยกเลิก จากนั้นบันทึกใหม่ด้วยวันที่ที่ถูกต้อง (พ.ศ. 2569 = ค.ศ. 2026) — ห้ามแก้วันที่ในฐานข้อมูลตรง ๆ",
  wht_bad_taxid: "ไปที่หน้าผู้ติดต่อ แก้เลขประจำตัวผู้เสียภาษีให้ถูก แล้วยกเลิก-ออกเอกสารใหม่เพื่อให้เลขที่ติดอยู่กับเอกสารอัปเดตตาม",
  vat_rate_expired: "ตรวจราชกิจจานุเบกษาว่ามี พ.ร.ฎ. ฉบับใหม่หรือยัง แล้วเพิ่มแถวใหม่ในตารางอัตรา VAT",
};

export default async function IntegrityCard({ shopId }: { shopId?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("accounting_integrity", { p_shop_id: shopId ?? null });
  const rows = (data ?? []) as Row[];
  if (!rows.length) return null;

  const bad = rows.filter((r) => Number(r.bad_count) > 0);
  const critical = bad.filter((r) => r.severity === "critical");
  const warn = bad.filter((r) => r.severity === "warning");
  const allOk = bad.length === 0;

  return (
    <Card className={critical.length ? "border-red-300" : warn.length ? "border-amber-300" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {allOk ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
            : critical.length ? <CircleAlert className="h-4 w-4 text-red-600" />
              : <TriangleAlert className="h-4 w-4 text-amber-600" />}
          ความถูกต้องทางบัญชี
        </CardTitle>
        <p className="mt-1 text-xs font-normal text-neutral-500">
          {allOk
            ? `ตรวจ ${rows.length} ข้อ ผ่านทั้งหมด — ยอดเอกสาร · อัตรา VAT · ฐานหัก ณ ที่จ่าย · เดบิต=เครดิต · เลขเอกสารไม่ซ้ำ · รายงานตรงสมุดรายวัน`
            : `ตรวจ ${rows.length} ข้อ พบต้องแก้ ${bad.length} ข้อ`}
        </p>
      </CardHeader>

      {!allOk && (
        <CardContent className="space-y-2">
          {[...critical, ...warn].map((r) => (
            <div key={r.code}
              className={`rounded-xl border px-3 py-2.5 ${
                r.severity === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
              }`}>
              <p className={`text-[13px] font-bold ${r.severity === "critical" ? "text-red-700" : "text-amber-800"}`}>
                {r.severity === "critical" ? "ต้องแก้ทันที" : "ควรตรวจ"} · {r.title} ({r.bad_count})
              </p>
              {r.detail && (
                <p className={`mt-0.5 break-words text-xs leading-relaxed ${
                  r.severity === "critical" ? "text-red-600" : "text-amber-700"}`}>
                  {r.detail}
                </p>
              )}
              {HOW_TO_FIX[r.code] && (
                <p className={`mt-1.5 text-xs leading-relaxed ${
                  r.severity === "critical" ? "text-red-700" : "text-amber-800"}`}>
                  <b>วิธีแก้ที่ปลอดภัย:</b> {HOW_TO_FIX[r.code]}
                </p>
              )}
            </div>
          ))}
          <p className="pt-1 text-xs leading-relaxed text-neutral-400">
            ระบบตรวจอย่างเดียว ไม่แก้ข้อมูลให้เอง — การซ่อมอัตโนมัติในงานบัญชี
            อันตรายกว่าให้คนเห็นแล้วตัดสินใจ · <b>ห้ามแก้ตัวเลขในฐานข้อมูลตรง ๆ
            เพื่อให้คำเตือนหาย</b> เพราะเอกสารจะไม่ตรงกับสมุดรายวันและไม่มีร่องรอยการแก้
          </p>
        </CardContent>
      )}
    </Card>
  );
}
