// ============================================================
//  สิ่งที่ผู้ช่วยจำ (Business Memory) — หน้าโปร่งใสของความจำ AI (31 ส.ค. 2569)
//
//  ทำไมต้องมีหน้านี้: ความจำที่ผู้ใช้มองไม่เห็นคือความจำที่ไว้ใจไม่ได้
//  ทุกอย่างที่ AI "จำเอง" ต้องโผล่ที่นี่พร้อมป้ายบอกที่มา แก้/ปิด/ลบได้ทันที
//  (PDPA: ความจำมีชื่อลูกค้า/เงื่อนไขได้ ต้องคุมได้จากที่เดียว)
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { PageHeader } from "@/components/ui";
import { Brain } from "lucide-react";
import { MEMORY_MAX_PER_SHOP, type BusinessMemory } from "@/lib/business-memory";
import MemoryList from "./memory-list";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const { supabase, shop } = await getCurrentShop();
  const { data } = await supabase.from("business_memories").select("*")
    .eq("shop_id", shop.id).order("active", { ascending: false }).order("updated_at", { ascending: false });
  const list = (data ?? []) as BusinessMemory[];
  const active = list.filter((m) => m.active).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader icon={Brain} tone="emerald"
        title="สิ่งที่ผู้ช่วยจำ"
        lead={<>จำอยู่ <b className="text-neutral-900">{active}</b> เรื่อง จาก {MEMORY_MAX_PER_SHOP} — ใช้เป็นบริบทตอนสั่งงาน ไม่ต้องบอกซ้ำทุกครั้ง</>}
        help="พิมพ์ในแชทว่า “จำไว้ว่า ร้าน A เครดิต 30 วัน” ผู้ช่วยจะจดไว้ที่นี่ หรือเพิ่มเองด้านล่างก็ได้ · ความจำเป็นแค่ข้อมูลประกอบ ผู้ช่วยจะไม่ออกเอกสารหรือจ่ายเงินเองจากความจำ · รายการที่ AI จำเองมีป้ายบอก ถ้าไม่ถูกให้แก้หรือลบได้เลย"
        back={{ href: "/dashboard/assistant", label: "กลับไปผู้ช่วย AI" }}
      />
      <MemoryList shopId={shop.id} items={list} />
    </div>
  );
}
