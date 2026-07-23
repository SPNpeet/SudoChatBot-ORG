"use client";
import { useState, useTransition } from "react";
import { Badge, Select, Td } from "@/components/ui";
import { dateTH, PLAN_TH, SHOP_STATUS_TH } from "@/lib/utils";
import { setShopStatus, setShopPlan, setShopQuotaOverride } from "./actions";

const STATUS_TONE: Record<string, "green" | "amber" | "neutral"> = { active: "green", suspended: "amber", closed: "neutral" };

export default function ShopRow({ id, name, ownerEmail, plan, status, createdAt, quotaOverride }: {
  id: string; name: string; ownerEmail: string | null; plan: string; status: string; createdAt: string;
  quotaOverride: number | null;
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
        <Td className="text-neutral-500">{ownerEmail ?? "-"}</Td>
        <Td>
          <Select disabled={pending} defaultValue={plan} onChange={(e) => changePlan(e.target.value)} className="h-8 text-xs">
            {Object.entries(planOptions).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
        </Td>
        <Td>
          <div className="flex items-center gap-1.5">
            <input inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="ตามแพ็ก" title="เพดานงาน AI/วัน เฉพาะกิจการนี้ — ว่าง = ใช้ตามแพ็กเกจ"
              className="h-8 w-20 rounded-lg border border-neutral-300 px-2 text-xs outline-none focus:border-emerald-500" />
            <button onClick={saveQuota} disabled={pending}
              className="h-8 rounded-lg bg-neutral-900 px-2.5 text-[11px] text-white hover:bg-neutral-700 disabled:opacity-40">
              {savedQuota ? "✓" : "บันทึก"}
            </button>
          </div>
        </Td>
        <Td>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[status] ?? "neutral"}>{SHOP_STATUS_TH[status] ?? status}</Badge>
            <Select disabled={pending} defaultValue={status} onChange={(e) => changeStatus(e.target.value)} className="h-8 w-28 text-xs">
              {Object.entries(SHOP_STATUS_TH).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </Select>
          </div>
        </Td>
        <Td className="text-neutral-400">{dateTH(createdAt)}</Td>
      </tr>
      {err && (
        <tr><Td colSpan={6} className="!border-t-0 !py-1.5"><p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</p></Td></tr>
      )}
    </>
  );
}
