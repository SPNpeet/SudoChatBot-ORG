"use client";
import { compressImage } from "@/lib/compress-image";
// ============================================================
//  แชทผู้ช่วยบัญชี AI — สั่งงานบัญชีทั้งระบบ + แนบรูปบิลหลายใบให้บันทึกเองได้
//  หลักการ UX ที่ต้องคงไว้ (มาจากปัญหาที่ผู้ใช้เจอจริง):
//   1. กดส่งแล้วต้องเห็นข้อความ+รูปของตัวเองทันที ห้ามรอ OCR เสร็จก่อน (ไม่งั้นเหมือนกดแล้วไม่ติด)
//   2. สลับไปหน้าอื่นแล้วกลับมา แชทต้องยังอยู่ (เก็บใน sessionStorage แยกตามกิจการ)
//   3. รูปที่แนบต้องโชว์เป็นรูปจริงในบับเบิล ไม่ใช่ path ยาวๆ
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Calculator, Paperclip, X, Loader2, Trash2, Zap, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { assistantReply, type AssistantTurn } from "./actions";

const STARTERS = [
  "เดือนนี้กำไรเท่าไหร่ มีอะไรค้างบ้าง",
  "ใครค้างจ่ายเราบ้าง ทวงใครก่อนดี",
  "ออกใบแจ้งหนี้ค่าบริการ 5,000 บาท ให้บริษัท ตัวอย่าง จำกัด บวก VAT หัก ณ ที่จ่าย 3%",
  "บันทึกค่าไฟเดือนนี้ 2,340 บาท จ่ายแล้ว",
  "สรุปภาษีที่ต้องยื่นเดือนนี้",
  "สินค้าตัวไหนใกล้หมดสต๊อก",
];

/**
 * ย่อรูปเป็น data URL เล็ก ๆ เพื่อเก็บลงประวัติแชท
 * ต้องเล็กจริง เพราะ sessionStorage มีเพดานราว 5MB และเราเก็บ 20 ข้อความ
 * 144px คุณภาพ 0.55 ≈ 4-8KB ต่อรูป — พอให้จำได้ว่าเป็นบิลใบไหนโดยไม่กินที่
 */
async function makeThumbs(files: File[], max = 4): Promise<string[]> {
  const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, max);
  const out: string[] = [];
  for (const f of imgs) {
    try {
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, 144 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      out.push(cv.toDataURL("image/jpeg", 0.55));
    } catch { /* ย่อไม่ได้ก็ข้ามรูปนั้น ไม่ทำให้การส่งล้ม */ }
  }
  return out;
}

interface Msg extends AssistantTurn {
  display?: string;                                // ข้อความที่ "คนเห็น" (content คือที่ส่งให้ AI)
  images?: string[];                               // รูปย่อที่แนบมากับข้อความนี้
  fileNames?: string[];
  toolCalls?: { name: string; label: string }[];
  artifacts?: { label: string; href: string }[];
  choices?: { label: string; reply: string }[];    // ปุ่มตอบ AI — กดแล้วส่งคำตอบให้เลย ไม่ต้องพิมพ์
}

const MAX_FILES = 8;
const MAX_KEEP = 20;   // เก็บแชทล่าสุด 20 ข้อความ — เกินแล้วตัดอันเก่าสุดออกทีละอัน
const storeKey = (shopId: string) => `sc_chat_${shopId}`;
/** ตัดให้เหลือ 20 ล่าสุดเสมอ (ทั้งบนจอและที่เก็บไว้) */
const keepLast = <T,>(list: T[]) => (list.length > MAX_KEEP ? list.slice(-MAX_KEEP) : list);

export default function AssistantChat({ shopId }: { shopId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [restored, setRestored] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState("");                    // ข้อความความคืบหน้าตอนอ่านบิล
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);  // แนบค้างไว้หลายใบ พิมพ์สั่งกำกับก่อนส่ง
  const [error, setError] = useState<string | null>(null);
  const [quotaWall, setQuotaWall] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ============================================================
  //  การเลื่อนจออัตโนมัติ — ของเดิมเลื่อนลงล่างสุดทุกครั้งที่ msgs/busy/reading เปลี่ยน
  //  โดยไม่ดูเลยว่าผู้ใช้กำลังอ่านอะไรอยู่ ปัญหาจริงที่เกิด
  //   · เลื่อนขึ้นไปดูตัวเลขที่ AI ตอบไว้เมื่อกี้ แล้วโดนกระชากลงล่างสุด
  //   · แนบบิล 4 ใบ ข้อความ "กำลังอ่านบิลใบที่ n/4" เปลี่ยน 4 ครั้ง = โดนกระชาก 4 รอบ
  //     ทั้งที่ยังไม่มีข้อความใหม่สักข้อความ
  //  กติกาใหม่: เลื่อนตามให้ก็ต่อเมื่อผู้ใช้ "ยังจอดอยู่ล่างสุด" เท่านั้น
  //  ถ้าเลื่อนหนีขึ้นไปอ่านของเก่า = เคารพเขา แล้วขึ้นปุ่มให้กดลงเองแทน
  // ============================================================
  const stickRef = useRef(true);        // ผู้ใช้ยังจอดอยู่ล่างสุดไหม (ref ไม่ใช่ state — ห้าม re-render ทุกพิกเซลที่เลื่อน)
  const [showJump, setShowJump] = useState(false);

  const NEAR_BOTTOM = 80;   // ห่างขอบล่างไม่เกินนี้ ถือว่ายังตามอยู่
  const FAR_ENOUGH = 160;   // ห่างเกินนี้ค่อยโชว์ปุ่ม ไม่งั้นปุ่มกะพริบตอนเลื่อนนิดเดียว

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < NEAR_BOTTOM;
    setShowJump(dist > FAR_ENOUGH);
  }

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  /**
   * คำตอบใหม่มาถึง — ถ้ายาวเกินจอ ให้จัด "หัวคำตอบ" ไว้บนสุดแทนการดีดไปล่างสุด
   * คำตอบของระบบนี้มักเป็นสรุปภาษี/รายการลูกหนี้ยาว ๆ ถ้าดีดไปล่างสุด
   * ผู้ใช้จะไปโผล่ที่บรรทัดสุดท้ายแล้วต้องเลื่อนหาว่าคำตอบเริ่มตรงไหน
   */
  const scrollForNewMessage = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const last = el.querySelector<HTMLElement>("[data-last-msg]");
    if (last && last.offsetHeight > el.clientHeight - 40) {
      // ใช้ getBoundingClientRect เพราะ offsetParent ของบับเบิลไม่ใช่กล่องนี้เสมอไป
      const top = last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      el.scrollTo({ top: Math.max(0, top - 8), behavior: "auto" });
    } else {
      scrollToBottom();
    }
  }, [scrollToBottom]);

  function jumpToBottom() {
    stickRef.current = true;
    setShowJump(false);
    scrollToBottom(true);
  }

  // กู้แชทเดิมกลับมาเมื่อสลับหน้าไป-กลับ (เก็บใน sessionStorage: ปิดแท็บแล้วเริ่มใหม่ ไม่ค้างข้ามวัน)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storeKey(shopId));
      if (raw) setMsgs(keepLast(JSON.parse(raw) as Msg[]));
    } catch { /* อ่านไม่ได้ = เริ่มใหม่ */ }
    setRestored(true);
  }, [shopId]);

  useEffect(() => {
    if (!restored) return;
    // เก็บรูปย่อ (data URL) ไปด้วย — เดิมลบทิ้งเพราะเก็บ blob url ที่ตายเมื่อรีเฟรช
    // ผลคือย้อนดูประวัติแล้วเห็นแต่ชื่อไฟล์ ไม่รู้ว่าส่งบิลใบไหนไป
    const keep = keepLast(msgs);
    try {
      sessionStorage.setItem(storeKey(shopId), JSON.stringify(keep));
    } catch {
      // พื้นที่เต็ม (รูปกินที่) — ทิ้งรูปของข้อความเก่า เก็บแค่ 3 ข้อความล่าสุดที่มีรูป
      try {
        const trimmed = keep.map((m, i) => (i < keep.length - 3 ? { ...m, images: undefined } : m));
        sessionStorage.setItem(storeKey(shopId), JSON.stringify(trimmed));
      } catch { /* ยังไม่พออีก = ข้ามไป ไม่ทำให้แชทพัง */ }
    }
  }, [msgs, shopId, restored]);

  // ข้อความใหม่เข้ามา — ตามให้เฉพาะตอนที่ผู้ใช้ยังจอดอยู่ล่างสุด
  // ถ้าเขากำลังอ่านของเก่าอยู่ ไม่แตะจอเขา แค่ขึ้นปุ่มบอกว่ามีของใหม่
  useEffect(() => {
    // ยังไม่มีข้อความ = หน้าจอต้อนรับ ห้ามเลื่อนเด็ดขาด
    // ของเดิมเลื่อนลงล่างสุดตั้งแต่เปิดหน้า ทำให้ไอคอนกับคำอธิบายด้านบน
    // ถูกดันพ้นขอบการ์ดไป เห็นเป็นไอคอนโดนตัดครึ่งค้างอยู่ที่ขอบบน
    if (!restored || msgs.length === 0) return;
    if (stickRef.current) scrollForNewMessage();
    else setShowJump(true);
  }, [msgs, restored, scrollForNewMessage]);

  // "กำลังคิด" / "กำลังอ่านบิลใบที่ n/4" — เลื่อนตามได้ แต่ห้ามกระชากคนที่เลื่อนหนีไปแล้ว
  useEffect(() => {
    if (msgs.length === 0) return;
    if (stickRef.current) scrollToBottom();
  }, [busy, reading, msgs.length, scrollToBottom]);

  /** ยิงข้อความให้ AI แล้วต่อคำตอบเข้าแชท — userMsg ต้องถูกใส่ใน msgs มาก่อนแล้ว */
  async function askAi(history: Msg[]) {
    setBusy(true);
    try {
      const r = await assistantReply(shopId, history.map(({ role, content }) => ({ role, content })));
      if (r.ok && r.text) {
        setMsgs(keepLast([...history, { role: "assistant", content: r.text, toolCalls: r.toolCalls, artifacts: r.artifacts, choices: r.choices }]));
        if (r.toolCalls?.some((c) => !c.name.startsWith("get_") && !c.name.startsWith("search_") && !c.name.startsWith("list_"))) {
          router.refresh();   // มีการแก้ข้อมูล -> หน้าอื่นเห็นค่าล่าสุด
        }
      } else if (r.quotaExceeded) {
        setQuotaWall(r.error ?? "โควตางาน AI เต็มแล้ว");
      } else {
        setError(r.error ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  /** ส่งข้อความล้วน */
  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || reading) return;
    setError(null);
    setInput("");
    const next: Msg[] = keepLast([...msgs, { role: "user", content: t } as Msg]);
    setMsgs(next);
    await askAi(next);
  }

  /** ส่งบิลที่แนบไว้ + คำสั่งกำกับ — ขึ้นบับเบิลพร้อมรูปทันที แล้วค่อยอ่านบิลเบื้องหลัง */
  async function sendWithFiles(files: File[], note: string) {
    if (busy || reading) return;
    setError(null);
    const names = files.map((f) => f.name);
    // blob url ขึ้นทันที (เร็ว) — แล้วค่อยแทนด้วยภาพย่อถาวรเบื้องหลัง
    const previews = files.filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f));
    const shown: Msg[] = keepLast([...msgs, {
      role: "user",
      content: "",                     // เดี๋ยวเติมหลังอ่านบิลเสร็จ
      display: note.trim() || `แนบบิล ${files.length} ใบ`,
      images: previews, fileNames: names,
    } as Msg]);
    setMsgs(shown);

    // แปลงเป็นภาพย่อ data URL เพื่อให้ย้อนดูประวัติแล้วยังเห็นว่าส่งบิลใบไหนไป
    void makeThumbs(files).then((thumbs) => {
      if (!thumbs.length) return;
      setMsgs((cur) => cur.map((m, i) => (i === cur.length - 1 && m.role === "user" ? { ...m, images: thumbs } : m)));
      previews.forEach((u) => URL.revokeObjectURL(u));
    });
    setPendingFiles([]);
    setInput("");
    setReading(files.length > 1 ? `กำลังอ่านบิลใบที่ 1/${files.length}...` : "กำลังอ่านบิลด้วย AI...");

    try {
      const parts: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setReading(files.length > 1 ? `กำลังอ่านบิลใบที่ ${i + 1}/${files.length}...` : "กำลังอ่านบิลด้วย AI...");
        const f = await compressImage(files[i]);
        const fd = new FormData();
        fd.append("shop_id", shopId);
        fd.append("file", f);
        const res = await fetch("/api/finance/extract", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) { setError(j.error ?? `อ่านไฟล์ ${f.name} ไม่สำเร็จ`); return; }
        parts.push(`[ไฟล์แนบ${files.length > 1 ? ` ${i + 1}/${files.length}` : ""}: ${f.name}${j.file_path ? ` · file_path: ${j.file_path}` : ""}]\nข้อมูลที่ระบบอ่านได้: ${JSON.stringify(j.data)}`);
      }
      const order = note.trim()
        ? `คำสั่งจากเจ้าของ (ยึดตามนี้ก่อนข้อมูลที่ OCR อ่านได้เสมอ): ${note.trim()}`
        : files.length > 1
          ? `บิล ${files.length} ใบนี้ส่งมาพร้อมกัน — ถามรวบครั้งเดียวว่าทั้งชุดจะบันทึกเป็นอะไร (มีตัวเลือก "คละกัน แยกทีละใบ" ด้วย) แล้วค่อยบันทึกรวดเดียว ห้ามไล่ถามทีละใบถ้าไม่จำเป็น`
          : "ช่วยตรวจและบันทึกเข้าระบบให้หน่อย ถ้าตัวเลขไม่ชัดหรือไม่รู้ว่าเอกสารนี้คืออะไร ให้ถามก่อน อย่าเดา";
      const withContent = shown.map((m, i) =>
        i === shown.length - 1 ? { ...m, content: [...parts, order].join("\n\n") } : m);
      setMsgs(withContent);
      setReading("");
      await askAi(withContent);
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setReading("");
    }
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (pendingFiles.length) sendWithFiles(pendingFiles, input);
    else send(input);
  }

  function clearChat() {
    setMsgs([]);
    setError(null);
    setQuotaWall(null);
    try { sessionStorage.removeItem(storeKey(shopId)); } catch { /* ข้าม */ }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ครอบสายเลื่อนด้วยกล่อง relative ของตัวเอง — ปุ่มลอยจะได้เกาะ "ขอบล่างของสายเลื่อน"
          ไม่ใช่ขอบล่างของทั้งแชท ถ้าเกาะทั้งแชท พอแนบบิลไว้ช่องพิมพ์จะสูงขึ้นอีก ~80px
          แล้วปุ่มจะไปทับรูปบิลที่แนบค้างไว้ */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={listRef} onScroll={onListScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div className="pt-6 text-center">
            <Calculator className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">
              สั่งได้ทุกเรื่องบัญชี — ออกเอกสาร บันทึกรายจ่าย รับเงิน ดูยอดค้าง สรุปภาษี
            </p>
            <p className="mx-auto mt-1 flex max-w-sm items-center justify-center gap-1 text-[11px] text-neutral-400">
              <Paperclip className="h-3 w-3 shrink-0" /> แนบรูปบิลได้ทีละหลายใบ พิมพ์สั่งกำกับได้เลย เช่น &ldquo;ค่าเช่า ยังไม่จ่าย&rdquo; · ตัวเลขไม่ชัดระบบจะถามก่อนบันทึกเสมอ
            </p>
            <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
              {/* ปุ่มตัวอย่างคำสั่งเป็นสิ่งแรกที่คนกดในหน้านี้ ต้องกดง่ายจริง
                  ของเดิม py-1.5 + text-xs = สูง 28px ต่ำกว่าเกณฑ์เป้ากดขั้นต่ำ 44px
                  และตัวหนังสือ 12px เล็กไปสำหรับผู้ใช้สูงวัยที่เป็นลูกค้าหลักของระบบบัญชี */}
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 px-4 py-2.5 text-[13px] leading-snug text-neutral-600 transition-colors hover:border-emerald-300 hover:text-emerald-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.length > 0 && (
          <div className="flex justify-end">
            <button onClick={clearChat} className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-red-600">
              <Trash2 className="h-3 w-3" /> ล้างแชท
            </button>
          </div>
        )}

        {msgs.map((m, i) => (
          // data-last-msg = จุดอ้างอิงให้ตัวเลื่อนจอวัดว่าคำตอบล่าสุดสูงเกินจอไหม
          <div key={i} data-last-msg={i === msgs.length - 1 ? "" : undefined}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
              m.role === "user" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-800",
            )}>
              {/* รูปบิลที่แนบ — โชว์เป็นรูปจริง ไม่ใช่ path */}
              {m.images && m.images.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {m.images.map((src, j) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={j} src={src} alt={`บิล ${j + 1}`} className="h-20 w-20 rounded-lg border border-white/20 object-cover" />
                  ))}
                </div>
              )}
              {!m.images?.length && m.fileNames && m.fileNames.length > 0 && (
                <p className="mb-1 flex items-center gap-1 text-[11px] opacity-70">
                  <Paperclip className="h-3 w-3" /> {m.fileNames.join(", ")}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words">
                {m.display ?? (m.role === "user" && m.content.startsWith("[ไฟล์แนบ") ? m.content.split("\n")[0] : m.content)}
              </p>
              {m.artifacts && m.artifacts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.artifacts.map((a, j) => (
                    <a key={j} href={a.href} target={a.href.startsWith("/doc/") || a.href.includes("/print/") ? "_blank" : undefined}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                      {a.label} →
                    </a>
                  ))}
                </div>
              )}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <p className="mt-1 text-[10px] text-neutral-400">{m.toolCalls.map((t) => t.label).join(" · ")}</p>
              )}
              {/* ปุ่มตอบ AI — โชว์เฉพาะข้อความล่าสุด กันกดย้อนอดีตแล้วสับสน */}
              {m.choices && m.choices.length > 0 && i === msgs.length - 1 && !busy && !reading && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {m.choices.map((c, j) => (
                    <button key={j} type="button" onClick={() => send(c.reply)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-emerald-800 transition hover:bg-emerald-50 active:scale-[0.99]">
                      <span className="min-w-0">{c.label}</span>
                      <span className="shrink-0 text-emerald-400">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {reading && (
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Loader2 className="h-3 w-3 animate-spin" /> {reading}
          </p>
        )}
        {busy && !reading && (
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Loader2 className="h-3 w-3 animate-spin" /> ผู้ช่วยบัญชีกำลังจัดการให้...
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>}
        {quotaWall && (
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-center">
            <Zap className="mx-auto h-7 w-7 text-emerald-500" />
            <p className="mt-1 text-sm font-semibold text-neutral-800">{quotaWall}</p>
            <p className="mt-1 text-xs text-neutral-400">งานเอกสาร/บัญชีคีย์เองได้ไม่จำกัดตามปกติ — โควตานี้เฉพาะงาน AI</p>
            <a href="/dashboard/billing"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              อัปเกรด / ต่ออายุแพ็กเกจ →
            </a>
          </div>
        )}
      </div>

      {/* ปุ่มลงล่างสุด — โผล่เฉพาะตอนเลื่อนหนีขึ้นไปแล้ว
          วางลอยเหนือช่องพิมพ์ ไม่ใช่ในสายเลื่อน จะได้ไม่หายไปกับเนื้อหา
          บอกด้วยว่ามีข้อความใหม่ไหม คนที่เลื่อนขึ้นไปอ่านของเก่าจะได้รู้ว่า AI ตอบแล้ว */}
      {showJump && (
        <button type="button" onClick={jumpToBottom}
          className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-neutral-200 bg-white/95 px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-lg backdrop-blur transition-colors hover:bg-neutral-50">
          <ArrowDown className="h-3.5 w-3.5" />
          {busy || reading ? "กำลังตอบอยู่ด้านล่าง" : "ไปข้อความล่าสุด"}
        </button>
      )}
      </div>

      <div className="border-t border-neutral-100 p-3">
        {pendingFiles.length > 0 && (
          <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-emerald-800">แนบไว้ {pendingFiles.length} ใบ — พิมพ์สั่งกำกับได้ เช่น &ldquo;ทั้งหมดยังไม่จ่าย&rdquo;</p>
              <button type="button" onClick={() => setPendingFiles([])} className="shrink-0 text-[11px] text-emerald-700 underline">เอาออกทั้งหมด</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <div key={i} className="relative">
                  {f.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-14 w-14 rounded-lg border border-emerald-200 object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-lg border border-emerald-200 bg-white text-[9px] text-emerald-700">PDF</div>
                  )}
                  <button type="button" aria-label="เอาไฟล์นี้ออก"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-white shadow">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <form className="flex gap-2" onSubmit={submitForm}>
          <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) { setPendingFiles((prev) => [...prev, ...fs].slice(0, MAX_FILES)); setError(null); } e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || !!reading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40"
            title="แนบรูปบิล/เอกสาร เลือกได้หลายใบพร้อมกัน">
            <Paperclip className="h-4 w-4" />
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={pendingFiles.length ? "สั่งกำกับบิล (ไม่พิมพ์ก็ได้) เช่น ค่าเช่า ยังไม่จ่าย" : "สั่งงานบัญชี เช่น ออกใบแจ้งหนี้ 5,000 ให้คุณสมชาย..."}
            className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-emerald-500 sm:text-sm" />
          <button disabled={busy || !!reading || (!input.trim() && !pendingFiles.length)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40">
            {busy || reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
