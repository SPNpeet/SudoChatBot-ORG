import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Table, Th, Td } from "@/components/ui";
import { dateTH, DOC_STATUS_TH } from "@/lib/utils";
import UploadForm from "./upload-form";
import AddTextForm from "./add-text-form";
import DeleteDocButton from "./delete-doc-button";
import KnowledgeLive from "./knowledge-live";
import type { KnowledgeDocument } from "@/lib/types/db";
import { FileText, Image as ImageIcon, Type } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = role === "owner" || role === "admin";
  const { data } = await supabase.from("knowledge_documents")
    .select("*").eq("shop_id", shop.id).order("created_at", { ascending: false });
  const docs = (data ?? []) as KnowledgeDocument[];

  const icons: Record<string, typeof FileText> = { pdf: FileText, image: ImageIcon, text: Type, faq: Type };

  return (
    <div className="space-y-5">
      <KnowledgeLive shopId={shop.id} />
      <div>
        <h1 className="text-xl font-bold">คลังความรู้ของบอท</h1>
        <p className="text-sm text-neutral-400">อัปโหลดข้อมูลร้าน นโยบาย FAQ — ระบบจะ OCR อ่านและสอนบอทอัตโนมัติ</p>
      </div>

      {canEdit ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>อัปโหลดไฟล์ (PDF / รูปภาพ)</CardTitle></CardHeader>
            <CardContent><UploadForm shopId={shop.id} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>เพิ่มข้อความ / FAQ โดยตรง</CardTitle></CardHeader>
            <CardContent><AddTextForm shopId={shop.id} /></CardContent>
          </Card>
        </div>
      ) : (
        <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          คุณดูคลังความรู้ได้ แต่เพิ่ม/ลบได้เฉพาะเจ้าของ/ผู้ดูแลร้าน
        </p>
      )}

      <Card>
        <CardHeader><CardTitle>เอกสารทั้งหมด ({docs.length})</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {docs.length === 0 ? (
            <EmptyState title="ยังไม่มีข้อมูลในคลังความรู้" hint="บอทจะตอบได้เฉพาะข้อมูลสินค้า จนกว่าคุณจะเพิ่มข้อมูลร้านที่นี่" />
          ) : (
            <Table>
              <thead><tr><Th>เอกสาร</Th><Th>สถานะ</Th><Th>ความรู้</Th><Th>เพิ่มเมื่อ</Th>{canEdit && <Th />}</tr></thead>
              <tbody>
                {docs.map((d) => {
                  const Icon = icons[d.source_type] ?? FileText;
                  return (
                    <tr key={d.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-neutral-400" />
                          <div>
                            <p className="max-w-72 truncate font-medium">{d.title}</p>
                            {d.error && <p className="max-w-72 truncate text-[11px] text-red-500">{d.error}</p>}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={d.status === "ready" ? "green" : d.status === "failed" ? "red" : "amber"}>
                          {DOC_STATUS_TH[d.status] ?? d.status}
                        </Badge>
                      </Td>
                      <Td className="text-neutral-500">{d.chunk_count > 0 ? `${d.chunk_count} ท่อน${d.page_count ? ` · ${d.page_count} หน้า` : ""}` : "-"}</Td>
                      <Td className="text-neutral-400">{dateTH(d.created_at)}</Td>
                      {canEdit && <Td><DeleteDocButton docId={d.id} shopId={shop.id} /></Td>}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
