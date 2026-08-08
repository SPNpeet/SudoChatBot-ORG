"use client";
// ปุ่มเดียวได้ทุกรายงานของงวดในไฟล์เดียว — ส่งต่อสำนักงานบัญชีได้ทันที
// เดิมต้องเข้าไปทีละแท็บแล้วโหลดทีละไฟล์ แล้วส่งอีเมล 5 ไฟล์ ซึ่งตกหล่นง่าย
import { useState } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { saveBlob } from "@/lib/download";
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
      // ⚠️ ห้ามเขียนขั้นตอนโหลดเองตรงนี้ — เดิมเขียนเองแล้ว revoke URL ทันทีหลัง click
      // ทำให้บนมือถือกดแล้วเงียบสนิททุกครั้ง (ดู src/lib/download.ts)
      saveBlob(await res.blob(), name);
      toast({ tone: "success", text: "โหลดไฟล์แล้ว — ส่งต่อให้นักบัญชีได้เลย" });
    } catch {
      toast({ tone: "error", text: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  // ⚠️ เดิมเป็นการ์ดเขียวเต็มความกว้าง 2 บรรทัดอยู่เหนือทุกแท็บ (แก้ 8 ส.ค. 2569)
  // เจ้าของบอกว่าหน้ารายงาน "ใหญ่มากๆ ดูรกสุดๆ" และ "โหลดให้ง่ายหน่อย"
  // ปุ่มโหลดคือสิ่งที่คนมาหน้านี้มาทำ จึงต้องเป็น "ปุ่ม" ที่เห็นทันที
  // ไม่ใช่กล่องโฆษณาที่ต้องอ่านคำอธิบาย 2 บรรทัดก่อนถึงจะเจอปุ่ม
  // รายละเอียดว่ามีแผ่นอะไรบ้างย้ายไปอยู่ใน title ของปุ่ม (hover อ่านได้)
  return (
    <Button variant="brand" onClick={download} disabled={busy} className="shrink-0"
      title="ไฟล์ Excel เดียวครบทั้งงวด — ภาษีขาย · ภาษีซื้อ · หัก ณ ที่จ่าย · สมุดรายวัน · งบทดลอง · ยอดค้าง พร้อมแท็บอธิบายแต่ละแผ่น">
      {busy ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังรวมไฟล์…</> : <><FileSpreadsheet className="h-4 w-4" />โหลดชุดส่งนักบัญชี</>}
    </Button>
  );
}
