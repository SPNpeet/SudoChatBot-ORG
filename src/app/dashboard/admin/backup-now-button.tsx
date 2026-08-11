"use client";
// ปุ่มสำรองข้อมูลเดี๋ยวนี้ — ตัดการพึ่งพา CRON_SECRET ที่ยังไม่ได้ตั้งใน Vercel
// (เหตุผลเต็มอยู่ใน lib/backup-run.ts) · งานสำรองใช้เวลาหลายสิบวินาที ต้องมีสถานะให้เห็น
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatabaseBackup } from "lucide-react";
import { Button } from "@/components/ui";
import { backupNow } from "./actions";

export default function BackupNowButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  return (
    <div className="mt-3">
      <Button size="sm" variant="outline" disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await backupNow();
            setMsg({ ok: r.ok, text: r.message });
            if (r.ok) router.refresh();
          });
        }}>
        <DatabaseBackup className="h-3.5 w-3.5" />
        {pending ? "กำลังสำรอง... (อาจใช้เวลาสักครู่)" : "สำรองข้อมูลเดี๋ยวนี้"}
      </Button>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>
      )}
    </div>
  );
}
