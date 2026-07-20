import { getCurrentShop } from "@/lib/shop";
import Link from "next/link";
import PlaygroundChat from "./chat";

export const dynamic = "force-dynamic";
// playground วนลูป tool กับ AI หลายรอบ — กัน Vercel ตัด server action กลางคัน
export const maxDuration = 60;

export default async function PlaygroundPage() {
  const { supabase, shop } = await getCurrentShop();
  const [{ data: bot }, { count: productCount }] = await Promise.all([
    supabase.from("bot_settings").select("persona_name").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "active"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">ทดลองบอท</h1>
        <p className="text-sm text-neutral-400">
          คุยกับบอทของร้านคุณเหมือนเป็นลูกค้า — ใช้สินค้า ราคา สต๊อก และคลังความรู้จริง ก่อนเปิดให้ลูกค้าจริงคุย
        </p>
      </div>

      {(productCount ?? 0) === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          ร้านยังไม่มีสินค้า — บอทจะตอบคำถามทั่วไปได้ แต่ยังแนะนำสินค้าไม่ได้{" "}
          <Link href="/dashboard/products" className="font-medium underline">เพิ่มสินค้าชิ้นแรก</Link>{" "}
          แล้วกลับมาทดลองอีกครั้ง
        </p>
      )}

      <PlaygroundChat shopId={shop.id} botName={bot?.persona_name ?? "แอดมิน"} />

      <p className="text-[11px] text-neutral-400">
        หมายเหตุ: โหมดทดลองค้นคลังความรู้แบบคีย์เวิร์ด (ระบบจริงบนแชทลูกค้าใช้ semantic search แม่นกว่า) ·
        ออเดอร์ในโหมดนี้เป็นการจำลอง ไม่ถูกบันทึกและไม่ตัดสต๊อก
      </p>
    </div>
  );
}
