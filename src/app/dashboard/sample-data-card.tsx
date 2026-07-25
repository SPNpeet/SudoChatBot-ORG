"use client";
// การ์ด "ลองด้วยข้อมูลตัวอย่าง" — โชว์เฉพาะตอนกิจการยังว่างเปล่า
// พอมีข้อมูลตัวอย่างแล้วเปลี่ยนเป็นแถบเตือน + ปุ่มล้าง (กันสับสนว่าตัวเลขจริงหรือปลอม)
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui";
import { seedSampleData, clearSampleData } from "./sample-data-actions";

export default function SampleDataCard({ shopId, hasSample, isEmpty }: {
  shopId: string; hasSample: boolean; isEmpty: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function seed() {
    setError(null);
    start(async () => {
      const r = await seedSampleData(shopId);
      if (r.ok) router.refresh(); else setError(r.error);
    });
  }
  function clear() {
    setError(null);
    start(async () => {
      const r = await clearSampleData(shopId);
      if (r.ok) router.refresh(); else setError(r.error ?? "ล้างไม่สำเร็จ");
    });
  }

  if (hasSample) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-amber-900">
          <FlaskConical className="h-4 w-4 shrink-0" />
          <span><b>กำลังดูข้อมูลตัวอย่าง</b> — ตัวเลขที่เห็นยังไม่ใช่ของจริง ลองกดดูได้ทุกเมนู</span>
        </p>
        <Button size="sm" variant="outline" onClick={clear} disabled={pending}>
          <Trash2 className="h-3.5 w-3.5" /> {pending ? "กำลังล้าง..." : "ล้างข้อมูลตัวอย่าง"}
        </Button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (!isEmpty) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
        <Sparkles className="h-4 w-4 text-emerald-600" /> อยากเห็นก่อนว่าระบบทำงานยังไง?
      </p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        กดปุ่มเดียว ระบบจะใส่ตัวอย่างให้ครบวงจร — ใบแจ้งหนี้ค้างรับ ใบเสร็จขายสด ค่าเช่า และบิลค้างจ่าย
        แล้วคุณจะเห็นสมุดรายวัน ยอดค้าง กราฟเงินเข้า-ออก และรายงานภาษีทำงานจริงทันที · ล้างทิ้งได้ทุกเมื่อ
      </p>
      <Button variant="brand" size="sm" className="mt-3" onClick={seed} disabled={pending}>
        <Sparkles className="h-3.5 w-3.5" /> {pending ? "กำลังสร้าง..." : "ลองด้วยข้อมูลตัวอย่าง"}
      </Button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
