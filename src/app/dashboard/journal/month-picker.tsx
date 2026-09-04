"use client";
// เลือกเดือนของสมุดรายวัน — เดือนไทย/ปี พ.ศ. แล้วไปทันที
// (เดิมเป็น input[type="month"] ที่แสดง "September 2026" + ต้องกดปุ่ม "ดู" อีกครั้ง)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MonthField } from "@/components/date-field";

export default function JournalMonthPicker({ month }: { month: string }) {
  const [v, setV] = useState(month);
  const router = useRouter();
  return <MonthField value={v} ariaLabel="เดือนของสมุดรายวัน"
    onChange={(next) => { setV(next); router.push(`/dashboard/journal?m=${next}`); }} />;
}
