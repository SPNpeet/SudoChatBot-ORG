"use client";
import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from "@/components/ui";
import { baht, cn } from "@/lib/utils";
import { createTopup, createOmiseTopup, getTopupStatus, changePlan } from "./actions";
import { Check, Wallet, Upload } from "lucide-react";

interface Plan { code: string; name: string; price_monthly: number; included_replies: number; price_per_extra_reply: number; features: string[] }
interface TopupState { topupId: string; qrUrl: string; promptpayId?: string; accountName?: string; amount: number; gateway?: "omise" }

export default function BillingClient({
  shopId, role, balance, currentPlan, plans, gateway = "promptpay_slip",
}: { shopId: string; role: string; balance: number; currentPlan: string; plans: Plan[]; gateway?: "promptpay_slip" | "omise" }) {
  const isOwnerAdmin = role === "owner" || role === "admin";
  const [amount, setAmount] = useState(300);
  const [topup, setTopup] = useState<TopupState | null>(null);
  const [pending, start] = useTransition();
  const [slipMsg, setSlipMsg] = useState<{ ok: boolean; text: string } | null>(null);
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

  function makeQr() {
    start(async () => {
      try {
        setOmisePaid(false);
        setTopup(gateway === "omise" ? await createOmiseTopup(shopId, amount) : await createTopup(shopId, amount));
        setSlipMsg(null);
      } catch (e) { alert((e as Error).message); }
    });
  }
  async function uploadSlip(file: File) {
    if (!topup) return;
    setUploading(true); setSlipMsg(null);
    try {
      const fd = new FormData();
      fd.append("topup_id", topup.topupId);
      fd.append("slip", file);
      const res = await fetch("/api/billing/topup-slip", { method: "POST", body: fd });
      const j = await res.json();
      setSlipMsg({ ok: j.ok, text: j.message ?? (j.ok ? "ส่งสลิปแล้ว" : j.error) });
      if (j.auto) setTimeout(() => location.reload(), 1500);
    } catch (e) { setSlipMsg({ ok: false, text: (e as Error).message }); }
    finally { setUploading(false); }
  }

  return (
    <>
      {/* ===== เติมเงิน ===== */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-600" /> เติมเงินเข้าเครดิต</CardTitle></CardHeader>
        <CardContent>
          {!isOwnerAdmin ? (
            <p className="text-sm text-neutral-400">เฉพาะเจ้าของ/ผู้ดูแลร้านเติมเงินได้</p>
          ) : !topup ? (
            <div className="space-y-3">
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
              <Button onClick={makeQr} disabled={pending || amount < 20}>{pending ? "กำลังสร้าง QR..." : `สร้าง QR เติม ${baht(amount)}`}</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-2xl border border-neutral-200 p-5">
                <p className="mb-1 text-sm font-medium">สแกนจ่ายด้วยแอปธนาคาร</p>
                <p className="mb-3 text-2xl font-bold text-emerald-600">{baht(topup.amount)}</p>
                {topup.qrUrl
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={topup.qrUrl} alt="PromptPay QR" className="h-56 w-56" />
                  : <p className="font-mono text-sm">พร้อมเพย์: {topup.promptpayId ?? "-"}</p>}
                <p className="mt-2 text-[11px] text-neutral-400">
                  {topup.gateway === "omise" ? "ชำระผ่าน Omise · เครดิตเข้าอัตโนมัติทันทีที่จ่ายสำเร็จ" : `${topup.accountName ?? "บัญชีแพลตฟอร์ม"} · พร้อมเพย์ ${topup.promptpayId ?? "-"}`}
                </p>
              </div>
              {topup.gateway === "omise" ? (
                <div className="rounded-xl bg-neutral-50 p-4 text-center">
                  {omisePaid
                    ? <p className="text-sm font-medium text-emerald-600">✓ ชำระเงินสำเร็จ! เครดิตเข้าแล้ว — กำลังรีเฟรช...</p>
                    : <p className="text-xs text-neutral-500"><span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" /> กำลังรอการชำระเงิน — ไม่ต้องอัปโหลดสลิป ระบบยืนยันอัตโนมัติ</p>}
                  {slipMsg && !slipMsg.ok && <p className="mt-2 text-xs text-red-600">{slipMsg.text}</p>}
                </div>
              ) : (
                <div className="rounded-xl bg-neutral-50 p-4">
                  <p className="mb-2 text-sm font-medium"><Upload className="mr-1 inline h-4 w-4" /> อัปโหลดสลิปเพื่อยืนยัน</p>
                  <input type="file" accept="image/*" disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && uploadSlip(e.target.files[0])}
                    className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:text-white" />
                  {uploading && <p className="mt-2 text-xs text-neutral-400">กำลังตรวจสอบสลิป...</p>}
                  {slipMsg && <p className={cn("mt-2 text-xs", slipMsg.ok ? "text-emerald-600" : "text-red-600")}>{slipMsg.text}</p>}
                </div>
              )}
              <button onClick={() => { setTopup(null); setSlipMsg(null); }} className="text-xs text-neutral-400 hover:text-neutral-700">← เติมจำนวนอื่น</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== แพ็กเกจ ===== */}
      <Card>
        <CardHeader><CardTitle>แพ็กเกจสมาชิก</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const current = p.code === currentPlan;
              return (
                <div key={p.code} className={cn("flex flex-col rounded-2xl border p-4", current ? "border-2 border-emerald-500" : "border-neutral-200")}>
                  {current && <Badge tone="green" className="mb-2 self-start">แพ็กเกจปัจจุบัน</Badge>}
                  <p className="font-bold">{p.name}</p>
                  <p className="mt-1"><span className="text-xl font-bold">{p.price_monthly ? baht(p.price_monthly) : "ฟรี"}</span>{p.price_monthly ? <span className="text-xs text-neutral-400">/เดือน</span> : ""}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">ตอบฟรี {p.included_replies.toLocaleString()} ข้อความ · เกิน {p.price_per_extra_reply}฿/ข้อความ</p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {(p.features ?? []).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-600"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> {f}</li>
                    ))}
                  </ul>
                  {!current && role === "owner" && (
                    <ChangePlanButton shopId={shopId} planCode={p.code} planName={p.name} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-neutral-400">* เปลี่ยนแพ็กเกจได้ทันที ค่าสมาชิกรายเดือนจะถูกหักจากเครดิต (ระบบตัดรอบบิลอัตโนมัติ)</p>
        </CardContent>
      </Card>
    </>
  );
}

function ChangePlanButton({ shopId, planCode, planName }: { shopId: string; planCode: string; planName: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="mt-3" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "กำลังเปลี่ยน..." : "เลือกแพ็กเกจนี้"}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold">เปลี่ยนเป็นแพ็กเกจ &ldquo;{planName}&rdquo;?</p>
            <p className="mt-2 text-sm text-neutral-500">
              มีผลทันที ค่าสมาชิกรายเดือนจะถูกหักจากเครดิตตามรอบบิลอัตโนมัติ เปลี่ยนกลับได้ตลอดเวลา
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button size="sm" onClick={() => { setOpen(false); start(async () => { await changePlan(shopId, planCode); }); }}>
                ยืนยันเปลี่ยนแพ็กเกจ
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
