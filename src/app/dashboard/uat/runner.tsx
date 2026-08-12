"use client";
// ============================================================
//  ตัวจับเวลา UAT — ยื่นมือถือให้ผู้ทดสอบแล้วปล่อยให้ทำ
//
//  กติกาของการทดสอบแบบนี้ (อยู่ใน docs/UAT-PLAN.md): อ่านโจทย์ให้ฟัง แล้ว **เงียบ**
//  ห้ามชี้จอ ห้ามบอกทาง — สิ่งที่ต้องการคือ "เขาหาเจอเองไหม" ไม่ใช่ "เขาทำตามที่บอกได้ไหม"
//  หน้านี้จึงแสดงทีละข้อ ไม่โชว์ข้อถัดไป และไม่มีคำใบ้ใด ๆ บนจอ
//
//  ⚠️ ปุ่ม "ต้องช่วยบอก" มีไว้จริงจัง ไม่ใช่พิธี — ข้อที่ต้องช่วยบ่อยที่สุด
//     คือข้อที่ต้องแก้ก่อนใครเพื่อน ถ้าไม่มีปุ่มนี้คนจับเวลาจะกดว่า "ทำได้" แล้วข้อมูลเพี้ยน
// ============================================================
import { useState } from "react";
import { Button, Card, CardContent } from "@/components/ui";
import { Play, Check, Flag, HelpCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { logUatTask, type UatOutcome } from "./actions";

/** โจทย์ 7 ข้อ — ต้องตรงกับ docs/UAT-PLAN.md ห้ามแก้ที่เดียว */
const TASKS = [
  "ลองออกใบแจ้งหนี้ค่าบริการ 5,000 บาท บวก VAT ให้ลูกค้าชื่ออะไรก็ได้",
  "ส่งใบนี้ให้ลูกค้าจ่ายเงิน",
  "ลูกค้าโอนมาแล้ว บันทึกยังไง",
  "ถ่ายรูปบิลค่าของที่ซื้อมา ให้ระบบลงบัญชีให้",
  "เดือนนี้กำไรเท่าไหร่",
  "ภาษีเดือนนี้ต้องยื่นอะไร เท่าไหร่",
  "ลองสั่งงานผู้ช่วย AI ด้วยคำพูดของคุณเอง",
];

export default function UatRunner({ shopId }: { shopId: string }) {
  const [tester, setTester] = useState("A");
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [logged, setLogged] = useState<{ no: number; outcome: UatOutcome; sec: number }[]>([]);

  const task = TASKS[idx];
  const finished = idx >= TASKS.length;

  async function finish(outcome: UatOutcome) {
    if (startedAt === null) return;
    const seconds = (Date.now() - startedAt) / 1000;
    setSaving(true); setMsg(null);
    const r = await logUatTask(shopId, {
      tester, taskNo: idx + 1, taskTitle: task, outcome, seconds, note,
    });
    setSaving(false);
    if (!r.ok) { setMsg(r.error ?? "บันทึกไม่สำเร็จ"); return; }
    setLogged((l) => [...l, { no: idx + 1, outcome, sec: Math.round(seconds) }]);
    setStartedAt(null); setNote(""); setIdx((i) => i + 1);
  }

  function resetAll() {
    setIdx(0); setStartedAt(null); setNote(""); setLogged([]); setMsg(null);
  }

  if (finished) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm font-semibold">จบครบ 7 ข้อแล้ว — ผู้ทดสอบ {tester}</p>
          <ul className="space-y-1 text-sm">
            {logged.map((l) => (
              <li key={l.no} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                <span>ข้อ {l.no}</span>
                <span className={cn("text-xs font-medium",
                  l.outcome === "done" ? "text-emerald-700"
                    : l.outcome === "helped" ? "text-amber-700" : "text-red-600")}>
                  {l.outcome === "done" ? "ทำได้เอง" : l.outcome === "helped" ? "ต้องช่วยบอก" : "ยอมแพ้"} · {l.sec} วินาที
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            บันทึกลงระบบแล้ว ดูสรุปรวมทุกคนได้ที่ตารางด้านล่าง
          </p>
          <Button variant="outline" onClick={resetAll}>
            <RotateCcw className="h-4 w-4" /> เริ่มกับผู้ทดสอบคนถัดไป
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">ผู้ทดสอบ</span>
          {["A", "B", "C", "D"].map((t) => (
            <button key={t} onClick={() => { setTester(t); resetAll(); setTester(t); }}
              disabled={startedAt !== null}
              className={cn("h-9 w-9 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40",
                tester === t ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50")}>
              {t}
            </button>
          ))}
          <span className="ml-auto text-xs text-neutral-400">ข้อ {idx + 1} / {TASKS.length}</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs text-neutral-500">อ่านให้ผู้ทดสอบฟัง แล้วเงียบ — ห้ามชี้จอ ห้ามบอกทาง</p>
          <p className="mt-1.5 text-[15px] font-medium leading-relaxed">&ldquo;{task}&rdquo;</p>
        </div>

        {startedAt === null ? (
          <Button onClick={() => setStartedAt(Date.now())} className="w-full">
            <Play className="h-4 w-4" /> เริ่มจับเวลาข้อนี้
          </Button>
        ) : (
          <>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="จดสิ่งที่เห็น เช่น หาเมนูไม่เจอ · งงตรง VAT · กดผิดไปหน้าอื่น (ไม่ต้องใส่ชื่อคน)"
              className="min-h-20 w-full rounded-xl border border-neutral-300 p-3 text-sm outline-none focus:border-emerald-500"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="brand" disabled={saving} onClick={() => finish("done")}>
                <Check className="h-4 w-4" /> ทำได้เอง
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => finish("helped")}>
                <HelpCircle className="h-4 w-4" /> ต้องช่วยบอก
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => finish("gave_up")}>
                <Flag className="h-4 w-4" /> ยอมแพ้
              </Button>
            </div>
          </>
        )}

        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </CardContent>
    </Card>
  );
}
