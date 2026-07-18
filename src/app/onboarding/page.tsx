import { requireUser } from "@/lib/shop";
import { redirect } from "next/navigation";
import { Input, Label, Textarea } from "@/components/ui";
import SubmitButton from "./submit-button";

async function createShop(formData: FormData) {
  "use server";
  const { supabase, user } = await requireUser();
  // กันสร้างซ้ำ: ถ้ามีร้านอยู่แล้ว (กดปุ่มรัว/เข้าหน้านี้ซ้ำ) ให้เข้าแดชบอร์ดเลย
  const { data: existing } = await supabase.from("shop_members")
    .select("id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing) redirect("/dashboard");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("shops").insert({
    owner_id: user.id,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  redirect("/dashboard");
}

export default async function Onboarding() {
  const { supabase, user } = await requireUser();
  // มีร้านแล้วไม่ต้องเห็นหน้านี้อีก
  const { data: existing } = await supabase.from("shop_members")
    .select("id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form action={createShop} className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8">
        <h1 className="text-lg font-bold">สร้างร้านของคุณ</h1>
        <p className="mt-1 text-sm text-neutral-500">ข้อมูลนี้จะช่วยให้ AI แนะนำตัวกับลูกค้าได้ถูกต้อง</p>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">ชื่อร้าน *</Label>
            <Input id="name" name="name" required placeholder="เช่น ร้านครีมใสเกาหลี" />
          </div>
          <div>
            <Label htmlFor="description">แนะนำร้านสั้นๆ</Label>
            <Textarea id="description" name="description" placeholder="ขายอะไร จุดเด่นคืออะไร ส่งจากที่ไหน" />
          </div>
        </div>
        <SubmitButton pendingText="กำลังสร้างร้าน...">สร้างร้านและเข้าแดชบอร์ด</SubmitButton>
      </form>
    </main>
  );
}
