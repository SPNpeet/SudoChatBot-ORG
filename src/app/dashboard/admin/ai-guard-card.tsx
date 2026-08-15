"use client";
// เกราะกันค่า AI รั่ว — เจ้าของแพลตฟอร์มเห็นค่าวันนี้ + ตั้งเพดาน + ปิดฉุกเฉิน
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "@/components/ui";
import { ShieldAlert, Power, Gauge, TrendingUp, Database } from "lucide-react";
import { savePlatformAiGuard } from "./actions";

interface TopShop { name: string; shop_id: string; cost_usd: number; calls: number }
export interface AiGuardStatus {
  cost_usd_today: number;
  calls_today: number;
  cap_usd: number | null;
  kill_switch: boolean;
  top_shops_today: TopShop[];
  /** cache ติดแค่ไหนใน 7 วัน — cached_tokens เป็นส่วนย่อยของ in_tokens */
  cache_7d?: { in_tokens: number; cached_tokens: number };
}

// อัตราแลกโดยประมาณ แสดงเป็นบาทให้เห็นภาพ (USD ที่จ่ายค่าย AI จริง)
const USD_THB = 36;
const usd = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const thb = (n: number) => `~${Math.round((n ?? 0) * USD_THB).toLocaleString()} บาท`;

export default function AiGuardCard({ status }: { status: AiGuardStatus }) {
  const [cap, setCap] = useState(status.cap_usd != null ? String(status.cap_usd) : "");
  const [kill, setKill] = useState(status.kill_switch);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const capNum = cap.trim() ? Number(cap) : null;
  const pct = capNum && capNum > 0 ? Math.min(100, (status.cost_usd_today / capNum) * 100) : 0;
  const over = capNum != null && status.cost_usd_today >= capNum;

  // สัดส่วนโทเคนที่ cache ติดใน 7 วัน — ตัวเลขนี้คือคำตอบว่า "ที่ประหยัดได้เกิดขึ้นจริงไหม"
  // ไม่ใช่การคาดการณ์ แต่เป็นค่าที่ผู้ให้บริการตอบกลับมาเองในทุกคำขอ
  const cacheIn = status.cache_7d?.in_tokens ?? 0;
  const cacheHit = status.cache_7d?.cached_tokens ?? 0;
  const cachePct = cacheIn > 0 ? (cacheHit / cacheIn) * 100 : 0;

  function save(nextKill?: boolean) {
    const k = nextKill ?? kill;
    setMsg(null);
    start(async () => {
      const r = await savePlatformAiGuard(capNum, k);
      if (r.ok) { setKill(k); setMsg({ ok: true, text: "บันทึกแล้ว" }); }
      else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-emerald-600" /> เกราะกันค่า AI รั่ว (คุมเงินที่คุณจ่าย)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ค่าวันนี้ */}
        <div className="rounded-xl border border-neutral-200 p-4">
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><TrendingUp className="h-3.5 w-3.5" /> ค่า AI ที่แพลตฟอร์มจ่ายวันนี้ (ทุกร้านรวมกัน)</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{usd(status.cost_usd_today)} <span className="text-sm font-normal text-neutral-400">{thb(status.cost_usd_today)} · {status.calls_today.toLocaleString()} ครั้ง</span></p>
          {capNum != null && capNum > 0 && (
            <div className="mt-2">
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div className={`h-full ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`mt-1 text-xs ${over ? "text-red-600 font-medium" : "text-neutral-400"}`}>
                {over ? "เกินเพดานแล้ว — บอทตอบลูกค้าหยุดชั่วคราวอัตโนมัติ" : `${pct.toFixed(0)}% ของเพดาน ${usd(capNum)}/วัน`}
              </p>
            </div>
          )}
        </div>

        {/* cache ติดแค่ไหน — ยิ่งสูงยิ่งจ่ายถูกลงโดยไม่ต้องเปลี่ยนอะไรเลย */}
        {cacheIn > 0 && (
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Database className="h-3.5 w-3.5" /> โทเคนที่ใช้ซ้ำได้ (cache) ใน 7 วัน
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {cachePct.toFixed(0)}%
              <span className="ml-2 text-sm font-normal text-neutral-400">
                {cacheHit.toLocaleString()} จาก {cacheIn.toLocaleString()} โทเคน
              </span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {cachePct >= 30
                ? "cache ทำงานอยู่ — ส่วนที่ซ้ำถูกคิดราคาถูกลงแล้ว"
                : "cache แทบไม่ติด — ปกติของระบบที่มีคนใช้ห่าง ๆ (cache ของผู้ให้บริการอยู่ได้ไม่กี่นาที) จะดีขึ้นเองเมื่อคนใช้ถี่ขึ้น"}
            </p>
          </div>
        )}

        {/* ตั้งเพดาน */}
        <div>
          <Label className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> เพดานค่า AI ต่อวัน (USD) — เว้นว่าง = ไม่จำกัด</Label>
          <div className="mt-1 flex gap-2">
            <Input type="number" min="0" step="0.5" value={cap} onChange={(e) => setCap(e.target.value)}
              placeholder="เช่น 5 = จ่ายไม่เกิน ~180 บาท/วัน" className="flex-1" />
            <Button size="sm" onClick={() => save()} disabled={pending}>{pending ? "บันทึก..." : "บันทึกเพดาน"}</Button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">เกินเพดานเมื่อไหร่ บอทตอบลูกค้าหยุดทันทีจนถึงเที่ยงคืน (เวลาไทย) — เครื่องมือของคุณ (ผู้จัดการร้าน AI ฯลฯ) ยังใช้ได้ปกติ</p>
        </div>

        {/* สวิตช์ฉุกเฉิน */}
        <div className={`flex items-center justify-between rounded-xl border p-3 ${kill ? "border-red-300 bg-red-50" : "border-neutral-200"}`}>
          <div className="flex items-center gap-2">
            <Power className={`h-4 w-4 ${kill ? "text-red-600" : "text-neutral-400"}`} />
            <div>
              <p className="text-sm font-medium">{kill ? "AI ถูกปิดฉุกเฉินอยู่" : "ปิด AI ฉุกเฉิน (Kill Switch)"}</p>
              <p className="text-xs text-neutral-400">ถ้าเห็นว่าโดนโจมตี กดปิดหยุดบอทตอบลูกค้าทั้งแพลตฟอร์มทันที</p>
            </div>
          </div>
          <Button size="sm" variant={kill ? "outline" : "ghost"} onClick={() => save(!kill)} disabled={pending}
            className={kill ? "" : "text-red-600 hover:bg-red-50"}>
            {kill ? "เปิด AI กลับ" : "ปิดฉุกเฉิน"}
          </Button>
        </div>

        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}

        {/* ร้านที่ใช้ AI เยอะสุดวันนี้ */}
        {status.top_shops_today.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">ร้านที่ใช้ AI เยอะสุดวันนี้ (จับตาร้านที่ผิดปกติ)</p>
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
              {status.top_shops_today.map((s) => (
                <div key={s.shop_id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <span className="truncate text-neutral-700">{s.name}</span>
                  <span className="shrink-0 text-neutral-400">{usd(s.cost_usd)} · {s.calls} ครั้ง</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
