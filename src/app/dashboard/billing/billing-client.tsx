"use client";
// ============================================================
//  แพ็กเกจ/เครดิต — จ่ายผ่าน Stripe ทางเดียว
//
//  5 ส.ค. 2569 ตัด QR + อัปโหลดสลิป + Omise ออกหมด
//  เดิมผู้ใช้ต้อง: สแกน -> โอน -> แคปสลิป -> อัปโหลด -> รอคนตรวจ (5 ขั้น มีคนกลาง)
//  ตอนนี้: กดปุ่ม -> จ่ายบนหน้า Stripe -> แพ็กเปิดเอง (2 ขั้น ไม่มีคนกลาง)
//
//  ⚠️ หน้านี้ "ยืนยันการจ่ายเงินเองไม่ได้" โดยเจตนา — ตัวตัดสินคือ webhook
//  ที่ตรวจลายเซ็นแล้วเท่านั้น ที่นี่ทำได้แค่ถามสถานะจากฐานข้อมูลไปเรื่อย ๆ
// ============================================================
import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from "@/components/ui";
import { baht, cn } from "@/lib/utils";
import { createTopup, getTopupStatus, changePlan, purchasePlan } from "./actions";
import { Check, Wallet, Loader2 } from "lucide-react";
import { useDismiss } from "@/components/use-dismiss";

interface Plan {
  code: string; name: string; price_monthly: number; included_replies: number;
  price_per_extra_reply: number; features: string[]; daily_reply_cap?: number | null;
  max_companies?: number | null; slip_quota?: number | null;
}

export default function BillingClient({
  shopId, role, balance, currentPlan, plans, gatewayReady = true,
}: { shopId: string; role: string; balance: number; currentPlan: string; plans: Plan[]; gatewayReady?: boolean }) {
  const isOwnerAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const [amount, setAmount] = useState(300);
  // งวดชำระ: รายปี = จ่าย 10 เดือน ใช้ 12 เดือน — ยอดจริงคำนวณฝั่ง server เสมอ
  // ตัวเลขบนปุ่มเป็นแค่พรีวิว ถ้าแก้สูตรต้องแก้ที่ purchasePlan + apply_plan_purchase ก่อน
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  // แพ็กที่ผู้ใช้กำลังเล็งอยู่ — เริ่มที่แพ็กปัจจุบัน กดใบไหนก็เด้งไปเน้นใบนั้น
  const [selected, setSelected] = useState<string>(currentPlan);
  const [buying, setBuying] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [topupErr, setTopupErr] = useState<string | null>(null);

  // ---- กลับมาจากหน้าจ่ายของ Stripe ----
  // ⚠️ การกลับมาที่ ?paid= ไม่ใช่หลักฐานว่าจ่ายแล้ว (พิมพ์เองก็ได้) — เป็นแค่สัญญาณให้เริ่มถามสถานะจริง
  // อ่านจาก window.location แทน useSearchParams เพื่อไม่ต้องพึ่ง Suspense boundary
  const [wait, setWait] = useState<{ id: string; state: "waiting" | "paid" | "slow" } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const paid = q.get("paid");
    if (paid) setWait({ id: paid, state: "waiting" });
    if (paid || q.get("canceled")) {
      // ล้าง query ทิ้งทันที — ไม่งั้นรีเฟรชหน้าทีไรก็ขึ้นกล่อง "กำลังยืนยัน" ซ้ำตลอด
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  useEffect(() => {
    if (!wait || wait.state !== "waiting") return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      try {
        const status = await getTopupStatus(shopId, wait.id);
        if (status === "paid") {
          setWait({ id: wait.id, state: "paid" });
          setTimeout(() => location.reload(), 1200);
          return;
        }
      } catch { /* ลองใหม่รอบถัดไป */ }
      // ~1 นาทีแล้วยังไม่เข้า: บอกตรง ๆ ว่ายังไม่ได้รับการยืนยัน ห้ามหลอกว่าสำเร็จ
      if (tries >= 20) setWait({ id: wait.id, state: "slow" });
    }, 3000);
    return () => clearInterval(iv);
  }, [wait, shopId]);

  function buyPlan(planCode: string) {
    setTopupErr(null);
    setBuying(planCode);   // จำว่ากดแพ็กไหน — ไม่งั้นทุกใบขึ้น "กำลังพาไป..." พร้อมกัน ผู้ใช้ไม่รู้ว่ากดอันไหน
    start(async () => {
      let leaving = false;
      try {
        const r = await purchasePlan(shopId, planCode, period);
        if (!r.ok) { setTopupErr(r.error); return; }
        // ปุ่มต้องค้างเป็น "กำลังพาไป…" จนกว่าเบราว์เซอร์จะเปลี่ยนหน้าจริง
        // ถ้าปล่อยให้กลับเป็นปกติ ผู้ใช้จะกดซ้ำแล้วได้รายการค้างเพิ่มอีกใบ
        leaving = true;
        window.location.href = r.checkoutUrl;
      } finally { if (!leaving) setBuying(null); }
    });
  }

  function topUp() {
    start(async () => {
      setTopupErr(null);
      const r = await createTopup(shopId, amount);
      if (!r.ok) { setTopupErr(r.error); return; }
      window.location.href = r.checkoutUrl;
    });
  }

  return (
    <>
      {/* ===== กลับมาจากหน้าจ่ายของ Stripe ===== */}
      {wait && (
        <div className={cn(
          "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
          wait.state === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : wait.state === "slow" ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-neutral-200 bg-neutral-50 text-neutral-700",
        )}>
          {wait.state === "paid"
            ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            : <Loader2 className={cn("mt-0.5 h-4 w-4 shrink-0", wait.state === "slow" ? "text-amber-600" : "animate-spin text-neutral-400")} />}
          <span>
            {wait.state === "paid" ? "ชำระเงินสำเร็จ — กำลังรีเฟรชหน้า"
              : wait.state === "slow" ? "ยังไม่ได้รับการยืนยันจากธนาคาร — ถ้าเงินออกจากบัญชีแล้วระบบจะเปิดให้อัตโนมัติภายในไม่กี่นาที ไม่ต้องจ่ายซ้ำ"
                : "กำลังยืนยันการชำระเงิน…"}
          </span>
        </div>
      )}

      {/* ===== แพ็กเกจ ===== */}
      <Card>
        <CardHeader><CardTitle>แพ็กเกจสมาชิก — จ่ายออนไลน์ เปิดใช้ทันที</CardTitle></CardHeader>
        <CardContent>
          {!gatewayReady && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ระบบรับชำระเงินยังไม่เปิด — ผู้ดูแลแพลตฟอร์มตั้งค่าได้ที่ <span className="font-medium">รายได้ + บัญชีรับเงิน</span>
            </div>
          )}
          {/* สวิตช์งวดชำระ — ปุ่มจริง 44px ไม่ใช่ลิงก์จิ๋ว เพราะนี่คือจุดตัดสินใจจ่ายเงิน */}
          <div className="mb-4 flex justify-center">
            <div role="radiogroup" aria-label="งวดชำระ" className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1">
              {([["monthly", "รายเดือน"], ["yearly", "รายปี — จ่าย 10 เดือน ฟรี 2 เดือน"]] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={period === v}
                  onClick={() => setPeriod(v)}
                  className={cn(
                    "min-h-[44px] rounded-lg px-4 text-sm font-medium transition-colors",
                    period === v ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200" : "text-neutral-500 hover:text-neutral-800",
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* กลุ่มตัวเลือกแพ็กเกจ = radiogroup จริง ๆ ไม่ใช่กอง div ที่บังเอิญกดได้
              เดิมเป็น <div onClick> ซึ่งคนที่ใช้คีย์บอร์ดหรือโปรแกรมอ่านหน้าจอ
              เลือกแพ็กเกจไม่ได้เลย ทั้งที่เป็นขั้นตอนจ่ายเงิน */}
          <div role="radiogroup" aria-label="เลือกแพ็กเกจ" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const current = p.code === currentPlan;
              const paid = Number(p.price_monthly) > 0;
              const picked = selected === p.code;
              // ยอดที่ต้องจ่ายตามงวด — พรีวิวเท่านั้น ยอดจริงมาจาก server (purchasePlan)
              const payPrice = Number(p.price_monthly) * (period === "yearly" ? 10 : 1);
              return (
                // กดได้ทั้งใบ = "เลือก" เท่านั้น ยังไม่จ่าย — ต้องกดปุ่มยืนยันอีกที กันกดโดนแล้วเสียเงิน
                // ใช้ div + role=radio ไม่ใช่ <button> เพราะข้างในการ์ดมีปุ่ม "สมัคร — จ่าย" อยู่แล้ว
                // และ <button> ซ้อน <button> เป็น HTML ที่ไม่ถูกต้อง
                // จึงต้องเติม tabIndex + onKeyDown เองเพื่อให้ Tab ถึงและกด Enter/Space เลือกได้
                <div key={p.code} role="radio" aria-checked={picked}
                  tabIndex={picked || (!selected && p.code === plans[0]?.code) ? 0 : -1}
                  aria-label={`แพ็กเกจ ${p.name} ${paid ? baht(payPrice) + (period === "yearly" ? " ต่อปี" : " ต่อเดือน") : "ฟรี"}${current ? " (แพ็กเกจปัจจุบัน)" : ""}`}
                  onClick={() => setSelected(p.code)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(p.code); return; }
                    // ลูกศรเลื่อนระหว่างตัวเลือก ตามพฤติกรรมมาตรฐานของ radiogroup
                    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
                      e.preventDefault();
                      const i = plans.findIndex((x) => x.code === p.code);
                      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                      const next = plans[(i + step + plans.length) % plans.length];
                      if (next) {
                        setSelected(next.code);
                        (e.currentTarget.parentElement?.children[plans.indexOf(next)] as HTMLElement | undefined)?.focus();
                      }
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-2xl border p-4 transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                    picked
                      ? "border-emerald-500 bg-emerald-50/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                      : "border-neutral-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md",
                  )}>
                  <div className="mb-2 flex min-h-[22px] items-center gap-1.5">
                    {current && <Badge tone="green">แพ็กเกจปัจจุบัน</Badge>}
                    {picked && !current && <Badge tone="blue">กำลังเลือก</Badge>}
                  </div>
                  <p className="font-bold">{p.name}</p>
                  <p className="mt-1"><span className="text-xl font-bold tabular-nums">{paid ? baht(payPrice) : "ฟรี"}</span>{paid ? <span className="text-xs text-neutral-400">{period === "yearly" ? "/ปี" : "/เดือน"}</span> : ""}</p>
                  {paid && period === "yearly" && (
                    <p className="mt-0.5 text-[11px] font-medium text-emerald-700">จ่ายครั้งเดียว ใช้ 12 เดือน — ประหยัด {baht(Number(p.price_monthly) * 2)}</p>
                  )}
                  <dl className="mt-2 space-y-1 text-[11px] text-neutral-500">
                    <div className="flex justify-between gap-2"><dt>กิจการ</dt><dd className="font-medium text-neutral-700">{p.max_companies ? `${p.max_companies} กิจการ` : "ไม่จำกัด"}</dd></div>
                    <div className="flex justify-between gap-2"><dt>พนักงาน</dt><dd className="font-medium text-neutral-700">ไม่จำกัด</dd></div>
                    <div className="flex justify-between gap-2"><dt>งาน AI</dt><dd className="font-medium text-neutral-700">{p.code === "free" ? `${(p.daily_reply_cap ?? 30).toLocaleString()}/วัน` : `${p.included_replies.toLocaleString()}/เดือน`}</dd></div>
                    <div className="flex justify-between gap-2"><dt>ตรวจสลิป</dt><dd className="font-medium text-neutral-700">{p.slip_quota ? `${p.slip_quota.toLocaleString()}/เดือน` : "ไม่จำกัด"}</dd></div>
                  </dl>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {(p.features ?? []).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-600"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> {f}</li>
                    ))}
                  </ul>
                  {isOwner && paid && gatewayReady && (
                    <Button size="lg" variant={picked ? "brand" : "outline"} className="mt-3 w-full"
                      disabled={pending} onClick={(e) => { e.stopPropagation(); setSelected(p.code); buyPlan(p.code); }}>
                      {buying === p.code
                        ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังพาไปหน้าชำระเงิน…</>
                        : current ? `ต่ออายุ ${baht(payPrice)}` : `สมัคร — จ่าย ${baht(payPrice)}`}
                    </Button>
                  )}
                  {isOwner && !paid && !current && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DowngradeFreeButton shopId={shopId} planCode={p.code} planName={p.name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {topupErr && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{topupErr}</p>}
          <p className="mt-3 text-[11px] text-neutral-400">
            จ่ายด้วยพร้อมเพย์หรือบัตรบนหน้าชำระเงินที่ปลอดภัย — จ่ายเสร็จแพ็กเปิดทันที ไม่ต้องอัปโหลดสลิป ไม่ต้องรอใครอนุมัติ · ไม่มีสัญญาผูกมัด ยกเลิกได้ตลอด
          </p>
        </CardContent>
      </Card>

      {/* ===== เติมเครดิตล่วงหน้า (ตัวเลือกเสริม) ===== */}
      {isOwnerAdmin && gatewayReady && (
        <Card>
          <CardContent className="pt-4">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-neutral-600 hover:text-neutral-900">
                <Wallet className="mr-1.5 inline h-4 w-4 text-emerald-600" /> เติมเครดิตล่วงหน้า (ไม่บังคับ — ไว้ให้ระบบต่ออายุแพ็กอัตโนมัติ)
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[100, 300, 500, 1000, 2000].map((a) => (
                    <button key={a} onClick={() => setAmount(a)}
                      className={cn("min-h-[44px] rounded-xl border px-4 py-2 text-sm", amount === a ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-300 hover:bg-neutral-50")}>
                      {baht(a)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-500">หรือระบุเอง</span>
                  <Input type="number" min={20} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-32" />
                  <span className="text-sm text-neutral-400">บาท</span>
                </div>
                <Button variant="outline" onClick={topUp} disabled={pending || amount < 20}>
                  {pending ? "กำลังพาไปหน้าชำระเงิน..." : `ชำระเงินเติม ${baht(amount)}`}
                </Button>
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function DowngradeFreeButton({ shopId, planCode, planName }: { shopId: string; planCode: string; planName: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  useDismiss(open, () => setOpen(false));
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="outline" className="mt-3" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "กำลังเปลี่ยน..." : "ใช้แพ็กฟรี"}
      </Button>
      {err && <p className="mt-1.5 text-[11px] text-red-600">{err}</p>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold">เปลี่ยนเป็นแพ็กเกจ &ldquo;{planName}&rdquo;?</p>
            <p className="mt-2 text-sm text-neutral-500">มีผลทันที กลับมาสมัครแพ็กเสียเงินเมื่อไหร่ก็ได้</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button size="sm" onClick={() => {
                setOpen(false); setErr(null);
                start(async () => {
                  const r = await changePlan(shopId, planCode);
                  if (!r.ok) setErr(r.error);
                });
              }}>ยืนยัน</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
