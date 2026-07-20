"use client";
import { useState, useTransition } from "react";
import { Badge, Select, Td } from "@/components/ui";
import { dateTH, PLAN_TH, SHOP_STATUS_TH } from "@/lib/utils";
import { setShopStatus, setShopPlan } from "./actions";

const STATUS_TONE: Record<string, "green" | "amber" | "neutral"> = { active: "green", suspended: "amber", closed: "neutral" };

export default function ShopRow({ id, name, ownerEmail, plan, status, createdAt }: {
  id: string; name: string; ownerEmail: string | null; plan: string; status: string; createdAt: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <>
      <tr>
        <Td className="font-medium">{name}</Td>
        <Td className="text-neutral-500">{ownerEmail ?? "-"}</Td>
        <Td>
          <Select disabled={pending} defaultValue={plan} onChange={(e) => changePlan(e.target.value)} className="h-8 text-xs">
            {Object.entries(PLAN_TH).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
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
        <tr><Td colSpan={5} className="!border-t-0 !py-1.5"><p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</p></Td></tr>
      )}
    </>
  );
}
