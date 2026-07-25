"use client";
// ปุ่มเดียวได้ทุกรายงานของงวดในไฟล์เดียว — ส่งต่อสำนักงานบัญชีได้ทันที
// เดิมต้องเข้าไปทีละแท็บแล้วโหลดทีละไฟล์ แล้วส่งอีเมล 5 ไฟล์ ซึ่งตกหล่นง่าย
import { useState } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { FileSpreadsheet, Loader2 } from "lucide-react";

export default function AccountantPackage({ period }: { period: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function download() {
    if (busy) return;                       // กันกดรัวจนได้ไฟล์ซ้ำ
    setBusy(true);
    try {
      const res = await fetch(`/api/sheet/accountant?period=${encodeURIComponent(period)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast({ tone: "error", text: j?.error ?? "สร้างไฟล์ไม่สำเร็จ" });
        return;
      }
      // ชื่อไฟล์มาจากเซิร์ฟเวอร์ (มีชื่อกิจการกับงวดอยู่แล้ว)
      const name = decodeURIComponent(
        res.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''(.+)$/)?.[1] ?? "ชุดส่งสำนักงานบัญชี.xlsx",
      );
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ tone: "success", text: "โหลดไฟล์แล้ว — ส่งต่อให้นักบัญชีได้เลย" });
    } catch {
      toast({ tone: "error", text: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">ส่งให้สำนักงานบัญชี</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-600">
            ได้ไฟล์ Excel เดียวครบทั้งงวด — ภาษีขาย · ภาษีซื้อ · หัก ณ ที่จ่าย · สมุดรายวัน · งบทดลอง · ยอดค้าง
            พร้อมแท็บอธิบายว่าแต่ละแผ่นคืออะไร
          </p>
        </div>
        <Button variant="brand" onClick={download} disabled={busy} className="shrink-0">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังรวมไฟล์…</> : <><FileSpreadsheet className="h-4 w-4" />ดาวน์โหลดชุดส่งนักบัญชี</>}
        </Button>
      </div>
    </div>
  );
}
