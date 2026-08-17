// ============================================================
//  คลังความรู้ภาษี — หน้าจัดการของผู้ดูแลแพลตฟอร์ม
//
//  ทำไมต้องเป็นหน้าแยก ไม่ใช่การ์ดในหน้าแอดมิน:
//  เนื้อหาแต่ละเรื่องยาวหลายบรรทัดและต้องแก้บ่อยเมื่อมีประกาศใหม่
//  ยัดเป็นการ์ดเล็ก ๆ ในหน้าที่มีของอย่างอื่นเต็มไปหมด = แก้ลำบากจนไม่มีใครแก้
// ============================================================
import { requireUser } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, EmptyState } from "@/components/ui";
import { effectiveLabel } from "@/lib/tax-kb";
import TaxKbManager, { type TaxKbRow } from "./manager";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaxKbPage() {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-500" /> เฉพาะผู้ดูแลแพลตฟอร์ม
        </CardTitle></CardHeader>
        <CardContent className="text-sm text-neutral-500">
          หน้านี้แก้ความรู้ภาษีที่ผู้ช่วย AI ใช้ตอบทุกกิจการ จึงเปิดให้เฉพาะผู้ดูแลแพลตฟอร์ม
        </CardContent>
      </Card>
    );
  }

  const svc = createServiceClient();
  const { data } = await svc.from("tax_knowledge")
    .select("id,topic,content,citation,source_url,effective_from,effective_to,tags,keywords,embedding")
    .order("topic");

  const rows: TaxKbRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    topic: r.topic as string,
    content: r.content as string,
    citation: r.citation as string,
    source_url: (r.source_url as string | null) ?? null,
    effective_from: r.effective_from as string,
    effective_to: (r.effective_to as string | null) ?? null,
    tags: (r.tags as string[] | null) ?? [],
    keywords: (r.keywords as string | null) ?? "",
    has_vector: r.embedding != null,
    effective_label: effectiveLabel(r.effective_from as string, (r.effective_to as string | null) ?? null),
  }));

  const missing = rows.filter((r) => !r.has_vector).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="คลังความรู้ภาษี"
        lead={rows.length === 0
          ? "ยังไม่มีความรู้ในคลัง"
          : <>{rows.length} เรื่อง{missing > 0 && <> · <b>{missing}</b> เรื่องยังไม่มีเวกเตอร์</>}</>}
        help="ผู้ช่วย AI ค้นคลังนี้ก่อนตอบคำถามกฎหมายภาษีทุกครั้ง และต้องอ้างที่มาที่ระบุไว้ · ค้นไม่เจอ ผู้ช่วยจะบอกผู้ใช้ว่าไม่มีข้อมูลยืนยัน ไม่เดาเอง · ความรู้ที่พ้นวันสิ้นสุดแล้วจะไม่ถูกค้นเจอโดยอัตโนมัติ"
        back={{ href: "/dashboard/admin", label: "ผู้ดูแลระบบ" }}
      />

      <Card>
        <CardContent className="pt-6 text-sm text-neutral-600">
          <p className="font-medium">ของแบบไหนควรอยู่ที่นี่</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-neutral-500">
            <li>ประกาศ/กฎที่ <b>มีวันเริ่มและอาจมีวันหมดอายุ</b> เช่น อัตราที่ลดเป็นคราว ๆ การขยายเวลายื่น</li>
            <li>คำอธิบายที่ผู้ใช้ถามบ่อยและต้อง <b>อ้างมาตราได้</b></li>
          </ul>
          <p className="mt-3 font-medium">ของแบบไหน <b>ไม่</b> ควรอยู่ที่นี่</p>
          <p className="mt-1 text-neutral-500">
            กฎถาวรที่โค้ดใช้คำนวณ (อัตรา VAT ที่ใช้ออกเอกสาร · ประเภทเงินได้ ม.40 · กติกา ม.86/4)
            อยู่ใน <code className="rounded bg-neutral-100 px-1">src/lib/tax-th.ts</code> แก้ที่นั่นแล้ว deploy
            เพราะตัวเลขพวกนั้นถูกเอาไปคำนวณจริง ไม่ใช่แค่เอาไปเล่าให้ฟัง
          </p>
        </CardContent>
      </Card>

      <TaxKbManager rows={rows} missingVectors={missing} />

      {rows.length === 0 && (
        <Card><CardContent className="pt-6">
          <EmptyState title="คลังว่าง" hint="ผู้ช่วย AI จะตอบว่าไม่มีข้อมูลยืนยันทุกคำถามกฎหมายภาษี จนกว่าจะมีเนื้อหาที่นี่" />
        </CardContent></Card>
      )}
    </div>
  );
}
