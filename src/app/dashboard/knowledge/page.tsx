import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, Table, Th, Td, Textarea } from "@/components/ui";
import { dateTH, DOC_STATUS_TH } from "@/lib/utils";
import { addKnowledgeText, uploadKnowledgeFile, deleteDocument } from "../actions";
import type { KnowledgeDocument } from "@/lib/types/db";
import { FileText, Image as ImageIcon, Type } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const { supabase, shop } = await getCurrentShop();
  const { data } = await supabase.from("knowledge_documents")
    .select("*").eq("shop_id", shop.id).order("created_at", { ascending: false });
  const docs = (data ?? []) as KnowledgeDocument[];

  async function addText(formData: FormData) {
    "use server";
    await addKnowledgeText(String(formData.get("shop_id")), formData);
  }
  async function upload(formData: FormData) {
    "use server";
    await uploadKnowledgeFile(String(formData.get("shop_id")), formData);
  }
  async function remove(formData: FormData) {
    "use server";
    await deleteDocument(String(formData.get("doc_id")), String(formData.get("shop_id")));
  }

  const icons: Record<string, typeof FileText> = { pdf: FileText, image: ImageIcon, text: Type, faq: Type };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">คลังความรู้ของบอท</h1>
        <p className="text-sm text-neutral-400">อัปโหลดข้อมูลร้าน นโยบาย FAQ — ระบบจะ OCR อ่านและสอนบอทอัตโนมัติ</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>อัปโหลดไฟล์ (PDF / รูปภาพ)</CardTitle></CardHeader>
          <CardContent>
            <form action={upload} className="space-y-3">
              <input type="hidden" name="shop_id" value={shop.id} />
              <input
                type="file" name="file" required accept="application/pdf,image/*"
                className="block w-full rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              />
              <p className="text-[11px] text-neutral-400">เช่น โปรไฟล์บริษัท, นโยบายคืนสินค้า, เมนู/แคตตาล็อก (สูงสุด 20MB) — OCR อ่านไทย/อังกฤษ</p>
              <Button size="sm">อัปโหลดและสอนบอท</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>เพิ่มข้อความ / FAQ โดยตรง</CardTitle></CardHeader>
          <CardContent>
            <form action={addText} className="space-y-3">
              <input type="hidden" name="shop_id" value={shop.id} />
              <div><Label>หัวข้อ</Label><Input name="title" required placeholder="เช่น เวลาทำการและที่อยู่ร้าน" /></div>
              <div><Label>เนื้อหา</Label><Textarea name="text" required placeholder={"ถาม: ร้านเปิดกี่โมง\nตอบ: ทุกวัน 9:00-20:00 น."} /></div>
              <Button size="sm">บันทึกเข้าคลังความรู้</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>เอกสารทั้งหมด ({docs.length})</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {docs.length === 0 ? (
            <EmptyState title="ยังไม่มีข้อมูลในคลังความรู้" hint="บอทจะตอบได้เฉพาะข้อมูลสินค้า จนกว่าคุณจะเพิ่มข้อมูลร้านที่นี่" />
          ) : (
            <Table>
              <thead><tr><Th>เอกสาร</Th><Th>สถานะ</Th><Th>ความรู้</Th><Th>เพิ่มเมื่อ</Th><Th /></tr></thead>
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
                      <Td>
                        <form action={remove} className="text-right">
                          <input type="hidden" name="doc_id" value={d.id} />
                          <input type="hidden" name="shop_id" value={shop.id} />
                          <button className="text-xs text-neutral-400 hover:text-red-600">ลบ</button>
                        </form>
                      </Td>
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
