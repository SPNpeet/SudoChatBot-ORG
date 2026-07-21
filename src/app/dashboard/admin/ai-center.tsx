"use client";
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, Badge } from "@/components/ui";
import { CHAT_MODELS, EMBED_MODELS, PROVIDERS, TIERS, providerLabel, type Provider } from "@/lib/ai-catalog";
import { saveProviderKey, deleteProviderKey, saveRouting, savePurposeKey, deletePurposeKey, type PurposeKeyPurpose } from "./actions";
import { KeyRound, CheckCircle2, XCircle, Cpu, Save, Trash2, ExternalLink, SplitSquareHorizontal, BrainCircuit, MessageSquare } from "lucide-react";

interface KeyRow { provider: string; key_last4: string | null; test_status: string | null; test_message: string | null; tested_at: string | null; updated_at: string }
interface SettingRow { purpose: string; tier: string; provider: string; model: string }
interface ProviderMeta { id: Provider; label: string; keyHint: string; keyUrl: string }
export interface PurposeKeyRow { purpose: string; provider: string; model: string | null; key_last4: string | null; updated_at: string }

export default function AdminAiCenter({
  keys, settings, providers, userEmail, purposeKeys,
}: {
  keys: KeyRow[]; settings: SettingRow[]; providers: ProviderMeta[]; userEmail: string; purposeKeys: PurposeKeyRow[];
}) {
  const keyMap = Object.fromEntries(keys.map((k) => [k.provider, k]));
  const setMap = Object.fromEntries(settings.map((s) => [`${s.purpose}_${s.tier}`, s]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">ศูนย์จัดการ AI (ผู้ดูแลแพลตฟอร์ม)</h1>
        <p className="text-sm text-neutral-400">เลือกค่าย → เลือกโมเดล → ใส่ API key เอง · {userEmail}</p>
        <a href="/dashboard/admin/billing" className="mt-2 inline-block text-sm text-emerald-600 hover:underline">→ ภาพรวมรายได้ + ยืนยันการเติมเงิน</a>
      </div>

      {/* ===== ขั้น 1-2: API Keys ต่อค่าย ===== */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-emerald-600" /> ขั้นที่ 1 — เชื่อมต่อค่าย AI (ใส่ API Key)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {providers.map((p) => (
            <ProviderKeyRow key={p.id} meta={p} row={keyMap[p.id]} />
          ))}
        </CardContent>
      </Card>

      {/* ===== ขั้น 3: เลือกค่าย+โมเดล ต่อระดับ ===== */}
      <RoutingForm setMap={setMap} keyMap={keyMap} />

      {/* ===== ทางเลือก: แยกคีย์ตามงาน ===== */}
      <PurposeKeysCard purposeKeys={purposeKeys} providers={providers} />
    </div>
  );
}

// แยกคีย์ "ผู้จัดการร้าน AI" ออกจาก "บอทตอบลูกค้า" — กันโควตาชนกัน + เลือกโมเดลต่างกันได้
function PurposeKeysCard({ purposeKeys, providers }: { purposeKeys: PurposeKeyRow[]; providers: ProviderMeta[] }) {
  const rowMap = Object.fromEntries(purposeKeys.map((k) => [k.purpose, k]));
  const slots: { purpose: PurposeKeyPurpose; label: string; desc: string; icon: typeof BrainCircuit }[] = [
    { purpose: "assistant", label: "ผู้จัดการร้าน AI", desc: "ใช้กับแชทสั่งงานของเจ้าของร้าน — แนะนำโมเดลฉลาด", icon: BrainCircuit },
    { purpose: "chat", label: "บอทตอบลูกค้า", desc: "ใช้กับแชทลูกค้าจริง + คอมเมนต์ + ทดลองบอท — แนะนำตัวเร็ว/ประหยัด", icon: MessageSquare },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SplitSquareHorizontal className="h-4 w-4 text-emerald-600" /> ทางเลือก — แยกคีย์ตามงาน</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-neutral-400">
          ไม่ตั้ง = ทุกงานใช้คีย์รวมจากขั้นที่ 1 ตามเดิม · ตั้งไว้ = งานนั้นใช้คีย์นี้ก่อนเสมอ
          (แยกโควตา rate limit ของค่าย AI ไม่ให้ผู้จัดการร้านเบียดบอทตอบลูกค้า และดูค่าใช้จ่ายแยกฝั่งได้ที่แดชบอร์ดค่าย)
        </p>
        {slots.map((s) => (
          <PurposeKeyRowUI key={s.purpose} slot={s} row={rowMap[s.purpose]} providers={providers} />
        ))}
      </CardContent>
    </Card>
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
            <Badge tone="green">เชื่อมแล้ว ••••{row.key_last4}</Badge>
          ) : (
            <Badge tone="neutral">ยังไม่เชื่อม</Badge>
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
  const initEmb = setMap["embedding_default"] ?? { provider: "google", model: "gemini-embedding-001" };
  const [embed, setEmbed] = useState<{ provider: string; model: string }>(initEmb);

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
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4 text-emerald-600" /> ขั้นที่ 2 — เลือกค่าย + โมเดล ให้บอทตอบลูกค้า</CardTitle></CardHeader>
      <CardContent>
        <form action={submit} className="space-y-4">
          <p className="text-xs text-neutral-400">ร้านค้าเลือกได้ว่าจะใช้ระดับไหน (ในหน้าตั้งค่าของร้าน) — คุณกำหนดว่าแต่ละระดับใช้ค่าย/โมเดลอะไร</p>

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
                {!hasKey && <p className="mt-1.5 text-[11px] text-amber-600">⚠️ ยังไม่ได้ใส่ API key ของค่ายนี้ในขั้นที่ 1 — บอทจะใช้ค่าย fallback จนกว่าจะใส่</p>}
              </div>
            );
          })}

          <div className="rounded-xl border border-neutral-100 p-3">
            <p className="mb-2 text-xs font-semibold text-neutral-600">ระบบค้นหาความรู้ (Embedding)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select name="embed_provider" value={embed.provider}
                onChange={(e) => setEmbed({ provider: e.target.value, model: (EMBED_MODELS[e.target.value] ?? [])[0]?.id ?? "" })}>
                {Object.keys(EMBED_MODELS).map((p) => <option key={p} value={p}>{providerLabel(p)}</option>)}
              </Select>
              <Select name="embed_model" value={embed.model} onChange={(e) => setEmbed({ ...embed, model: e.target.value })}>
                {(EMBED_MODELS[embed.provider] ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">ทุกโมเดลถูกบังคับเป็น 1536 มิติ ให้เข้ากับฐานข้อมูลเดิม (เปลี่ยนค่ายได้โดยไม่ต้อง migrate)</p>
          </div>

          <div className="flex items-center gap-3">
            <Button disabled={pending}><Save className="h-4 w-4" /> {pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า AI"}</Button>
            {saved && <span className="text-sm text-emerald-600">บันทึกแล้ว ✓</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
