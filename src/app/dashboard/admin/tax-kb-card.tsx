// ============================================================
//  ทางเข้าคลังความรู้ภาษี + สถานะว่าคลังพร้อมใช้แค่ไหน
//
//  ⚠️ ตัวเลข "ยังไม่มีเวกเตอร์" ต้องเห็นจากหน้าแอดมินโดยไม่ต้องกดเข้าไปดู
//     เพราะคลังที่ไม่มีเวกเตอร์ยังตอบได้ แต่ตอบได้แคบกว่ามาก (ค้นเจอเฉพาะคำที่ตรงตัว)
//     ถ้าไม่โชว์ตรงนี้ จะไม่มีใครรู้ว่าฟีเจอร์ทำงานได้แค่ครึ่งเดียว
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, ACTION_CHIP } from "@/components/ui";
import { BookOpen, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function TaxKbCard() {
  const svc = createServiceClient();
  const { count: total } = await svc.from("tax_knowledge")
    .select("id", { count: "exact", head: true });
  const { count: missing } = await svc.from("tax_knowledge")
    .select("id", { count: "exact", head: true }).is("embedding", null);

  const n = total ?? 0;
  const m = missing ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-600" /> คลังความรู้ภาษี (ผู้ช่วย AI ใช้ตอบทุกกิจการ)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {n === 0 ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <b>คลังว่าง</b> — ผู้ช่วย AI จะตอบว่า &ldquo;ไม่มีข้อมูลยืนยัน&rdquo; ทุกคำถามกฎหมายภาษี
          </div>
        ) : (
          <p className="text-2xl font-bold tracking-tight">
            {n} เรื่อง
            <span className="ml-2 text-sm font-normal text-neutral-400">พร้อมให้ผู้ช่วยอ้างอิง</span>
          </p>
        )}

        {m > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>{m} เรื่องยังไม่มีเวกเตอร์</b> — ค้นได้เฉพาะเมื่อผู้ใช้พิมพ์คำใกล้เคียงของจริง
              ถามด้วยคำอื่นจะหาไม่เจอ กดเข้าไปสร้างเวกเตอร์ได้ในหน้าจัดการ
            </span>
          </p>
        )}

        <Link href="/dashboard/admin/tax-kb" className={ACTION_CHIP}>จัดการคลังความรู้ภาษี</Link>
      </CardContent>
    </Card>
  );
}
