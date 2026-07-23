"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select, Badge } from "@/components/ui";
import { CHAT_MODELS, PROVIDERS, TIERS, providerLabel, type Provider } from "@/lib/ai-catalog";
import { saveProviderKey, deleteProviderKey, saveRouting, savePurposeKey, deletePurposeKey, type PurposeKeyPurpose } from "./actions";
import { KeyRound, CheckCircle2, XCircle, Cpu, Save, Trash2, ExternalLink, SplitSquareHorizontal, BrainCircuit, MessageSquare } from "lucide-react";

interface KeyRow { provider: string; key_last4: string | null; test_status: string | null; test_message: string | null; tested_at: string | null; updated_at: string }
interface SettingRow { purpose: string; tier: string; provider: string; model: string }
interface ProviderMeta { id: Provider; label: string; keyHint: string; keyUrl: string }
export interface PurposeKeyRow { purpose: string; provider: string; model: string | null; key_last4: string | null; updated_at: string }

/** การ์ดพับ/กางได้ พร้อม badge สถานะเขียว/แดง — ให้แอดมินเช็คได้ด้วยตาเปล่าว่าหมวดไหนพร้อม */
function AccordionCard({ title, icon: Icon, ready, readyLabel, notReadyLabel, defaultOpen, children }: {
  title: string; icon: typeof KeyRound; ready: boolean; readyLabel: string; notReadyLabel: string;
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none">
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Icon className="h-4 w-4 text-emerald-600" /> {title}
        </span>
        <span className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ready ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : "bg-red-500"}`} />
            {ready ? readyLabel : notReadyLabel}
          </span>
          <span className="text-neutral-300 transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="border-t border-neutral-100 px-5 py-4">{children}</div>
    </details>
  );
}

export default function AdminAiCenter({
  keys, settings, providers, userEmail, purposeKeys,
}: {
  keys: KeyRow[]; settings: SettingRow[]; providers: ProviderMeta[]; userEmail: string; purposeKeys: PurposeKeyRow[];
}) {
  const keyMap = Object.fromEntries(keys.map((k) => [k.provider, k]));
  const setMap = Object.fromEntries(settings.map((s) => [`${s.purpose}_${s.tier}`, s]));
  const connectedCount = keys.length;
  const hasWorkingKey = keys.some((k) => k.test_status !== "failed");

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">ศูนย์จัดการ AI (ผู้ดูแลแพลตฟอร์ม)</h1>
        <p className="text-sm text-neutral-400">เชื่อมค่าย AI → เลือกโมเดล → ระบบพร้อมใช้ · {userEmail}</p>
        <a href="/dashboard/admin/billing" className="mt-2 inline-block text-sm text-emerald-600 hover:underline">→ ภาพรวมรายได้ + ยืนยันการชำระเงิน/สลิป</a>
      </div>

      <AccordionCard title="ขั้นที่ 1 — API Keys ค่าย AI" icon={KeyRound}
        ready={connectedCount > 0 && hasWorkingKey}
        readyLabel={`เชื่อมแล้ว ${connectedCount} ค่าย`} notReadyLabel="ยังไม่มี key"
        defaultOpen={connectedCount === 0}>
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderKeyRow key={p.id} meta={p} row={keyMap[p.id]} />
          ))}
        </div>
      </AccordionCard>

      <AccordionCard title="ขั้นที่ 2 — โมเดลเริ่มต้นของระบบ" icon={Cpu}
        ready={Object.keys(setMap).some((k) => k.startsWith("chat_"))}
        readyLabel="ตั้งค่าแล้ว" notReadyLabel="ยังไม่ตั้ง">
        <RoutingForm setMap={setMap} keyMap={keyMap} />
      </AccordionCard>

      <AccordionCard title="ทางเลือก — แยกคีย์ตามงาน" icon={SplitSquareHorizontal}
        ready={purposeKeys.length > 0}
        readyLabel={`ตั้งคีย์แยก ${purposeKeys.length} งาน`} notReadyLabel="ใช้คีย์รวม">
        <PurposeKeysBody purposeKeys={purposeKeys} providers={providers} />
      </AccordionCard>
    </div>
  );
}

// แยกคีย์ "ผู้ช่วยบัญชี AI" ออกจากงานเริ่มต้นระบบ — กันโควตาค่ายชนกัน + เลือกโมเดลต่างกันได้
function PurposeKeysBody({ purposeKeys, providers }: { purposeKeys: PurposeKeyRow[]; providers: ProviderMeta[] }) {
  const rowMap = Object.fromEntries(purposeKeys.map((k) => [k.purpose, k]));
  const slots: { purpose: PurposeKeyPurpose; label: string; desc: string; icon: typeof BrainCircuit }[] = [
    { purpose: "assistant", label: "ผู้ช่วยบัญชี AI", desc: "แชทสั่งงานบัญชีของผู้ใช้ — แนะนำโมเดลฉลาด tool แม่น (เช่น Claude Haiku)", icon: BrainCircuit },
    { purpose: "chat", label: "งานเริ่มต้นระบบ (default)", desc: "งาน AI อื่น ๆ เมื่อไม่ตั้งคีย์แยก — แนะนำตัวเร็ว/ประหยัด", icon: MessageSquare },
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        ไม่ตั้ง = ทุกงานใช้คีย์รวมจากขั้นที่ 1 ตามเดิม · ตั้งไว้ = งานนั้นใช้คีย์นี้ก่อนเสมอ
        (แยก rate limit ของค่าย AI และดูค่าใช้จ่ายแยกฝั่งได้ที่แดชบอร์ดค่าย)
      </p>
      {slots.map((s) => (
        <PurposeKeyRowUI key={s.purpose} slot={s} row={rowMap[s.purpose]} providers={providers} />
      ))}
    </div>
  );
}

function PurposeKeyRowUI({
  slot, row, providers,
}: {
  slot: { purpose: PurposeKeyPurpose; label: string; desc: string; icon: typeof BrainCircuit };
  row?: PurposeKeyRow; providers: ProviderMeta[];
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>((row?.provider as Provider) ?? "google");
  const [model, setModel] = useState(row?.model ?? "");
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      try { await savePurposeKey(slot.purpose, provider, model, key); setKey(""); setOpen(false); }
      catch (e) { setError((e as Error).message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <slot.icon className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-semibold">{slot.label}</span>
          {row ? (
            <Badge tone="green">{providerLabel(row.provider)}{row.model ? ` · ${row.model}` : ""} ••••{row.key_last4}</Badge>
          ) : (
            <Badge tone="neutral">ใช้คีย์รวม</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>{open ? "ยกเลิก" : row ? "เปลี่ยน" : "ตั้งคีย์แยก"}</Button>
          {row && (
            <form action={async () => { await deletePurposeKey(slot.purpose); }}>
              <button className="text-neutral-400 hover:text-red-600" title="ลบ — กลับไปใช้คีย์รวม"><Trash2 className="h-4 w-4" /></button>
            </form>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-neutral-400">{slot.desc}</p>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>ค่าย AI</Label>
              <Select value={provider} onChange={(e) => { setProvider(e.target.value as Provider); setModel(""); }}>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>โมเดล <span className="font-normal text-neutral-400">(เว้นว่าง = ตัวเริ่มต้นของค่าย)</span></Label>
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">— โมเดลเริ่มต้น —</option>
                {CHAT_MODELS[provider]?.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>API Key ของงานนี้</Label>
            <div className="flex gap-2">
              <Input type="password" value={key} onChange={(e) => setKey(e.target.value)}
                placeholder="วาง API key — เก็บเข้ารหัสใน Vault แยกจากคีย์รวม" className="flex-1 font-mono" autoComplete="off" />
              <Button size="sm" onClick={save} disabled={pending || key.length < 10}><Save className="h-4 w-4" /> {pending ? "บันทึก..." : "บันทึก"}</Button>
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

function ProviderKeyRow({ meta, row }: { meta: ProviderMeta; row?: KeyRow }) {
  const [key, setKey] = useState("");
  const [open, setOpen] = useState(!row);
  const [pending, start] = useTransition();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    setSaveError(null);
    start(async () => {
      try { await saveProviderKey(meta.id, key); setKey(""); setOpen(false); setTestResult(null); }
      catch (e) { setSaveError((e as Error).message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    });
  }
  async function test() {
    setTesting(true); setTestResult(null);
    try {
      const firstModel = CHAT_MODELS[meta.id][0].id;
      const res = await fetch("/api/admin/test-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: meta.id, model: firstModel }),
      });
      const j = await res.json();
      setTestResult({ ok: j.ok, msg: j.ok ? "เชื่อมต่อสำเร็จ ✓" : (j.error ?? "ล้มเหลว") });
    } catch (e) { setTestResult({ ok: false, msg: (e as Error).message }); }
    finally { setTesting(false); }
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{meta.label}</span>
          {row ? (
            <Badge tone="green"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="font-mono">••••••••{row.key_last4}</span></Badge>
          ) : (
            <Badge tone="red"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />ยังไม่ตั้งค่า</Badge>
          )}
          {row?.test_status === "ok" && <span title="ทดสอบผ่าน"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></span>}
          {row?.test_status === "failed" && <span title={row.test_message ?? ""}><XCircle className="h-4 w-4 text-red-500" /></span>}
        </div>
        <div className="flex items-center gap-2">
          {row && (
            <>
              <Button size="sm" variant="outline" onClick={test} disabled={testing}>{testing ? "กำลังทดสอบ..." : "ทดสอบ"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>{open ? "ยกเลิก" : "เปลี่ยน key"}</Button>
              <form action={async () => { await deleteProviderKey(meta.id); }}>
                <button className="text-neutral-400 hover:text-red-600" title="ลบ key"><Trash2 className="h-4 w-4" /></button>
              </form>
            </>
          )}
        </div>
      </div>

      {testResult && (
        <p className={`mt-2 text-xs ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}>{testResult.msg}</p>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          <Label>API Key <span className="font-normal text-neutral-400">({meta.keyHint})</span></Label>
          <div className="flex gap-2">
            <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="วาง API key ที่นี่ — ระบบเก็บเข้ารหัสใน Vault" className="flex-1 font-mono" autoComplete="off" />
            <Button size="sm" onClick={save} disabled={pending || key.length < 10}><Save className="h-4 w-4" /> {pending ? "บันทึก..." : "บันทึก"}</Button>
          </div>
          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</p>}
          <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline">
            <ExternalLink className="h-3 w-3" /> ไปหน้าออก API key ของ {meta.label}
          </a>
        </div>
      )}
    </div>
  );
}

function RoutingForm({ setMap, keyMap }: { setMap: Record<string, SettingRow>; keyMap: Record<string, KeyRow> }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // state ต่อ tier เพื่อให้ dropdown โมเดลเปลี่ยนตามค่าย
  const initChat = (tier: string) => setMap[`chat_${tier}`] ?? { provider: "anthropic", model: CHAT_MODELS.anthropic[0].id };
  const [economy, setEconomy] = useState<{ provider: string; model: string }>(initChat("economy"));
  const [standard, setStandard] = useState<{ provider: string; model: string }>(initChat("standard"));
  const [premium, setPremium] = useState<{ provider: string; model: string }>(initChat("premium"));

  const tierState: Record<string, [{ provider: string; model: string }, (v: { provider: string; model: string }) => void]> = {
    economy: [economy, setEconomy], standard: [standard, setStandard], premium: [premium, setPremium],
  };
  const tierLabel = Object.fromEntries(TIERS.map((t) => [t.id, t.label]));

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      try { await saveRouting(fd); setSaved(true); setTimeout(() => setSaved(false), 2500); }
      catch (e) { setError((e as Error).message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <p className="text-xs text-neutral-400">โมเดลที่ระบบใช้เมื่อไม่ได้ตั้งคีย์แยกตามงาน — ระดับ &quot;มาตรฐาน&quot; คือค่าเริ่มต้นของผู้ช่วยบัญชี AI</p>

          {(["economy", "standard", "premium"] as const).map((tier) => {
            const [st, setSt] = tierState[tier];
            const models = CHAT_MODELS[st.provider as Provider] ?? [];
            const hasKey = !!keyMap[st.provider];
            return (
              <div key={tier} className="rounded-xl border border-neutral-100 p-3">
                <p className="mb-2 text-xs font-semibold text-neutral-600">{tierLabel[tier]}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select name={`chat_${tier}_provider`} value={st.provider}
                    onChange={(e) => setSt({ provider: e.target.value, model: (CHAT_MODELS[e.target.value as Provider] ?? [])[0]?.id ?? "" })}>
                    {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </Select>
                  <Select name={`chat_${tier}_model`} value={st.model} onChange={(e) => setSt({ ...st, model: e.target.value })}>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>)}
                  </Select>
                </div>
                {!hasKey && <p className="mt-1.5 text-[11px] text-amber-600">⚠️ ยังไม่ได้ใส่ API key ของค่ายนี้ในขั้นที่ 1 — ระบบจะใช้ค่าย fallback จนกว่าจะใส่</p>}
              </div>
            );
          })}

      <div className="flex items-center gap-3">
        <Button disabled={pending}><Save className="h-4 w-4" /> {pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า AI"}</Button>
        {saved && <span className="text-sm text-emerald-600">บันทึกแล้ว ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
