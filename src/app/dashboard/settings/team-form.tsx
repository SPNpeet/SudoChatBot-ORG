"use client";
import { useRef, useState, useTransition } from "react";
import { Badge, Button, Input, Select } from "@/components/ui";
import { addMember, removeMember } from "../actions";

interface MemberRow { id: string; role: string; display_name: string | null; email: string | null }

function KickButton({ memberId, shopId }: { memberId: string; shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button onClick={() => { setError(null); start(async () => { const r = await removeMember(memberId, shopId); if (!r.ok) setError(r.error); }); }}
        disabled={pending} className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50">
        {pending ? "กำลังลบ..." : "ลบออก"}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

export default function TeamForm({ shopId, members, canEdit }: { shopId: string; members: MemberRow[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await addMember(shopId, fd);
      if (!r.ok) { setError(r.error); return; }
      formRef.current?.reset();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium">{m.display_name ?? m.email ?? "สมาชิก"}</p>
              <p className="text-[11px] text-neutral-400">{m.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={m.role === "owner" ? "green" : "neutral"}>
                {m.role === "owner" ? "เจ้าของ" : m.role === "admin" ? "ผู้ดูแล" : m.role === "agent" ? "แอดมินเพจ" : "ดูอย่างเดียว"}
              </Badge>
              {canEdit && m.role !== "owner" && <KickButton memberId={m.id} shopId={shopId} />}
            </div>
          </div>
        ))}
      </div>
      {canEdit && (
        <form ref={formRef} action={submit} className="flex flex-col gap-2 sm:flex-row">
          <Input name="email" type="email" required placeholder="อีเมลของสมาชิก (ต้องเคย Login แล้ว)" className="min-w-0 flex-1" />
          <div className="flex gap-2">
            <Select name="role" defaultValue="agent" className="flex-1 sm:w-40 sm:flex-none">
              <option value="admin">ผู้ดูแล</option>
              <option value="agent">แอดมินเพจ</option>
              <option value="viewer">ดูอย่างเดียว</option>
            </Select>
            <Button className="h-10 shrink-0" disabled={pending}>{pending ? "..." : "เพิ่ม"}</Button>
          </div>
        </form>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
