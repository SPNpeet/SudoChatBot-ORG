// ============================================================
//  เตือนเมื่ออัตรา VAT ที่ระบบใช้ใกล้หมดอายุ
//
//  ทำไมต้องมี: อัตรา 7% มาจากพระราชกฤษฎีกาลดอัตราซึ่งต่ออายุเป็นรายปี
//  อัตราปกติตามมาตรา 80 คือ 10% — ถ้าฉบับปัจจุบันหมดอายุแล้วไม่มีใครรู้
//  เอกสารทุกใบหลังจากนั้นจะคิดภาษีผิด และแก้ย้อนหลังไม่ได้เพราะส่งลูกค้าไปแล้ว
//
//  ระบบจงใจ "ไม่เปลี่ยนอัตราเอง" เพราะการเปลี่ยนเงียบ ๆ เสียหายกว่าการใช้อัตราเดิมค้าง
//  หน้าที่ของแบนเนอร์นี้คือทำให้คนรู้ตัวและไปตรวจประกาศ แล้วมายืนยันเอง
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { TriangleAlert } from "lucide-react";

interface VatStatus {
  rate: number;
  percent: number;
  valid_until: string | null;
  days_left: number | null;
  status: "ok" | "warn" | "expired";
  note: string | null;
}

export default async function VatRateAlert() {
  const { data } = await createServiceClient().rpc("vat_rate_status");
  const s = data as VatStatus | null;
  if (!s || s.status === "ok") return null;

  const expired = s.status === "expired";
  return (
    <div
      className={
        expired
          ? "mb-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3"
          : "mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
      }
    >
      <p className={`flex items-center gap-2 text-sm font-bold ${expired ? "text-red-700" : "text-amber-800"}`}>
        <TriangleAlert className="h-4 w-4 shrink-0" />
        {expired
          ? `อัตรา VAT ที่ระบบใช้ (${s.percent}%) หมดอายุแล้วตั้งแต่ ${s.valid_until}`
          : `อัตรา VAT ${s.percent}% จะหมดอายุใน ${s.days_left} วัน (${s.valid_until})`}
      </p>
      <p className={`mt-1 text-[12px] leading-relaxed ${expired ? "text-red-600" : "text-amber-700"}`}>
        อัตรา 7% มาจากพระราชกฤษฎีกาลดอัตราที่ต่ออายุเป็นรายปี — อัตราปกติตามกฎหมายคือ 10%
        {expired
          ? " ระบบยังคิดอัตราเดิมอยู่ (ไม่เปลี่ยนเองเพื่อไม่ให้เอกสารเพี้ยนโดยไม่มีใครรู้) โปรดตรวจประกาศราชกิจจานุเบกษาแล้วแจ้งผู้ดูแลระบบให้อัปเดตทันที"
          : " โปรดติดตามประกาศราชกิจจานุเบกษาช่วงใกล้ครบกำหนด ถ้าต่ออายุหรือเปลี่ยนอัตรา ผู้ดูแลระบบต้องอัปเดตตารางอัตราก่อนวันมีผล"}
      </p>
    </div>
  );
}
