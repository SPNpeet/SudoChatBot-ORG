"use client";
// ============================================================
//  ค้นหาทุกอย่างในที่เดียว — Ctrl+K / ⌘K (หรือปุ่มค้นหาบนมือถือ)
//
//  ทำไมถึงคุ้ม: ระบบมี 12 เมนู + เอกสารเป็นร้อยใบ การไล่กดเมนูทีละชั้นช้ามาก
//  พิมพ์ชื่อลูกค้า เลขที่เอกสาร หรือชื่อเมนู แล้ว Enter — ไปถึงเลย
//
//  ปลอดภัย: ค้นผ่าน Supabase client ฝั่งผู้ใช้ซึ่งมี RLS คุมอยู่แล้ว
//  จึงเห็นได้เฉพาะข้อมูลกิจการที่ตัวเองเป็นสมาชิก ไม่มีทางหลุดข้ามร้าน
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, baht } from "@/lib/utils";
import {
  Search, CornerDownLeft, LayoutDashboard, Calculator, FileText, Receipt, Banknote,
  Users, Package, BookOpenText, PieChart, Wallet, Settings, CircleHelp, Loader2, Plus, UserRound,
} from "lucide-react";

interface Row { id: string; label: string; sub?: string; href: string; icon: typeof FileText; group: string }

const PAGES: Row[] = [
  { id: "p1", label: "ภาพรวม", href: "/dashboard", icon: LayoutDashboard, group: "ไปที่หน้า" },
  { id: "p2", label: "ผู้ช่วยบัญชี AI", href: "/dashboard/assistant", icon: Calculator, group: "ไปที่หน้า" },
  { id: "p3", label: "เอกสารขาย", href: "/dashboard/sales", icon: FileText, group: "ไปที่หน้า" },
  { id: "p4", label: "ค่าใช้จ่าย", href: "/dashboard/expenses", icon: Receipt, group: "ไปที่หน้า" },
  { id: "p5", label: "การเงิน / กระทบยอด", href: "/dashboard/money", icon: Banknote, group: "ไปที่หน้า" },
  { id: "p6", label: "ผู้ติดต่อ", href: "/dashboard/contacts", icon: Users, group: "ไปที่หน้า" },
  { id: "p7", label: "สินค้า/บริการ", href: "/dashboard/products", icon: Package, group: "ไปที่หน้า" },
  { id: "p8", label: "สมุดรายวัน", href: "/dashboard/journal", icon: BookOpenText, group: "ไปที่หน้า" },
  { id: "p9", label: "รายงาน + ภาษี", href: "/dashboard/reports", icon: PieChart, group: "ไปที่หน้า" },
  { id: "p10", label: "แพ็กเกจ/เครดิต", href: "/dashboard/billing", icon: Wallet, group: "ไปที่หน้า" },
  { id: "p11", label: "ตั้งค่า", href: "/dashboard/settings", icon: Settings, group: "ไปที่หน้า" },
  { id: "p12", label: "คู่มือใช้งาน", href: "/dashboard/help", icon: CircleHelp, group: "ไปที่หน้า" },
  { id: "p13", label: "บัญชีของฉัน", sub: "ชื่อผู้ใช้ · อีเมล · รหัสผ่าน", href: "/dashboard/account", icon: UserRound, group: "ไปที่หน้า" },
];

const ACTIONS: Row[] = [
  { id: "a1", label: "ออกใบแจ้งหนี้ใหม่", href: "/dashboard/sales/new?type=invoice", icon: Plus, group: "สร้างใหม่" },
  { id: "a2", label: "ออกใบเสนอราคาใหม่", href: "/dashboard/sales/new?type=quotation", icon: Plus, group: "สร้างใหม่" },
  { id: "a3", label: "บันทึกค่าใช้จ่ายใหม่", href: "/dashboard/expenses/new", icon: Plus, group: "สร้างใหม่" },
  { id: "a4", label: "เพิ่มผู้ติดต่อใหม่", href: "/dashboard/contacts", icon: Plus, group: "สร้างใหม่" },
];

export default function CommandPalette({ shopId }: { shopId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // เปิดด้วย Ctrl+K / ⌘K — ไม่แย่งคีย์ลัดตอนผู้ใช้กำลังพิมพ์อยู่ในช่องอื่น
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setRemote([]); setCursor(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  // ค้นเอกสาร/ผู้ติดต่อจริง — หน่วง 220ms กันยิงทุกตัวอักษร
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRemote([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const sb = createClient();
        const like = `%${term}%`;
        const [docs, contacts] = await Promise.all([
          sb.from("fin_docs").select("id,doc_number,doc_type,contact_name,total")
            .eq("shop_id", shopId).or(`doc_number.ilike.${like},contact_name.ilike.${like}`)
            .order("created_at", { ascending: false }).limit(6),
          sb.from("contacts").select("id,name,kind").eq("shop_id", shopId).ilike("name", like).limit(4),
        ]);
        const out: Row[] = [];
        for (const d of docs.data ?? []) {
          out.push({
            id: `d${d.id}`, label: d.doc_number,
            sub: `${d.contact_name ?? "ไม่ระบุ"} · ${baht(Number(d.total))}`,
            href: d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`,
            icon: d.doc_type === "expense" ? Receipt : FileText, group: "เอกสาร",
          });
        }
        for (const c of contacts.data ?? []) {
          out.push({
            id: `c${c.id}`, label: c.name, sub: c.kind === "vendor" ? "ผู้ขาย" : "ลูกค้า",
            href: "/dashboard/contacts", icon: Users, group: "ผู้ติดต่อ",
          });
        }
        setRemote(out);
      } catch { setRemote([]); }
      finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q, shopId]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const local = [...ACTIONS, ...PAGES].filter((r) => !term || r.label.toLowerCase().includes(term));
    return [...remote, ...local].slice(0, 14);
  }, [q, remote]);

  useEffect(() => { setCursor(0); }, [results.length]);

  function go(r: Row) { setOpen(false); router.push(r.href); }

  return (
    <>
      {/* ปุ่มค้นหา — เดสก์ท็อปโชว์คีย์ลัด, มือถือเป็นปุ่มกลม */}
      <button type="button" onClick={() => setOpen(true)} aria-label="ค้นหา"
        className={cn(
          "fixed z-30 items-center gap-2 rounded-xl border border-neutral-200 bg-white/90 text-neutral-400 shadow-sm backdrop-blur",
          "transition-colors hover:border-neutral-300 hover:text-neutral-600",
          "right-4 top-3 hidden h-9 px-3 text-xs md:flex",
        )}>
        <Search className="h-3.5 w-3.5" />
        <span>ค้นหา</span>
        <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-sans text-xs text-neutral-400">Ctrl K</kbd>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-neutral-900/30 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="ค้นหา"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4">
              {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-300" /> : <Search className="h-4 w-4 shrink-0 text-neutral-300" />}
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="พิมพ์ชื่อลูกค้า เลขที่เอกสาร หรือชื่อเมนู…"
                className="h-12 w-full bg-transparent text-base outline-none placeholder:text-neutral-300 sm:text-sm"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                  if (e.key === "Enter" && results[cursor]) { e.preventDefault(); go(results[cursor]); }
                }} />
            </div>

            <div className="max-h-[min(60vh,24rem)] overflow-y-auto overscroll-contain p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-neutral-400">
                  {q.trim().length >= 2 ? "ไม่พบอะไรที่ตรงกับที่พิมพ์" : "พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นเอกสาร"}
                </p>
              ) : results.map((r, i) => {
                const head = i === 0 || results[i - 1].group !== r.group;
                return (
                  <div key={r.id}>
                    {head && <p className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">{r.group}</p>}
                    <button type="button" onClick={() => go(r)} onMouseEnter={() => setCursor(i)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        i === cursor ? "bg-neutral-100 text-neutral-900" : "text-neutral-600",
                      )}>
                      <r.icon className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="min-w-0 flex-1 truncate">
                        {r.label}
                        {r.sub && <span className="ml-2 text-xs text-neutral-400">{r.sub}</span>}
                      </span>
                      {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-neutral-300" />}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="hidden items-center gap-3 border-t border-neutral-100 px-4 py-2 text-xs text-neutral-400 sm:flex">
              <span>↑↓ เลื่อน</span><span>Enter เปิด</span><span>Esc ปิด</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
