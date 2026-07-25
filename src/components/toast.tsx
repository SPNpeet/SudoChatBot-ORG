"use client";
// ============================================================
//  ระบบแจ้งเตือนแบบ popup (toast) — ใช้ได้ทั้งแอปด้วย useToast()
//
//  ทำไมต้องมี: ทุกวันนี้เวลาบันทึกอะไรสำเร็จ ผู้ใช้ต้อง "เดา" ว่าติดไหม
//  toast ทำให้เห็นผลทันทีโดยไม่ต้องเปลี่ยนหน้า และเป็นที่วางปุ่ม "เลิกทำ" ด้วย
//
//  หลักที่ยึด (แบบ Linear/Vercel):
//   · มุมล่างขวาบนจอใหญ่ / บนสุดบนมือถือ (มือถือมี bottom nav อยู่แล้ว ห้ามทับ)
//   · สำเร็จหายเองใน 4 วิ · มีปุ่มเลิกทำยืดเป็น 8 วิ · error ไม่หายเอง ต้องกดปิด
//   · เคารพ prefers-reduced-motion
//   · ประกาศผ่าน aria-live ให้โปรแกรมอ่านหน้าจอรู้ด้วย
// ============================================================
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, TriangleAlert, Info, X, Undo2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
export interface ToastInput {
  text: string;
  tone?: Tone;
  /** ปุ่มเลิกทำ — ถ้ามี toast จะอยู่นานขึ้นเป็น 8 วินาที */
  undo?: () => Promise<void> | void;
  undoLabel?: string;
}
interface ToastItem extends ToastInput { id: number; leaving?: boolean }

const Ctx = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(Ctx);

const ICON = { success: CheckCircle2, error: TriangleAlert, info: Info } as const;
const SKIN: Record<Tone, string> = {
  success: "border-emerald-200 bg-white text-emerald-700",
  error: "border-red-200 bg-white text-red-700",
  info: "border-neutral-200 bg-white text-neutral-700",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 180);
  }, []);

  const push = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);   // ค้างพร้อมกันมากสุด 3 ใบ
    if (t.tone !== "error") setTimeout(() => remove(id), t.undo ? 8000 : 4000);
  }, [remove]);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" aria-atomic="false"
        className={cn(
          "pointer-events-none fixed z-[60] flex flex-col gap-2",
          // มือถือ: บนสุด (ล่างมี bottom nav + ปุ่มลอย) · จอใหญ่: ล่างขวา
          "inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))]",
          "sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:w-[22rem]",
        )}>
        {items.map((t) => <Row key={t.id} t={t} onClose={() => remove(t.id)} />)}
      </div>
    </Ctx.Provider>
  );
}

function Row({ t, onClose }: { t: ToastItem; onClose: () => void }) {
  const Icon = ICON[t.tone ?? "info"];
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(r); }, []);

  return (
    <div className={cn(
      "pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 shadow-lg",
      "transition-all duration-200 ease-out motion-reduce:transition-none",
      shown && !t.leaving ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0 sm:translate-y-1.5",
      SKIN[t.tone ?? "info"],
    )}>
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-[13px] font-medium leading-relaxed text-neutral-800">{t.text}</p>
      {t.undo && (
        <button type="button" disabled={busy}
          onClick={async () => { setBusy(true); try { await t.undo!(); } finally { onClose(); } }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
          {t.undoLabel ?? "เลิกทำ"}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="ปิด"
        className="shrink-0 rounded-lg p-0.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
