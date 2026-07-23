"use client";
// ============================================================
//  ศูนย์จัดการ AI — โครงสร้าง Function-Centric (ยึด "งาน" เป็นหลัก)
//  มีแค่ 2 การ์ด: ① ผู้ช่วยบัญชี AI (สมองหลัก) ② AI อ่านบิล (OCR)
//  แต่ละการ์ด: เลือกค่าย + พิมพ์ชื่อโมเดลเองได้ (future-proof — ค่ายออกรุ่นใหม่
//  ก็แค่แก้ชื่อแล้วกดบันทึก ไม่ต้องแตะโค้ด) + วาง key ครั้งเดียว แก้โมเดลทีหลัง
//  ไม่ต้องวาง key ซ้ำ · ค่ายอื่น ๆ พับเก็บเป็น "คีย์สำรอง (Auto-Fallback)"
// ============================================================
import { useState, useTransition } from "react";
import { Button, Input, Label, Select, Badge } from "@/components/ui";
import { CHAT_MODELS, PROVIDERS, providerLabel, type Provider } from "@/lib/ai-catalog";
import { saveProviderKey, deleteProviderKey, savePurposeKey, deletePurposeKey, type PurposeKeyPurpose } from "./actions";
import { CheckCircle2, XCircle, Save, Trash2, ExternalLink, BrainCircuit, ScanLine, KeyRound } from "lucide-react";

interface KeyRow { provider: string; key_last4: string | null; test_status: string | null; test_message: string | null; tested_at: string | null; updated_at: string }
interface ProviderMeta { id: Provider; label: string; keyHint: string; keyUrl: string }
export interface PurposeKeyRow { purpose: string; provider: string; model: string | null; key_last4: string | null; updated_at: string }

// ---- นิยาม 2 การ์ดงาน ----
interface FunctionCardDef {
  purpose: PurposeKeyPurpose;
  title: string;
  desc: string;
  icon: typeof BrainCircuit;
  providers: Provider[];               // ค่ายที่เหมาะกับงานนี้
  suggest: Partial<Record<Provider, string[]>>; // โมเดลแนะนำ (พิมพ์เองได้เสมอ)
  defaultModel: Partial<Record<Provider, string>>;
}

const CARDS: FunctionCardDef[] = [
  {
    purpose: "assistant",
    title: "ผู้ช่วยบัญชี AI (สมองหลัก)",
    desc: "ใช้กับ: แชทสั่งงานบัญชี · ออกเอกสาร · คิดเลข · สรุปงบ — แนะนำโมเดลที่ tool แม่น",
    icon: BrainCircuit,
    providers: ["google", "openai", "anthropic"],
    suggest: {
      google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
      openai: ["gpt-5-mini", "gpt-4o-mini", "gpt-5"],
      anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-5"],
    },
    defaultModel: { google: "gemini-2.5-flash", openai: "gpt-5-mini", anthropic: "claude-haiku-4-5-20251001" },
  },
  {
    purpose: "ocr",
    title: "AI อ่านบิล (OCR Vision)",
    desc: "ใช้กับ: อ่านรูปบิล/ใบเสร็จ/สลิป แกะตัวหนังสือเป็นรายการบัญชี — แนะนำ Mistral OCR (เก่งตารางไทย)",
    icon: ScanLine,
    providers: ["mistral", "google", "openai", "anthropic"],
    suggest: {
      mistral: ["mistral-ocr-latest"],
      google: ["gemini-2.5-flash", "gemini-2.5-pro"],
      openai: ["gpt-4o-mini", "gpt-4o"],
      anthropic: ["claude-haiku-4-5-20251001"],
    },
    defaultModel: { mistral: "mistral-ocr-latest", google: "gemini-2.5-flash", openai: "gpt-4o-mini", anthropic: "claude-haiku-4-5-20251001" },
  },
];

export default function AdminAiCenter({
  keys, providers, userEmail, purposeKeys,
}: {
  keys: KeyRow[]; providers: ProviderMeta[]; userEmail: string; purposeKeys: PurposeKeyRow[];
}) {
  const rowMap = Object.fromEntries(purposeKeys.map((k) => [k.purpose, k]));
  const keyMap = Object.fromEntries(keys.map((k) => [k.provider, k]));

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">ศูนย์จัดการ AI (ผู้ดูแลแพลตฟอร์ม)</h1>
        <p className="text-sm text-neutral-400">
          ตั้งแค่ 2 การ์ดนี้ ระบบพร้อมใช้ทั้งแพลตฟอร์ม — ลูกค้าไม่มีวันเห็นหน้านี้ เขาเห็นแค่แชทผู้ช่วยกับปุ่มอัปโหลดบิล · {userEmail}
        </p>
        <a href="/dashboard/admin/billing" className="mt-2 inline-block text-sm text-emerald-600 hover:underline">→ ภาพรวมรายได้ + ยืนยันการชำระเงิน/สลิป</a>
      </div>

      {CARDS.map((card) => (
        <FunctionCard key={card.purpose} def={card} row={rowMap[card.purpose]} />
      ))}

      {/* ค่ายอื่น/คีย์สำรอง — พับเก็บ ไม่รกหน้าจอ แต่คือเชื้อเพลิงของ Auto-Fallback */}
      <details className="group rounded-2xl border border-neutral-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none">
          <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <KeyRound className="h-4 w-4 text-neutral-400" /> ขั้นสูง — คีย์สำรอง (Auto-Fallback)
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400">{keys.length ? `มี ${keys.length} ค่าย` : "ไม่บังคับ"}</span>
            <span className="text-neutral-300 transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
          <p className="text-xs text-neutral-400">
            ถ้าค่ายหลักใน 2 การ์ดบนล่ม/ปิดปรับปรุง ระบบจะสลับมาใช้คีย์ในนี้ให้อัตโนมัติ (เรียงลำดับ: การ์ดอ่านบิล → การ์ดผู้ช่วย → คีย์สำรอง) — ไม่ตั้งก็ใช้งานได้ปกติ
          </p>
          {providers.map((p) => (
            <ProviderKeyRow key={p.id} meta={p} row={keyMap[p.id]} />
          ))}
        </div>
      </details>
    </div>
  );
}

// ============================================================
//  การ์ดงาน — เลือกค่าย + พิมพ์ชื่อโมเดล + API key (masked เมื่อบันทึกแล้ว)
// ============================================================
function FunctionCard({ def, row }: { def: FunctionCardDef; row?: PurposeKeyRow }) {
  const configured = !!row;
  const [provider, setProvider] = useState<Provider>((row?.provider as Provider) ?? def.providers[0]);
  const [model, setModel] = useState(row?.model ?? def.defaultModel[def.providers[0]] ?? "");
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const meta = PROVIDERS.find((p) => p.id === provider);

  function pickProvider(p: Provider) {
    setProvider(p);
    // ถ้าเปลี่ยนค่าย เสนอโมเดลเริ่มต้นของค่ายนั้นให้ (ยังพิมพ์ทับได้)
    setModel(def.defaultModel[p] ?? "");
  }

  function save() {
    setMsg(null);
    start(async () => {
      try {
        await savePurposeKey(def.purpose, provider, model, key);
        setKey("");
        setMsg({ ok: true, text: key ? "บันทึกค่าย/โมเดล/key แล้ว ✓" : "บันทึกค่าย/โมเดลแล้ว (ใช้ key เดิม) ✓" });
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
      }
    });
  }

  async function test() {
    setTesting(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/test-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: def.purpose, model }),
      });
      const j = await res.json();
      setMsg({ ok: j.ok, text: j.ok ? "เชื่อมต่อสำเร็จ ✓ พร้อมใช้งาน" : (j.error ?? "เชื่อมต่อไม่สำเร็จ") });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const datalistId = `models-${def.purpose}-${provider}`;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <def.icon className="h-4 w-4 text-emerald-600" /> {def.title}
        </span>
        {configured ? (
          <Badge tone="green">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {providerLabel(row!.provider)} · {row!.model ?? "โมเดลเริ่มต้น"} · <span className="font-mono">••••{row!.key_last4}</span>
          </Badge>
        ) : (
          <Badge tone="red"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />ยังไม่ตั้งค่า</Badge>
        )}
      </div>

      <div className="space-y-3 px-5 py-4">
        <p className="text-xs text-neutral-400">{def.desc}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>ผู้ให้บริการ (ค่าย AI)</Label>
            <Select value={provider} onChange={(e) => pickProvider(e.target.value as Provider)}>
              {def.providers.map((p) => <option key={p} value={p}>{providerLabel(p)}</option>)}
            </Select>
          </div>
          <div>
            <Label>ชื่อโมเดล <span className="font-normal text-neutral-400">(พิมพ์เองได้ — รุ่นใหม่ออกก็แค่แก้ตรงนี้)</span></Label>
            <Input list={datalistId} value={model} onChange={(e) => setModel(e.target.value)}
              placeholder={def.defaultModel[provider] ?? "ชื่อโมเดล"} className="font-mono" />
            <datalist id={datalistId}>
              {(def.suggest[provider] ?? CHAT_MODELS[provider]?.map((m) => m.id) ?? []).map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
        </div>

        <div>
          <Label>API Key {meta && <span className="font-normal text-neutral-400">({meta.keyHint})</span>}</Label>
          <div className="flex gap-2">
            <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off"
              placeholder={configured ? `เว้นว่าง = ใช้ key เดิม (••••${row!.key_last4})` : "วาง API key — เก็บเข้ารหัสใน Vault"}
              className="flex-1 font-mono" />
            <Button size="sm" onClick={save} disabled={pending || (!configured && key.trim().length < 10) || !model.trim()}>
              <Save className="h-4 w-4" /> {pending ? "บันทึก..." : "บันทึก"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {configured && (
            <>
              <Button size="sm" variant="outline" onClick={test} disabled={testing}>{testing ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}</Button>
              <form action={async () => { await deletePurposeKey(def.purpose); }}>
                <button className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600" title="ลบการตั้งค่านี้ — ระบบจะใช้คีย์สำรอง (fallback) แทน">
                  <Trash2 className="h-3.5 w-3.5" /> ลบ
                </button>
              </form>
            </>
          )}
          {meta && (
            <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline">
              <ExternalLink className="h-3 w-3" /> ไปหน้าออก API key ของ {meta.label}
            </a>
          )}
        </div>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  คีย์สำรองต่อค่าย (ขั้นสูง) — ใช้เป็น fallback เมื่อการ์ดหลักล่ม
// ============================================================
function ProviderKeyRow({ meta, row }: { meta: ProviderMeta; row?: KeyRow }) {
  const [key, setKey] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    setSaveError(null);
    start(async () => {
      try { await saveProviderKey(meta.id, key); setKey(""); setOpen(false); }
      catch (e) { setSaveError((e as Error).message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-100 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{meta.label}</span>
          {row ? (
            <Badge tone="green"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="font-mono">••••{row.key_last4}</span></Badge>
          ) : (
            <span className="text-[11px] text-neutral-300">ไม่ได้ตั้ง</span>
          )}
          {row?.test_status === "ok" && <span title="ทดสอบผ่าน"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></span>}
          {row?.test_status === "failed" && <span title={row.test_message ?? ""}><XCircle className="h-3.5 w-3.5 text-red-500" /></span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>{open ? "ยกเลิก" : row ? "เปลี่ยน" : "ตั้ง key"}</Button>
          {row && (
            <form action={async () => { await deleteProviderKey(meta.id); }}>
              <button className="text-neutral-300 hover:text-red-600" title="ลบ key สำรองนี้"><Trash2 className="h-3.5 w-3.5" /></button>
            </form>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-2 flex gap-2">
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={`API key ${meta.label} (${meta.keyHint})`} className="h-8 flex-1 font-mono text-xs" autoComplete="off" />
          <Button size="sm" onClick={save} disabled={pending || key.length < 10}>{pending ? "..." : "บันทึก"}</Button>
        </div>
      )}
      {saveError && <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">{saveError}</p>}
    </div>
  );
}
