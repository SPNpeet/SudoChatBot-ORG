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
                <p className={`mt-0.5 break-words text-[11px] leading-relaxed ${
                  r.severity === "critical" ? "text-red-600" : "text-amber-700"}`}>
                  {r.detail}
                </p>
              )}
            </div>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-neutral-400">
            ระบบตรวจอย่างเดียว ไม่แก้ข้อมูลให้เอง — การซ่อมอัตโนมัติในงานบัญชี
            อันตรายกว่าให้คนเห็นแล้วตัดสินใจ
          </p>
        </CardContent>
      )}
    </Card>
  );
}
