"use client";
// ปุ่มส่งสรุปประจำสัปดาห์เดี๋ยวนี้ — ตัดการพึ่งพา CRON_SECRET ที่ยังไม่ได้ตั้งใน Vercel
// (เหตุผลเต็มอยู่ใน lib/weekly-digest-run.ts) · งานนี้วนทุกกิจการ ต้องมีสถานะให้เห็น
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui";
import { sendWeeklyDigestNow } from "./actions";

export default function SendDigestButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  return (
    <div className="mt-3">
      <Button size="sm" variant="outline" disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await sendWeeklyDigestNow();
            setMsg({ ok: r.ok, text: r.message });
            if (r.ok) router.refresh();
          });
        }}>
        <Send className="h-3.5 w-3.5" />
        {pending ? "กำลังส่ง... (อาจใช้เวลาสักครู่)" : "ส่งสรุปสัปดาห์นี้เดี๋ยวนี้"}
      </Button>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>
      )}
    </div>
  );
}
