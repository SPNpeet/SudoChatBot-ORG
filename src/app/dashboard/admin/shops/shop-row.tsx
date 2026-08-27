"use client";
import { useState, useTransition } from "react";
import { Badge, Select, Td } from "@/components/ui";
import { dateTH, PLAN_TH, SHOP_STATUS_TH } from "@/lib/utils";
import { setShopStatus, setShopPlan, setShopQuotaOverride } from "./actions";

const STATUS_TONE: Record<string, "green" | "amber" | "neutral"> = { active: "green", suspended: "amber", closed: "neutral" };

export default function ShopRow({ id, name, ownerEmail, plan, status, createdAt, quotaOverride, quota: usage, ocr }: {
  id: string; name: string; ownerEmail: string | null; plan: string; status: string; createdAt: string;
  quotaOverride: number | null;
  /** การใช้ AI จริงจาก get_ai_quota_status — RPC ตัวเดียวกับแถบของผู้ใช้ เลขต้องตรงกันเสมอ */
  quota: { used_today: number; cap_today: number | null; used_month: number; cap_month: number | null } | null;
  /** จำนวน OCR แยก (เดือนนี้/สะสม) — แพงกว่าคำสั่งแชท ~8 เท่า ต้องเห็นแยกถึงคุมต้นทุนถูก */
  ocr: { month: number; total: number } | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [quota, setQuota] = useState(quotaOverride != null ? String(quotaOverride) : "");
  const [savedQuota, setSavedQuota] = useState(false);

  function changeStatus(v: string) {
    setErr(null);
    start(async () => {
      const r = await setShopStatus(id, v);
      if (!r.ok) setErr(r.error);
    });
  }
  function changePlan(v: string) {
    setErr(null);
    start(async () => {
      const r = await setShopPlan(id, v);
      if (!r.ok) setErr(r.error);
    });
  }
  function saveQuota() {
    setErr(null); setSavedQuota(false);
    start(async () => {
      const r = await setShopQuotaOverride(id, quota.trim() === "" ? null : Number(quota));
      if (!r.ok) setErr(r.error);
      else { setSavedQuota(true); setTimeout(() => setSavedQuota(false), 2000); }
    });
  }

  // แพ็กเก่า (pro/mini/enterprise) อาจยังติดอยู่บางร้าน — โชว์ให้เลือกออกได้แต่ไม่โปรโมท
  const planOptions = { ...PLAN_TH, ...(PLAN_TH[plan] ? {} : { [plan]: `${plan} (แพ็กเก่า)` }) };

  return (
    <>
      <tr>
        <Td className="font-medium">{name}</Td>
        <Td label="เจ้าของ" className="text-neutral-500">{ownerEmail ?? "-"}</Td>
        <Td label="แพ็ก">
          {/* เปลี่ยนแพ็กลูกค้าคือของจริงที่กระทบเงิน — ต้องยืนยันก่อน ไม่งั้นเลื่อนนิ้วโดนบนมือถือก็เปลี่ยนแล้ว */}
          <Select disabled={pending} value={plan} className="h-9 text-xs"
            onChange={(e) => {
              const next = e.target.value;
              if (next === plan) return;
              if (!confirm(`เปลี่ยนแพ็กเกจของ "${name}" จาก ${planOptions[plan] ?? plan} เป็น ${planOptions[next] ?? next} ใช่ไหม?`)) {
                e.target.value = plan;   // ผู้ใช้ยกเลิก — ดีดกลับค่าเดิม
                return;
              }
              changePlan(next);
            }}>
            {Object.entries(planOptions).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
        </Td>
        <Td label="โควตา AI/วัน">
          <div className="flex items-center gap-1.5">
            <input inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="ตามแพ็ก" title="เพดานงาน AI/วัน เฉพาะกิจการนี้ — ว่าง = ใช้ตามแพ็กเกจ"
              className="h-8 w-20 rounded-lg border border-neutral-300 px-2 text-xs outline-none focus:border-emerald-500" />
            <button onClick={saveQuota} disabled={pending}
              className="h-8 rounded-lg bg-neutral-900 px-2.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-40">
              {savedQuota ? "บันทึกแล้ว" : "บันทึก"}
            </button>
          </div>
        </Td>
        {/* ใช้ AI แล้ว — เจ้าของแพลตฟอร์มขอเอง (1 ส.ค. 2569): "แต่ละที่ไม่มีบอกว่าใช้ไปเท่าไหร่
            แล้วครบเท่าไหร่ admin ไม่รู้เลย" · แดง = ชนเพดาน · เหลือง = >=80% (เกณฑ์เดียวกับ ai-quota-bar) */}
        <Td label="ใช้ AI แล้ว" className="whitespace-nowrap text-xs tabular-nums">
          {usage ? (
            <>
              <span className={
                usage.cap_today && usage.used_today >= usage.cap_today ? "font-semibold text-red-600"
                  : usage.cap_today && usage.used_today >= usage.cap_today * 0.8 ? "font-medium text-amber-600"
                  : "text-neutral-600"
              }>
                วันนี้ {usage.used_today}{usage.cap_today ? `/${usage.cap_today}` : ""}
              </span>
              <span className="text-neutral-400"> · เดือน {usage.used_month}{usage.cap_month ? `/${usage.cap_month}` : ""}</span>
              {/* OCR แยกบรรทัด — แพงกว่าคำสั่งแชท ~8 เท่า (0.72฿ vs 0.09฿) ต้องเห็นถึงคุมต้นทุนถูก */}
              <span className="block text-xs text-neutral-400">
                OCR เดือนนี้ {ocr?.month ?? 0} · สะสม {ocr?.total ?? 0}
              </span>
            </>
          ) : <span className="text-neutral-300">-</span>}
        </Td>
        <Td label="สถานะ">
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[status] ?? "neutral"}>{SHOP_STATUS_TH[status] ?? status}</Badge>
            <Select disabled={pending} value={status} className="h-9 w-28 text-xs"
              onChange={(e) => {
                const next = e.target.value;
                if (next === status) return;
                if (!confirm(`เปลี่ยนสถานะของ "${name}" เป็น "${SHOP_STATUS_TH[next] ?? next}" ใช่ไหม?`)) {
                  e.target.value = status;
                  return;
                }
                changeStatus(next);
              }}>
              {Object.entries(SHOP_STATUS_TH).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </Select>
          </div>
        </Td>
        <Td label="สมัครเมื่อ" className="text-neutral-400">{dateTH(createdAt)}</Td>
      </tr>
      {err && (
        <tr><Td colSpan={7} className="!border-t-0 !py-1.5"><p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</p></Td></tr>
      )}
    </>
  );
}
