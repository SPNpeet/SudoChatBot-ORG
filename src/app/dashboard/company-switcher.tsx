"use client";
// สลับกิจการ (สำนักงานบัญชีดูแลหลายบริษัทในบัญชีเดียว) + สร้างกิจการใหม่
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronDown, Plus, X } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import { switchShop, createShop } from "./actions";

export interface CompanyLite { id: string; name: string; role: string }

export default function CompanySwitcher({ companies, currentId }: { companies: CompanyLite[]; currentId: string }) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const path = usePathname();
  const current = companies.find((c) => c.id === currentId);

  // component นี้อยู่ใน layout (ไม่ remount ตอนเปลี่ยนหน้า) — ปิด dropdown/modal ค้างทุกครั้งที่นำทาง
  useEffect(() => { setOpen(false); setCreateOpen(false); }, [path]);

  // กด Esc ปิดได้ — เดิมเปิดแล้วปิดไม่ได้เลยถ้าไม่เลือกกิจการหรือเปลี่ยนหน้า
  useEffect(() => {
    if (!open && !createOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (createOpen) setCreateOpen(false); else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, createOpen]);

  // ต้องรอให้ mount ก่อนถึงจะใช้ portal ได้ (document ยังไม่มีตอน render ฝั่งเซิร์ฟเวอร์)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ---- วางรายการให้ตรงกับปุ่มเป๊ะ ----------------------------------------
  //
  // ⚠️ ห้ามใช้ fixed inset-x-4 (ของเดิม) — นั่นคือ "เต็มความกว้างจอ" ไม่ใช่ "เท่าปุ่ม"
  // ปุ่มอยู่ในช่อง flex-1 ของหัวมือถือ ซึ่งแคบกว่าจอมาก เพราะมีโลโก้/กระดิ่ง/รูปบัญชีกินที่
  // ผลคือรายการที่กางออกมากว้างกว่าปุ่มเห็นได้ชัด เจ้าของเจอเองว่า "มันใหญ่กว่าที่เป็น drop down จริง ๆ"
  //
  // วัดจากปุ่มจริงด้วย getBoundingClientRect แทนการเดาตัวเลข เพราะ component นี้
  // ถูกใช้ทั้งในหัวมือถือและในแถบเมนูซ้าย ซึ่งกว้างไม่เท่ากันและเปลี่ยนตามฟอนต์/ภาษา
  const btnRef = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // กว้างเท่าปุ่ม แต่ไม่แคบจนอ่านชื่อกิจการไม่ได้ แล้วหนีบไม่ให้ล้นขอบจอ
    const width = Math.min(Math.max(r.width, 208), window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setBox({ left, top: r.bottom + 6, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    // จอหมุน/แป้นพิมพ์เด้ง = ตำแหน่งปุ่มเปลี่ยน ต้องวัดใหม่ ไม่ใช่ค้างที่เดิม
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, measure]);

  /**
   * ⚠️ ต้องยิงออกไปที่ document.body ผ่าน portal
   * component นี้อยู่ในแถบหัวมือถือซึ่งเป็น `sticky z-20` = สร้าง stacking context
   * ของตัวเอง ทุกอย่างที่ render อยู่ข้างในจึงติดอยู่ในกรอบนั้น ต่อให้ตั้ง z-50 ก็ตาม
   * ผลคือปุ่มลอย (+ สร้างเอกสาร z-46 · ติชม z-35) ที่อยู่นอก header ทับเมนูและ
   * กล่อง "เพิ่มกิจการใหม่" ขึ้นมา — ผู้ใช้เจอเป็น "ปุ่มค้าง" บนมือถือ
   */
  const portal = (node: React.ReactNode) => (mounted ? createPortal(node, document.body) : null);

  function choose(id: string) {
    if (id === currentId) { setOpen(false); return; }
    start(async () => {
      const r = await switchShop(id);
      if (r.ok) { setOpen(false); router.refresh(); }
    });
  }

  function submitCreate(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await createShop(fd);
      if (r.ok) { setCreateOpen(false); setOpen(false); router.refresh(); }
      else setError(r.error);
    });
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-neutral-200 px-2.5 py-2 text-left text-sm hover:bg-neutral-50">
        <Building2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="flex-1 truncate font-medium">{current?.name ?? "เลือกกิจการ"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
      </button>

      {open && portal(
        <>
          {/* แตะข้างนอกเพื่อปิด — เดิมไม่มี ต้องเลือกกิจการหรือเปลี่ยนหน้าเท่านั้นถึงจะปิดได้ */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" aria-label="เลือกกิจการ"
            style={box ? { left: box.left, top: box.top, width: box.width } : undefined}
            className={cn(
              "fixed z-[61] max-h-[60vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl",
              // ยังไม่ได้วัด (เฟรมแรก) ให้ซ่อนไว้ก่อน ดีกว่ากระพริบผิดที่แล้วค่อยเด้งไปถูกที่
              !box && "invisible",
            )}>
          {companies.map((c) => (
            <button key={c.id} onClick={() => choose(c.id)} disabled={pending}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-neutral-50",
                c.id === currentId && "bg-emerald-50 text-emerald-700",
              )}>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-[10px] text-neutral-400">{roleLabel(c.role)}</span>
            </button>
          ))}
          <button onClick={() => { setCreateOpen(true); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">
            <Plus className="h-4 w-4" /> เพิ่มกิจการใหม่
          </button>
          </div>
        </>
      )}

      {createOpen && portal(
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-10 pt-14 sm:items-center" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">เพิ่มกิจการใหม่</h2>
              <button onClick={() => setCreateOpen(false)} className="rounded-lg p-1 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <form action={submitCreate} className="space-y-3">
              <div>
                <Label>ชื่อกิจการ/บริษัท</Label>
                <Input name="name" required placeholder="เช่น บริษัท ลูกค้าใหม่ จำกัด" />
              </div>
              <p className="text-xs text-neutral-400">ข้อมูลแต่ละกิจการแยกจากกันทั้งหมด (เอกสาร บัญชี ผู้ติดต่อ) — เหมาะกับสำนักงานบัญชีที่ดูแลหลายบริษัท</p>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <Button className="w-full" disabled={pending}>{pending ? "กำลังสร้าง..." : "สร้างกิจการ"}</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
