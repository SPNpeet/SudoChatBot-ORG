"use client";
// รายการงานอัตโนมัติ + ฟอร์มสร้างจาก 3 แบบ + บันทึกการรัน — ทุกปุ่มมี catch
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Trash2, Play, Pause, Workflow, Clock, CircleCheck, TriangleAlert, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { EmptyState, buttonClass } from "@/components/ui";
import { WORKFLOW_KIND_TH, type AiWorkflow, type WorkflowKind, type WorkflowRun } from "@/lib/workflow-defs";
import { createWorkflow, deleteWorkflow, runWorkflowsNow, setWorkflowActive } from "./workflow-actions";

const FIELD = "h-11 w-full rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-emerald-500 sm:text-sm";

function summarize(w: AiWorkflow): string {
  const c = w.config as Record<string, unknown>;
  if (w.kind === "overdue_reminder") return `เกินกำหนดครบ ${c.days_after_due ?? 3} วัน`;
  if (w.kind === "low_stock") return `เหลือไม่เกิน ${c.threshold ?? 3} ชิ้น`;
  const items = (c.items as { name: string; qty: number; unit_price: number }[] | undefined) ?? [];
  const total = items.reduce((a, it) => a + it.qty * it.unit_price, 0);
  return `ทุกวันที่ ${c.day_of_month ?? 1} · ${String(c.contact_name || "ไม่ระบุลูกค้า")} · ${items.length} รายการ ≈ ${total.toLocaleString("th-TH")} บาท`;
}

const timeTH = (iso: string | null) => iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }) : "ยังไม่เคยรัน";

export default function WorkflowList({ shopId, items, runs, contacts, canManage }: {
  shopId: string; items: AiWorkflow[]; runs: WorkflowRun[]; contacts: { id: string; name: string }[]; canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WorkflowKind>("overdue_reminder");
  const [name, setName] = useState("");
  const [days, setDays] = useState("3");
  const [threshold, setThreshold] = useState("3");
  const [day, setDay] = useState("1");
  const [contactId, setContactId] = useState("");
  const [contactName, setContactName] = useState("");
  const [rows, setRows] = useState([{ name: "", qty: "1", unit_price: "" }]);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) { toast({ text: okText, tone: "success" }); router.refresh(); }
        else toast({ text: r.error ?? "ไม่สำเร็จ", tone: "error" });
      } catch {
        toast({ text: "เชื่อมต่อไม่สำเร็จ — ลองอีกครั้ง", tone: "error" });
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const config: Record<string, unknown> = kind === "overdue_reminder" ? { days_after_due: Number(days) }
      : kind === "low_stock" ? { threshold: Number(threshold) }
      : {
        day_of_month: Number(day), contact_id: contactId || null,
        contact_name: contactId ? (contacts.find((c) => c.id === contactId)?.name ?? "") : contactName,
        items: rows.map((r) => ({ name: r.name, qty: Number(r.qty), unit_price: Number(r.unit_price) })),
      };
    const label = name.trim() || WORKFLOW_KIND_TH[kind].name;
    run(() => createWorkflow(shopId, kind, label, config), "ตั้งงานอัตโนมัติแล้ว — จะเริ่มตรวจตั้งแต่วันนี้");
    setOpen(false); setName(""); setRows([{ name: "", qty: "1", unit_price: "" }]);
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} className={buttonClass("brand", "md")}>
            <Plus className="h-4 w-4" /> ตั้งงานใหม่
          </button>
          {items.some((w) => w.active) && (
            <button type="button" disabled={pending} onClick={() => run(async () => {
              const r = await runWorkflowsNow(shopId);
              if (r.ok) toast({ text: r.results.map((x) => `${x.name}: ${x.summary}`).join(" · ") || "ไม่มีงานที่เปิดอยู่", tone: "info" });
              return r;
            }, "รันครบแล้ว")} className={buttonClass("outline", "md")}>
              <Play className="h-4 w-4" /> รันเดี๋ยวนี้
            </button>
          )}
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(WORKFLOW_KIND_TH) as WorkflowKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={cn("rounded-xl border p-3 text-left transition-colors",
                  kind === k ? "border-emerald-500 bg-emerald-50" : "border-neutral-200 hover:bg-neutral-50")}>
                <p className="text-sm font-semibold text-neutral-900">{WORKFLOW_KIND_TH[k].name}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{WORKFLOW_KIND_TH[k].desc}</p>
              </button>
            ))}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={`ชื่องาน (ไม่ใส่ = "${WORKFLOW_KIND_TH[kind].name}")`} className={FIELD} />

          {kind === "overdue_reminder" && (
            <label className="block text-sm text-neutral-700">เตือนเมื่อเกินกำหนดครบ (วัน)
              <input type="number" min={0} max={90} value={days} onChange={(e) => setDays(e.target.value)} className={cn(FIELD, "mt-1 sm:w-40")} />
            </label>
          )}
          {kind === "low_stock" && (
            <label className="block text-sm text-neutral-700">แจ้งเมื่อสต๊อกเหลือไม่เกิน (ชิ้น)
              <input type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} className={cn(FIELD, "mt-1 sm:w-40")} />
            </label>
          )}
          {kind === "recurring_invoice" && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-sm text-neutral-700">ร่างทุกวันที่
                  <input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} className={cn(FIELD, "mt-1")} />
                </label>
                <label className="text-sm text-neutral-700 sm:col-span-2">ลูกค้า
                  <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={cn(FIELD, "mt-1 bg-white")}>
                    <option value="">ลูกค้าใหม่ — พิมพ์ชื่อในช่องด้านล่าง</option>
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!contactId && <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="ชื่อลูกค้า" className={cn(FIELD, "mt-2")} />}
                </label>
              </div>
              <p className="text-xs font-medium text-neutral-500">รายการที่จะร่างทุกเดือน</p>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_6.5rem_2.75rem] gap-1.5">
                  <input value={r.name} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="ชื่อรายการ" className={FIELD} required />
                  <input type="number" min={0.01} step="any" value={r.qty} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} placeholder="จำนวน" className={FIELD} />
                  <input type="number" min={0} step="any" value={r.unit_price} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} placeholder="ราคา/หน่วย" className={FIELD} required />
                  <button type="button" aria-label="ลบบรรทัด" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    className="grid h-11 place-items-center rounded-xl text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><Trash className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setRows([...rows, { name: "", qty: "1", unit_price: "" }])} className="text-xs font-medium text-emerald-700 hover:underline">+ เพิ่มบรรทัด</button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>บันทึกงาน</button>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "md")}>ยกเลิก</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState icon={Workflow} title="ยังไม่มีงานอัตโนมัติ"
          hint={canManage ? "กด “ตั้งงานใหม่” หรือพิมพ์ในแชท เช่น “ทุกวันที่ 1 ร่างใบแจ้งหนี้ค่าเช่า 15,000 ให้ร้าน A”" : "เจ้าของ/ผู้ดูแลเป็นคนตั้งงานอัตโนมัติ"} />
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-clip rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
          {items.map((w) => (
            <li key={w.id} className={cn("flex items-start gap-3 px-4 py-3", !w.active && "bg-neutral-50/70 opacity-70")}>
              <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", w.source === "ai" ? "bg-emerald-50 text-emerald-600" : "bg-teal-50 text-teal-600")}
                title={w.source === "ai" ? "ตั้งผ่านแชท" : "ตั้งเอง"}>
                {w.source === "ai" ? <Bot className="h-4 w-4" /> : <Workflow className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{w.name}</p>
                <p className="text-xs text-neutral-500">{WORKFLOW_KIND_TH[w.kind]?.name} · {summarize(w)}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                  {w.last_status === "error" ? <TriangleAlert className="h-3 w-3 text-red-500" /> : <Clock className="h-3 w-3" />}
                  {timeTH(w.last_run_at)}{w.last_summary && ` — ${w.last_summary}`}{!w.active && " · ปิดอยู่"}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center">
                  <button type="button" aria-label={w.active ? "หยุดชั่วคราว" : "เปิดใช้"} title={w.active ? "หยุดชั่วคราว" : "เปิดใช้"}
                    onClick={() => run(() => setWorkflowActive(shopId, w.id, !w.active), w.active ? "หยุดแล้ว" : "เปิดแล้ว")}
                    className="grid h-11 w-11 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                    {w.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button type="button" aria-label="ลบ" onClick={() => { if (window.confirm("ลบงานอัตโนมัตินี้ถาวร? (ร่างที่เคยสร้างไว้ไม่หาย)")) run(() => deleteWorkflow(shopId, w.id), "ลบแล้ว"); }}
                    className="grid h-11 w-11 place-items-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {runs.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">บันทึกการทำงานล่าสุด</p>
          <ul className="mt-2 divide-y divide-neutral-100">
            {runs.map((r) => (
              <li key={r.id} className="flex items-start gap-2 py-2 text-xs">
                {r.status === "error" ? <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" /> : <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                <span className="min-w-0 flex-1 text-neutral-700">{items.find((w) => w.id === r.workflow_id)?.name ?? "งานที่ลบแล้ว"} — {r.summary ?? r.dedupe_key}</span>
                <span className="shrink-0 whitespace-nowrap text-neutral-400">{timeTH(r.ran_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
