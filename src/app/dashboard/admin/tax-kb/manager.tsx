"use client";
// ============================================================
//  จัดการความรู้ภาษี — เพิ่ม/แก้/ลบ + สร้างเวกเตอร์
//
//  ⚠️ ป้าย "ยังไม่มีเวกเตอร์" ไม่ใช่ของประดับ — แถวที่ไม่มีเวกเตอร์ยังค้นเจอได้
//     ด้วยการเทียบข้อความ แต่จะเจอเฉพาะเมื่อผู้ใช้พิมพ์คำใกล้เคียงของจริง
//     คำถามที่ใช้คำต่างออกไป (เช่น "โกดัง" กับ "อสังหาริมทรัพย์") จะหาไม่เจอ
// ============================================================
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea } from "@/components/ui";
import { Plus, Pencil, Trash2, Sparkles, X, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveTaxKnowledge, deleteTaxKnowledge, buildTaxEmbeddings, type TaxKbInput } from "./actions";

export interface TaxKbRow {
  id: string; topic: string; content: string; citation: string;
  source_url: string | null; effective_from: string; effective_to: string | null;
  tags: string[]; keywords: string; has_vector: boolean; effective_label: string;
}

const EMPTY: TaxKbInput = {
  topic: "", content: "", citation: "", sourceUrl: "",
  effectiveFrom: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10),
  effectiveTo: "", tags: "", keywords: "",
};

export default function TaxKbManager({ rows, missingVectors }: { rows: TaxKbRow[]; missingVectors: number }) {
  const [form, setForm] = useState<TaxKbInput | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [autoBuilding, setAutoBuilding] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (k: keyof TaxKbInput, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  function submit() {
    if (!form) return;
    setMsg(null);
    start(async () => {
      const r = await saveTaxKnowledge(form);
      if (r.ok) { setForm(null); setMsg({ ok: true, text: r.message }); }
      else setMsg({ ok: false, text: r.error });
    });
  }

  function remove(id: string) {
    setMsg(null);
    start(async () => {
      const r = await deleteTaxKnowledge(id);
      setConfirmId(null);
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  }

  /**
   * ไล่สร้างเวกเตอร์จนหมด — ฝั่งเซิร์ฟเวอร์ทำได้ครั้งละ 20 แถว จึงต้องวนเรียก
   *
   * ⚠️ ต้องมีเพดานรอบ ห้ามวน while จนกว่าจะหมด
   * ถ้าคีย์ค่ายใช้ไม่ได้ ฝั่งเซิร์ฟเวอร์จะคืน ok:false ทุกครั้ง — ไม่มีเพดาน = วนยิงไม่จบ
   * และแต่ละรอบคือการยิง API ที่เสียเงินจริง (กติกาข้อ 3: อยากให้หยุดต้องเขียนให้หยุด)
   */
  async function runBuild(): Promise<{ ok: boolean; text: string }> {
    let total = 0;
    for (let pass = 0; pass < 10; pass++) {
      const r = await buildTaxEmbeddings();
      if (!r.ok) return total > 0
        ? { ok: false, text: `สร้างได้ ${total} แถวแล้วหยุด — ${r.error}` }
        : { ok: false, text: r.error };
      const n = Number(r.message.match(/(\d+)\s*แถว/)?.[1] ?? 0);
      total += n;
      if (n === 0) break;                       // ไม่มีอะไรเหลือให้ทำแล้ว
    }
    router.refresh();
    return { ok: true, text: total > 0 ? `สร้างเวกเตอร์แล้ว ${total} เรื่อง` : "ทุกเรื่องมีเวกเตอร์ครบแล้ว" };
  }

  function buildVectors() {
    setMsg(null);
    start(async () => setMsg(await runBuild()));
  }

  // ============================================================
  //  เปิดหน้ามาแล้วยังมีเรื่องที่ไม่มีเวกเตอร์ = สร้างให้เลย ไม่ต้องรอใครกดปุ่ม
  //
  //  ⚠️ ทำไมต้องอัตโนมัติ ทั้งที่มีปุ่มอยู่แล้ว
  //  ปุ่มนี้มีมาตั้งแต่วันแรก แต่คลังทั้ง 11 เรื่อง **ไม่มีเวกเตอร์เลยสักเรื่อง**
  //  ค้างข้ามหลายวันจนเจ้าของเปิดมาเจอเอง (26 ส.ค. 2569) — ปุ่มที่ต้องจำไปกด
  //  ในหน้าที่แทบไม่มีใครเปิด มีค่าเท่ากับไม่มี (กติกาข้อ 3)
  //
  //  ⚠️ ยิงครั้งเดียวต่อการเปิดหน้า (didAuto) และเฉพาะตอนมีของค้างจริง
  //  ฝั่งเซิร์ฟเวอร์ยังตรวจ assertPlatformAdmin เหมือนเดิม การยิงจากตรงนี้ไม่ได้ข้ามด่านใด
  // ============================================================
  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current || missingVectors <= 0) return;
    didAuto.current = true;
    setAutoBuilding(true);
    (async () => {
      const r = await runBuild();
      setAutoBuilding(false);
      setMsg(r);
    })();
    // runBuild ถูกสร้างใหม่ทุก render — ใส่ใน deps จะทำให้เอฟเฟกต์วิ่งซ้ำและยิง API รัว
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingVectors]);

  return (
    <div className="space-y-4">
      {missingVectors > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1 text-sm">
              <b>{missingVectors} เรื่องยังไม่มีเวกเตอร์</b> — {autoBuilding
                ? "กำลังสร้างให้อัตโนมัติ ไม่ต้องกดอะไร"
                : "ระหว่างนี้ระบบค้นให้ด้วยการเทียบข้อความ ซึ่งเจอเฉพาะเมื่อผู้ใช้พิมพ์คำใกล้เคียงของจริง"}
            </p>
            <Button variant="brand" disabled={pending || autoBuilding} onClick={buildVectors}>
              <Sparkles className="h-4 w-4" /> {autoBuilding ? "กำลังสร้างเวกเตอร์..." : "สร้างเวกเตอร์"}
            </Button>
          </CardContent>
        </Card>
      )}

      {msg && (
        <p className={cn("rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
          {msg.text}
        </p>
      )}

      {form ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{form.id ? "แก้ไขความรู้" : "เพิ่มความรู้ใหม่"}</span>
              <Button variant="ghost" size="sm" onClick={() => { setForm(null); setMsg(null); }}>
                <X className="h-4 w-4" /> ยกเลิก
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>หัวข้อ</Label>
              <Input value={form.topic} onChange={(e) => set("topic", e.target.value)}
                placeholder="เช่น อัตราหักภาษี ณ ที่จ่ายค่าเช่าอสังหาริมทรัพย์" />
            </div>
            <div>
              <Label>เนื้อหา — เขียนให้ตอบคำถามได้ครบในตัวเอง</Label>
              <Textarea className="min-h-40" value={form.content} onChange={(e) => set("content", e.target.value)}
                placeholder="อธิบายให้จบในย่อหน้าเดียว ผู้ช่วย AI จะเอาข้อความนี้ไปตอบผู้ใช้ตรง ๆ" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>ที่มาอ้างอิง (จำเป็น)</Label>
                <Input value={form.citation} onChange={(e) => set("citation", e.target.value)}
                  placeholder="เช่น ประมวลรัษฎากร ม.86/4" />
              </div>
              <div>
                <Label>ลิงก์แหล่งที่มา</Label>
                <Input value={form.sourceUrl ?? ""} onChange={(e) => set("sourceUrl", e.target.value)}
                  placeholder="https://www.rd.go.th/..." />
              </div>
              <div>
                <Label>เริ่มใช้บังคับ (YYYY-MM-DD)</Label>
                <Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} />
              </div>
              <div>
                <Label>สิ้นสุด — เว้นว่าง = ยังใช้อยู่</Label>
                <Input type="date" value={form.effectiveTo ?? ""} onChange={(e) => set("effectiveTo", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>คำที่ผู้ใช้พิมพ์จริง (คั่นด้วยเว้นวรรค) — สำคัญมาก</Label>
              <Textarea className="min-h-20" value={form.keywords ?? ""} onChange={(e) => set("keywords", e.target.value)}
                placeholder="เช่น โกดัง คลังสินค้า ออฟฟิศ ฟรีแลนซ์ กี่เปอร์เซ็นต์ ต้องหักไหม" />
              <p className="mt-1 text-xs text-neutral-500">
                เนื้อหาเขียนด้วยภาษากฎหมาย แต่ผู้ใช้พิมพ์ด้วยภาษาคน — วัดแล้วช่องนี้เปลี่ยนผลค้นจากถูก 1 ใน 6 เป็น 6 ใน 6
              </p>
            </div>
            <div>
              <Label>ป้ายกำกับ (คั่นด้วยจุลภาค)</Label>
              <Input value={form.tags ?? ""} onChange={(e) => set("tags", e.target.value)} placeholder="vat, ใบกำกับภาษี" />
            </div>
            <Button variant="brand" disabled={pending} onClick={submit}>
              {pending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
            <p className="text-xs text-neutral-500">
              บันทึกแล้วเวกเตอร์เดิมจะถูกล้างทิ้งเสมอ เพราะเนื้อหาเปลี่ยนแล้วเวกเตอร์เก่าจะชี้ไปผิดเรื่อง — กดสร้างเวกเตอร์ใหม่อีกครั้ง
            </p>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => { setForm({ ...EMPTY }); setMsg(null); }}>
          <Plus className="h-4 w-4" /> เพิ่มความรู้ใหม่
        </Button>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 font-medium">{r.topic}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  r.has_vector ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                  {r.has_vector ? "ค้นด้วยเวกเตอร์" : "ยังไม่มีเวกเตอร์"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-neutral-600">{r.content}</p>
              <p className="text-xs text-neutral-500">
                {r.citation} · {r.effective_label}
                {r.source_url && (
                  <>
                    {" · "}
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2">
                      แหล่งที่มา <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </p>
              {r.keywords ? (
                <p className="text-xs text-neutral-400">คำค้น: {r.keywords}</p>
              ) : (
                <p className="text-xs font-medium text-amber-700">ยังไม่มีคำค้น — ผู้ใช้ที่พิมพ์ด้วยคำของตัวเองจะหาเรื่องนี้ไม่เจอ</p>
              )}
              {r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => {
                  setMsg(null);
                  setForm({
                    id: r.id, topic: r.topic, content: r.content, citation: r.citation,
                    sourceUrl: r.source_url ?? "", effectiveFrom: r.effective_from,
                    effectiveTo: r.effective_to ?? "", tags: r.tags.join(", "), keywords: r.keywords,
                  });
                }}>
                  <Pencil className="h-4 w-4" /> แก้ไข
                </Button>
                {confirmId === r.id ? (
                  <>
                    <Button variant="danger" size="sm" disabled={pending} onClick={() => remove(r.id)}>
                      ยืนยันลบ
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>ไม่ลบ</Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(r.id)}>
                    <Trash2 className="h-4 w-4" /> ลบ
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
