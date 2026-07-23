"use client";
import { compressImage } from "@/lib/compress-image";
// ============================================================
//  แพ็กเกจ/เครดิต — โหมดหลัก: "จ่ายค่าแพ็กเกจตรง" สแกน QR ยอดเท่าราคาแพ็กพอดี
//  สลิปผ่าน (อัตโนมัติ/แอดมินยืนยัน) = แพ็กเปิดทันที ไม่ต้องเข้าใจระบบเครดิต
//  เติมเครดิตล่วงหน้าเป็นตัวเลือกเสริม (พับไว้)
// ============================================================
import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from "@/components/ui";
import { baht, cn } from "@/lib/utils";
import { createTopup, createOmiseTopup, getTopupStatus, changePlan, purchasePlan } from "./actions";
import { Check, Wallet, Upload, X } from "lucide-react";

interface Plan {
  code: string; name: string; price_monthly: number; included_replies: number;
  price_per_extra_reply: number; features: string[]; daily_reply_cap?: number | null;
  max_companies?: number | null; slip_quota?: number | null;
}
interface TopupState { topupId: string; qrUrl: string; promptpayId?: string; accountName?: string; amount: number; gateway?: "omise"; planName?: string }

export default function BillingClient({
  shopId, role, balance, currentPlan, plans, gateway = "promptpay_slip", gatewayReady = true,
}: { shopId: string; role: string; balance: number; currentPlan: string; plans: Plan[]; gateway?: "promptpay_slip" | "omise"; gatewayReady?: boolean }) {
  const isOwnerAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const [amount, setAmount] = useState(300);
  const [topup, setTopup] = useState<TopupState | null>(null);
  const [pending, start] = useTransition();
  const [slipMsg, setSlipMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [topupErr, setTopupErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [omisePaid, setOmisePaid] = useState(false);

  // Omise: poll สถานะทุก 4 วิ หลังโชว์ QR — จ่ายสำเร็จแล้วรีโหลด
  useEffect(() => {
    if (!topup || topup.gateway !== "omise" || omisePaid) return;
    const iv = setInterval(async () => {
      try {
        const status = await getTopupStatus(shopId, topup.topupId);
        if (status === "paid") { setOmisePaid(true); setTimeout(() => location.reload(), 1500); }
        if (status === "expired") { setTopup(null); setSlipMsg({ ok: false, text: "รายการหมดอายุ — สร้าง QR ใหม่อีกครั้ง" }); }
      } catch { /* ลองใหม่รอบถัดไป */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [topup, omisePaid, shopId]);

  function buyPlan(planCode: string, planName: string) {
    setTopupErr(null);
    start(async () => {
      setOmisePaid(false);
      const r = await purchasePlan(shopId, planCode);
      if (!r.ok) { setTopupErr(r.error); return; }
      setTopup({ ...r, planName });
      setSlipMsg(null);
    });
  }

  function makeTopupQr() {
    start(async () => {
      setOmisePaid(false);
      setTopupErr(null);
      const r = gateway === "omise" ? await createOmiseTopup(shopId, amount) : await createTopup(shopId, amount);
      if (!r.ok) { setTopupErr(r.error); return; }
      setTopup(r);
      setSlipMsg(null);
    });
  }

  async function uploadSlip(fileRaw: File) {
    if (!topup) return;
    setUploading(true); setSlipMsg(null); // spinner หมุนตั้งแต่เริ่มบีบอัด
    try {
      const file = await compressImage(fileRaw);
      const fd = new FormData();
      fd.append("topup_id", topup.topupId);
      fd.append("slip", file);
      const res = await fetch("/api/billing/topup-slip", { method: "POST", body: fd });
      const j = await res.json();
      setSlipMsg({ ok: j.ok, text: j.message ?? (j.ok ? "ส่งสลิปแล้ว" : j.error) });
      if (j.auto) setTimeout(() => location.reload(), 1600);
    } catch (e) { setSlipMsg({ ok: false, text: (e as Error).message }); }
    finally { setUploading(false); }
  }

  return (
    <>
      {/* ===== แพ็กเกจ (โหมดหลัก: จ่ายตรง) ===== */}
      <Card>
        <CardHeader><CardTitle>แพ็กเกจสมาชิก — จ่ายตรงผ่าน QR เปิดใช้ทันที</CardTitle></CardHeader>
        <CardContent>
          {!gatewayReady && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ระบบรับชำระยังไม่เปิด — ผู้ดูแลแพลตฟอร์มตั้งค่าพร้อมเพย์ได้ที่ <span className="font-medium">รายได้ + บัญชีรับเงิน</span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const current = p.code === currentPlan;
              const paid = Number(p.price_monthly) > 0;
              return (
                <div key={p.code} className={cn("flex flex-col rounded-2xl border p-4", current ? "border-2 border-emerald-500" : "border-neutral-200")}>
                  {current && <Badge tone="green" className="mb-2 self-start">แพ็กเกจปัจจุบัน</Badge>}
                  <p className="font-bold">{p.name}</p>
                  <p className="mt-1"><span className="text-xl font-bold">{paid ? baht(p.price_monthly) : "ฟรี"}</span>{paid ? <span className="text-xs text-neutral-400">/เดือน</span> : ""}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    🏢 {p.max_companies ? `${p.max_companies} กิจการ` : "ไม่จำกัดกิจการ"} · 👥 พนักงานไม่จำกัด
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    🤖 AI {p.code === "free" ? `${(p.daily_reply_cap ?? 30).toLocaleString()}/วัน` : `${p.included_replies.toLocaleString()}/เดือน`}
                    {" · "}🧾 สลิป {p.slip_quota ? `${p.slip_quota.toLocaleString()}/เดือน` : "ไม่จำกัด"}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {(p.features ?? []).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-600"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> {f}</li>
                    ))}
                  </ul>
                  {isOwner && paid && gatewayReady && (
                    <Button size="sm" className="mt-3" disabled={pending} onClick={() => buyPlan(p.code, p.name)}>
                      {pending ? "กำลังสร้าง QR..." : current ? `ต่ออายุ ${baht(p.price_monthly)}` : `สมัคร — จ่าย ${baht(p.price_monthly)}`}
                    </Button>
                  )}
                  {isOwner && !paid && !current && (
                    <DowngradeFreeButton shopId={shopId} planCode={p.code} planName={p.name} />
                  )}
                </div>
              );
            })}
          </div>
          {topupErr && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{topupErr}</p>}
          <p className="mt-3 text-[11px] text-neutral-400">
            สแกนจ่ายยอดเท่าราคาแพ็กพอดี — สลิปผ่านปุ๊บแพ็กเปิดทันที ต่ออายุอัตโนมัติจากเครดิต (ถ้ามี) หรือกลับมาจ่ายตรงรอบถัดไปก็ได้
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
                      className={cn("rounded-xl border px-4 py-2 text-sm", amount === a ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-300 hover:bg-neutral-50")}>
                      {baht(a)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-500">หรือระบุเอง</span>
                  <Input type="number" min={20} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-32" />
                  <span className="text-sm text-neutral-400">บาท</span>
                </div>
                <Button variant="outline" onClick={makeTopupQr} disabled={pending || amount < 20}>{pending ? "กำลังสร้าง QR..." : `สร้าง QR เติม ${baht(amount)}`}</Button>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* ===== Modal QR ชำระเงิน (ใช้ร่วมทั้งซื้อแพ็กและเติมเครดิต) ===== */}
      {topup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => { setTopup(null); setSlipMsg(null); }}>
          <div className="max-h-[92svh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">{topup.planName ? `ชำระค่าแพ็กเกจ "${topup.planName}"` : "เติมเครดิต"}</h2>
              <button onClick={() => { setTopup(null); setSlipMsg(null); }} className="rounded-lg p-1 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>

            {!topup.planName && (
              <div className="mb-3 flex items-center justify-center gap-3 rounded-xl bg-emerald-50/60 px-4 py-2.5 text-center text-sm">
                <div><p className="text-[11px] text-neutral-400">เครดิตตอนนี้</p><p className="font-semibold">{baht(balance)}</p></div>
                <span className="text-emerald-400">→</span>
                <div><p className="text-[11px] text-neutral-400">หลังยืนยัน</p><p className="font-bold text-emerald-600">{baht(balance + topup.amount)}</p></div>
              </div>
            )}

            <div className="flex flex-col items-center rounded-2xl border border-neutral-200 p-5">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-700">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                {topup.gateway === "omise" ? "รอการชำระเงิน" : "รอโอนเงิน"}
              </span>
              <p className="text-sm font-medium">① สแกน QR แล้วโอน</p>
              <p className="mb-3 text-3xl font-bold text-emerald-600">{baht(topup.amount)}</p>
              {topup.qrUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={topup.qrUrl} alt="PromptPay QR" className="h-52 w-52 max-w-full sm:h-56 sm:w-56" />
                : <p className="font-mono text-sm">พร้อมเพย์: {topup.promptpayId ?? "-"}</p>}
              <p className="mt-2 text-center text-[11px] text-neutral-400">
                {topup.gateway === "omise" ? "ชำระผ่าน Omise · ยืนยันอัตโนมัติทันทีที่จ่ายสำเร็จ" : `${topup.accountName ?? "บัญชีแพลตฟอร์ม"} · พร้อมเพย์ ${topup.promptpayId ?? "-"}`}
              </p>
            </div>

            {topup.gateway === "omise" ? (
              <div className="mt-3 rounded-xl bg-neutral-50 p-4 text-center">
                {omisePaid
                  ? <p className="text-sm font-medium text-emerald-600">✓ ชำระเงินสำเร็จ! {topup.planName ? "เปิดแพ็กเกจแล้ว" : "เครดิตเข้าแล้ว"} — กำลังรีเฟรช...</p>
                  : <p className="text-xs text-neutral-500"><span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" /> ② กำลังรอการชำระเงิน — ไม่ต้องอัปโหลดสลิป ระบบยืนยันอัตโนมัติ</p>}
                {slipMsg && !slipMsg.ok && <p className="mt-2 text-xs text-red-600">{slipMsg.text}</p>}
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-neutral-50 p-4">
                <p className="mb-2 text-sm font-medium"><Upload className="mr-1 inline h-4 w-4" /> ② อัปโหลดสลิปเพื่อยืนยัน</p>
                <input type="file" accept="image/*" capture="environment" disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && uploadSlip(e.target.files[0])}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:text-white" />
                {uploading
                  ? <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" /> กำลังตรวจสอบสลิป...</p>
                  : slipMsg
                    ? <p className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-xs", slipMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>{slipMsg.ok ? "✓ " : ""}{slipMsg.text}</p>
                    : <p className="mt-2 text-[11px] text-neutral-400">
                        โอนเสร็จแล้วถ่ายรูป/แคปสลิปมาอัปโหลด — ระบบตรวจอัตโนมัติ หรือแอดมินยืนยันให้ (ปกติไม่กี่นาที)
                        {topup.planName ? " ยืนยันแล้วแพ็กเกจเปิดทันที" : ""}
                      </p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DowngradeFreeButton({ shopId, planCode, planName }: { shopId: string; planCode: string; planName: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
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
