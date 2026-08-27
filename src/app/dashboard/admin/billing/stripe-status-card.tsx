// ============================================================
//  ความพร้อมรับเงินจริง — ถาม Stripe ตรงทุกครั้งที่เปิดหน้า
//
//  ทำไมต้องมี (11 ส.ค. 2569): เจ้าของถามว่า "สมัคร Stripe ไปแล้ว พอหรือยัง"
//  ซึ่งเดิมตอบไม่ได้เลยจากในระบบ ต้องไปเปิดหน้า Stripe เทียบเอง
//  และคำตอบจริงตอนนั้นคือ **ยังไม่พอ** — details_submitted = false
//  (สมัครบัญชีแล้วจริง แต่ยังไม่ได้กรอกข้อมูลธุรกิจให้จบ จึงยังรับเงินไม่ได้)
//
//  การ์ดนี้เปลี่ยนคำถามนั้นให้ตอบได้เองตลอดเวลา และบอกด้วยว่าขั้นถัดไปคืออะไร
//
//  ⚠️ ห้ามส่งค่าคีย์ลงไปฝั่ง client — ทุกอย่างในนี้คำนวณฝั่ง server แล้วส่งแต่ผลสรุป
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { STRIPE_WEBHOOK_EVENTS } from "@/lib/stripe";
import { getStripeSecretKey, isLiveStripeKey } from "@/lib/stripe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CheckCircle2, TriangleAlert, CircleAlert, ExternalLink } from "lucide-react";

interface StripeAccount {
  id?: string;
  country?: string;
  default_currency?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  capabilities?: Record<string, string>;
  requirements?: { disabled_reason?: string | null; currently_due?: string[] };
  error?: { message?: string };
}

/** ถาม Stripe ว่าบัญชีนี้รับเงินได้จริงหรือยัง — ล้มเหลวต้องไม่ทำให้ทั้งหน้าพัง */
async function fetchAccount(secretKey: string): Promise<StripeAccount | null> {
  try {
    const r = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return (await r.json()) as StripeAccount;
  } catch {
    return null;
  }
}

function Line({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
      <span className={ok ? "text-neutral-700" : "text-red-700"}>
        {label}
        {note && <span className="block text-xs text-neutral-500">{note}</span>}
      </span>
    </li>
  );
}

export default async function StripeStatusCard() {
  const svc = createServiceClient();
  const key = await getStripeSecretKey(svc);

  if (!key) {
    return (
      <Card>
        <CardHeader><CardTitle>ความพร้อมรับเงินจริง</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">ยังไม่ได้ใส่ Stripe secret key — กรอกในช่องด้านบนก่อน</p>
        </CardContent>
      </Card>
    );
  }

  const live = isLiveStripeKey(key);
  const acct = await fetchAccount(key);
  const reachable = !!acct && !acct.error;
  const caps = acct?.capabilities ?? {};
  const promptpay = caps.promptpay_payments === "active";
  const card = caps.card_payments === "active";
  const anyMethod = promptpay || card;

  const ready = live && reachable && !!acct?.charges_enabled && anyMethod;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">ความพร้อมรับเงินจริง</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-xl p-3 text-sm font-medium ${ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          <span className="flex items-start gap-2">
            {ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            {ready
              ? "พร้อมรับเงินจริงแล้ว — ลูกค้าสมัครแพ็กเกจและจ่ายเงินได้"
              : "ยังรับเงินจริงไม่ได้ — ลูกค้าทั่วไปจะยังไม่เห็นปุ่มชำระเงิน (ระบบซ่อนให้อัตโนมัติ)"}
          </span>
        </div>

        {!reachable ? (
          <p className="text-sm text-red-700">
            ติดต่อ Stripe ไม่ได้ตอนนี้{acct?.error?.message ? ` — ${acct.error.message}` : ""} (คีย์อาจผิดหรือถูกยกเลิก)
          </p>
        ) : (
          <ul className="space-y-2">
            <Line ok={live}
              label={live ? "ใช้คีย์โหมดจริง (sk_live)" : "ยังเป็นคีย์โหมดทดสอบ (sk_test)"}
              note={live ? undefined : "โหมดทดสอบรับได้แค่บัตรทดสอบ · บัตรจริงของลูกค้าจะถูกปฏิเสธเสมอ"} />
            <Line ok={!!acct?.details_submitted}
              label={acct?.details_submitted ? "กรอกข้อมูลธุรกิจครบแล้ว" : "ยังไม่ได้กรอกข้อมูลธุรกิจให้จบ"}
              note={acct?.details_submitted ? undefined : "นี่คือขั้นที่ค้างอยู่ — สมัครบัญชีแล้วแต่ยังไม่ได้กรอกแบบฟอร์มธุรกิจ/ยืนยันตัวตน"} />
            <Line ok={!!acct?.charges_enabled}
              label={acct?.charges_enabled ? "เปิดรับชำระเงินแล้ว" : "ยังเปิดรับชำระเงินไม่ได้"}
              note={acct?.requirements?.disabled_reason ?? undefined} />
            <Line ok={!!acct?.payouts_enabled}
              label={acct?.payouts_enabled ? "โอนเงินเข้าบัญชีธนาคารได้" : "ยังโอนเงินออกเข้าบัญชีไม่ได้"} />
            <Line ok={anyMethod}
              label={anyMethod
                ? `วิธีจ่ายที่เปิดใช้: ${[promptpay && "พร้อมเพย์", card && "บัตร"].filter(Boolean).join(" · ")}`
                : "ยังไม่ได้เปิดวิธีการชำระเงินใดเลย"}
              note={anyMethod ? undefined : "ต้องขอเปิด PromptPay (และ/หรือบัตร) ใน Stripe ก่อน ไม่งั้นลูกค้าไม่มีปุ่มให้จ่าย"} />
          </ul>
        )}

        {acct?.requirements?.currently_due && acct.requirements.currently_due.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Stripe ขอข้อมูลเพิ่ม {acct.requirements.currently_due.length} รายการ</p>
            <p className="mt-1 break-words text-[11px] text-amber-800">{acct.requirements.currently_due.join(" · ")}</p>
          </div>
        )}

        {!ready && (
          <div className="rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700">
            <p className="font-semibold">ลำดับที่ต้องทำให้ครบ</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>เข้า <a href="https://dashboard.stripe.com/account/onboarding" target="_blank" rel="noreferrer" className="font-medium text-emerald-700 underline">dashboard.stripe.com</a> กรอกข้อมูลธุรกิจ + ยืนยันตัวตนให้จบ (รอตรวจ 1-3 วัน)</li>
              <li>ขอเปิดวิธีชำระเงิน <b>PromptPay</b> ที่ Settings → Payment methods</li>
              <li>สลับหน้า Stripe เป็น <b>โหมด live</b> แล้วสร้าง <b>webhook endpoint ใหม่</b> ชี้มาที่ <code className="rounded bg-neutral-200 px-1">/api/billing/stripe/webhook</code> (4 events)</li>
              <li>เอา <b>sk_live</b> + <b>whsec ของ endpoint live</b> มาใส่ในช่องด้านบน</li>
            </ol>
            {/* ⚠️ ต้องบอกชื่อ event ให้ครบ (เพิ่ม 28 ส.ค. 2569)
                เดิมบอกแค่ว่า "สร้าง webhook" แต่ไม่บอกว่าติ๊ก event ไหน
                ถ้าติ๊กขาด async_payment_succeeded ลูกค้าจ่ายด้วยพร้อมเพย์สำเร็จ
                แต่เครดิตจะไม่เข้าเลยและไม่มีอะไรฟ้อง เพราะฝั่งเราไม่เคยได้รับ event
                รายชื่อดึงจากตัวรับ event จริง ห้ามพิมพ์ซ้ำ มีด่านใน check ตรวจว่าตรงกัน */}
            <p className="mt-2 font-semibold">ตอนสร้าง webhook ต้องติ๊ก {STRIPE_WEBHOOK_EVENTS.length} event นี้ให้ครบ</p>
            <ul className="mt-1 space-y-0.5">
              {STRIPE_WEBHOOK_EVENTS.map((e) => (
                <li key={e} className="font-mono text-[11px] text-neutral-800">{e}</li>
              ))}
            </ul>
            <p className="mt-2 text-amber-700">
              ⚠️ ข้อ 3 พลาดบ่อยที่สุด — whsec ของโหมดทดสอบใช้กับโหมด live ไม่ได้
              ถ้าลืมเปลี่ยน ลูกค้าจ่ายเงินสำเร็จแต่ระบบจะปฏิเสธทุก event (ลายเซ็นไม่ผ่าน)
            </p>
          </div>
        )}

        <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
          เปิดหน้า Stripe <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
