"use client";
// ปุ่มลอย "แนะนำ/ติชม" — เสียงผู้ใช้ตรงถึงเจ้าของแพลตฟอร์ม (โชว์ในแดชบอร์ดแอดมิน)
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MessageCirclePlus, X } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { submitFeedback } from "./actions";

export default function FeedbackWidget({ shopId }: { shopId: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    if (msg.trim().length < 3) { setErr("พิมพ์อย่างน้อย 3 ตัวอักษร"); return; }
    setErr(null);
    start(async () => {
      const r = await submitFeedback(shopId, msg.trim(), path);
      if (!r.ok) { setErr(r.error); return; }
      setDone(true);
      setMsg("");
      setTimeout(() => { setOpen(false); setDone(false); }, 1800);
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="แนะนำ/ติชม"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-neutral-700 active:scale-95 md:bottom-6">
        <MessageCirclePlus className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold">แนะนำ/ติชม ถึงทีมงาน</p>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700"><X className="h-4 w-4" /></button>
            </div>
            {done ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">✓ ส่งแล้ว ขอบคุณมากค่ะ ทีมงานอ่านทุกข้อความ</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-neutral-400">เจออะไรติดขัด อยากได้ฟีเจอร์ไหน บอกได้เลย — ข้อความส่งตรงถึงผู้พัฒนา</p>
                <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} maxLength={2000}
                  placeholder="เช่น อยากให้บอทตอบ... / หน้านี้ใช้ยากตรง... / เจอบั๊กตอน..." className="mt-3" />
                {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
                <div className="mt-3 flex justify-end">
                  <Button onClick={send} disabled={pending}>{pending ? "กำลังส่ง..." : "ส่งความเห็น"}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
