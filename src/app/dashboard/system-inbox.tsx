"use client";
// ============================================================
//  กระดิ่ง + กล่องจดหมายระบบ
//
//  ทำไมไม่ใช้แบนเนอร์: คำเตือนที่เห็นทุกหน้าทุกวันคือคำเตือนที่ตาชา
//  เจ้าของบอกตรง ๆ ว่า "รกจัด ๆ" ตอนมี 5 กล่องกระจายอยู่
//  กระดิ่งมีเลขบอกจำนวน = เห็นว่ามีเรื่อง แต่ไม่ยึดพื้นที่ทำงาน
//
//  ⚠️ ยังคงโชว์เรื่องระดับ critical เป็นแถบบนหน้าภาพรวมด้วย
//  ของที่ทำให้ยื่นภาษีผิดต้องขวางตา ไม่ควรซ่อนใต้กระดิ่งที่คนอาจไม่กด
//  ที่ย้ายเข้ากระดิ่งคือระดับ warn/info ซึ่งเดิมกินที่ทุกหน้าโดยไม่มีใครอ่าน
// ============================================================
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X, AlertTriangle, Siren, Info, Check, Trash2, Undo2, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/components/use-dismiss";
import { dismissNotice, loadNoticeHistory, deleteNotification, restoreNotice, clearReadNotifications } from "./actions";
import type { Notice, NoticeTone, HistoryItem } from "@/lib/notices";

const TONE: Record<NoticeTone, { ring: string; text: string; Icon: typeof Info }> = {
  critical: { ring: "border-red-200 bg-red-50", text: "text-red-800", Icon: Siren },
  warn: { ring: "border-amber-200 bg-amber-50", text: "text-amber-800", Icon: AlertTriangle },
  info: { ring: "border-blue-200 bg-blue-50", text: "text-blue-800", Icon: Info },
};

export default function SystemInbox({ shopId, notices, variant = "icon", place = "header" }: {
  shopId: string;
  notices: Notice[];
  /** icon = ปุ่มกลม · row = แถวเต็มความกว้างในแถบเมนูซ้าย */
  variant?: "icon" | "row";
  /**
   * อยู่ตรงไหนของหน้า — ใช้ตัดสินว่าแผงต้องกางไปทางไหน
   * ⚠️ ห้ามเดาจาก variant: variant="icon" ถูกใช้ทั้งในหัวมือถือ (ปุ่มชิดขวา ต้องกางไปซ้าย)
   * และในเมนูซ้ายตอนพับ (ปุ่มชิดซ้าย ต้องกางไปขวา) ถ้ายึดขอบผิดด้านแผงจะหลุดออกนอกจอ
   */
  place?: "header" | "sidebar" | "sidebar-top";
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"open" | "history">("open");
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  useDismiss(open, () => setOpen(false));

  const unread = notices.length;
  const worst: NoticeTone | null = notices.some((n) => n.tone === "critical") ? "critical"
    : notices.some((n) => n.tone === "warn") ? "warn"
    : unread ? "info" : null;

  function read(key: string) {
    start(async () => {
      await dismissNotice(shopId, key);
      router.refresh();
    });
  }

  // ⚠️ ประวัติโหลดตอนกดแท็บเท่านั้น (8 ส.ค. 2569)
  // กระดิ่งเรนเดอร์ทุกหน้าใน dashboard ถ้าดึงประวัติมาด้วยเสมอ = เพิ่มคิวรี 2 ชุดต่อการเปิดหน้าทุกครั้ง
  // เพื่อของที่คนส่วนใหญ่ไม่เปิดดู
  function openHistory() {
    setTab("history");
    if (history !== null) return;
    start(async () => {
      const r = await loadNoticeHistory(shopId);
      setHistory(r.ok ? r.items : []);
      if (!r.ok) setErr(r.error);
    });
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setErr(r.error ?? "ทำรายการไม่สำเร็จ"); return; }
      const fresh = await loadNoticeHistory(shopId);
      setHistory(fresh.ok ? fresh.items : []);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `กล่องจดหมายระบบ ${unread} เรื่องใหม่` : "กล่องจดหมายระบบ"}
        aria-expanded={open}
        className={cn(
          "relative flex items-center text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
          // 44px ตามเกณฑ์เป้ากดขั้นต่ำในหน้าที่ลูกค้าใช้
          variant === "icon"
            ? "h-11 w-11 shrink-0 justify-center rounded-full"
            : "min-h-11 w-full gap-2.5 rounded-xl px-2.5 py-2 text-sm",
        )}>
        <Bell className="h-[18px] w-[18px] shrink-0" />
        {variant === "row" && <span className="flex-1 text-left">กล่องจดหมาย</span>}
        {unread > 0 && (
          <span className={cn(
            "grid min-w-[18px] place-items-center rounded-full px-1 text-xs font-bold leading-[18px] text-white",
            worst === "critical" ? "bg-red-600" : worst === "warn" ? "bg-amber-600" : "bg-blue-600",
            variant === "icon" && "absolute right-1 top-1.5",
          )}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <>
          {/* ฉากหลัง — กดที่ไหนก็ปิดได้ ไม่ต้องเล็งปุ่มเล็ก ๆ */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/*
            ⚠️ ห้ามใช้ absolute + right-0 + w-[22rem] บนมือถือ
            เกิดจริง 31 ก.ค. 2569 (บั๊กที่เพิ่ง deploy ไปเมื่อวาน): กระดิ่งอยู่เกือบชิดขวาของหัวเว็บ
            right-0 จึงตรึงขอบขวาของแผงไว้ที่ขอบขวาของ "ปุ่ม" ไม่ใช่ขอบขวาของ "จอ"
            แผงกว้าง 22rem (352px) บนจอ 390px จึงล้นออกไปทางซ้ายนอกจอ หัวข้อโดนตัดหาย
            w-[min(...,100vw-2rem)] คุมแค่ "ความกว้าง" ไม่ได้คุม "ตำแหน่ง" จึงไม่ช่วยอะไร

            มือถือ: fixed + ยึดขอบจอทั้งซ้ายขวา = อยู่ในจอเสมอไม่ว่าปุ่มจะอยู่ตรงไหน
            เดสก์ท็อป (sm+): กลับไปห้อยจากปุ่มตามปกติ เพราะมีที่เหลือพอ
          */}
          <div className={cn(
            "z-50 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl",
            "fixed inset-x-3 top-[4.25rem] sm:absolute sm:inset-x-auto sm:top-auto sm:w-[22rem]",
            place === "header"
              // หัวเว็บ: ห้อยลงมาจากปุ่ม ยึดขอบขวาเพราะปุ่มอยู่ฝั่งขวาของหัว
              ? "sm:right-0 sm:top-[calc(100%+0.5rem)]"
              : place === "sidebar-top"
                // หัวแถบเมนู: ห้อยลงมา ยึดขอบซ้าย (ปุ่มอยู่บนสุดจึงไม่มีที่เหนือมัน)
                ? "sm:left-0 sm:top-[calc(100%+0.5rem)]"
                // ท้ายแถบเมนู: เด้งขึ้นด้านบน ยึดขอบซ้ายเสมอ ไม่ว่าจะพับอยู่หรือไม่
                // (พับแล้วปุ่มกว้างแค่ 44px ถ้ายึดขวาแผงจะยื่นออกไปนอกจอทางซ้าย)
                : "sm:bottom-[calc(100%+0.5rem)] sm:left-0",
          )}>
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
              <p className="text-sm font-semibold">กล่องจดหมายระบบ</p>
              <button onClick={() => setOpen(false)} aria-label="ปิด"
                className="-m-2 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* แท็บ: ค้างอยู่ / อ่านแล้ว — เดิมมีแค่รายการค้าง กดอ่านแล้วหายไปเลย ย้อนดูไม่ได้ ลบไม่ได้ */}
            <div className="flex border-b border-neutral-100">
              {([["open", `ค้างอยู่${unread ? ` (${unread})` : ""}`], ["history", "อ่านแล้ว"]] as const).map(([id, label]) => (
                <button key={id} type="button"
                  onClick={() => (id === "history" ? openHistory() : setTab("open"))}
                  className={cn(
                    "min-h-11 flex-1 px-3 text-xs font-semibold transition-colors",
                    tab === id ? "border-b-2 border-emerald-600 text-emerald-700" : "text-neutral-500 hover:text-neutral-800",
                  )}>{label}</button>
              ))}
            </div>

            {err && <p className="bg-red-50 px-4 py-2 text-xs text-red-600">{err}</p>}

            {tab === "history" ? (
              history === null ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-400">กำลังโหลด...</p>
              ) : history.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Archive className="mx-auto h-5 w-5 text-neutral-300" />
                  <p className="mt-1.5 text-sm text-neutral-500">ยังไม่มีเรื่องที่อ่านแล้ว</p>
                </div>
              ) : (
                <>
                  <ul className="max-h-[min(22rem,55vh)] divide-y divide-neutral-100 overflow-y-auto">
                    {history.map((h) => (
                      <li key={h.key} className="px-4 py-3">
                        <p className="text-[13px] font-medium leading-snug text-neutral-700">{h.title}</p>
                        {h.body && <p className="mt-1 text-xs leading-relaxed text-neutral-500">{h.body}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3">
                          {h.at && <span className="text-xs text-neutral-400">{new Date(h.at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span>}
                          <button onClick={() => act(() => restoreNotice(shopId, h.key))} disabled={pending}
                            className="inline-flex min-h-[44px] items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-50">
                            <Undo2 className="h-3.5 w-3.5" /> เอากลับมาแสดง
                          </button>
                          {h.deletable && (
                            <button onClick={() => act(() => deleteNotification(shopId, h.key))} disabled={pending}
                              className="inline-flex min-h-[44px] items-center gap-1 text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50">
                              <Trash2 className="h-3.5 w-3.5" /> ลบ
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {history.some((h) => h.deletable) && (
                    <div className="border-t border-neutral-100 px-4 py-2">
                      <button onClick={() => act(() => clearReadNotifications(shopId))} disabled={pending}
                        className="inline-flex min-h-[44px] items-center gap-1 text-xs text-neutral-500 hover:text-red-600 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" /> ลบที่อ่านแล้วทั้งหมด
                      </button>
                    </div>
                  )}
                </>
              )
            ) : unread === 0 ? (
              <div className="px-4 py-6 text-center">
                <Check className="mx-auto h-5 w-5 text-emerald-600" />
                <p className="mt-1.5 text-sm text-neutral-500">ไม่มีเรื่องค้าง</p>
                <p className="text-xs text-neutral-400">ถ้ามีอะไรที่ต้องรู้ ระบบจะขึ้นตรงนี้</p>
              </div>
            ) : (
              <ul className="max-h-[min(26rem,60vh)] divide-y divide-neutral-100 overflow-y-auto">
                {notices.map((n) => {
                  const t = TONE[n.tone];
                  return (
                    <li key={n.key} className={cn("px-4 py-3", t.ring, "border-x-0 border-b-0 border-t-0")}>
                      <div className="flex gap-2.5">
                        <t.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.text)} />
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[13px] font-semibold leading-snug", t.text)}>{n.title}</p>
                          {n.body && <p className="mt-1 text-xs leading-relaxed text-neutral-600">{n.body}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {n.href && (
                              <Link href={n.href} onClick={() => setOpen(false)}
                                className={cn("inline-flex min-h-[44px] items-center text-xs font-semibold underline", t.text)}>
                                {n.cta ?? "ไปดู"} →
                              </Link>
                            )}
                            <button onClick={() => read(n.key)} disabled={pending}
                              className="inline-flex min-h-[44px] items-center text-xs text-neutral-500 underline hover:text-neutral-800 disabled:opacity-50">
                              {pending ? "กำลังบันทึก..." : "อ่านแล้ว"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
