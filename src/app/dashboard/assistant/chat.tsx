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
import {
  Send, Calculator, Paperclip, X, Loader2, Trash2, Zap, ArrowDown, Plus,
  FileText, Receipt, BarChart3, Users, Landmark, Package, Mic, MicOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Mascot from "@/components/mascot";
import { useVoiceInput } from "@/lib/use-voice-input";
import { ACTION_CHIP } from "@/components/ui";
import { assistantProgress, assistantReply, getDocPreview, type AssistantTurn, type DocPreviewData } from "./actions";
import DocPreview from "@/app/dashboard/finance/doc-preview";
import type { DocType, VatMode } from "@/lib/types/finance";

/**
 * งานเริ่มต้นที่คนใช้บ่อย — โชว์เป็นการ์ดบนหน้าต้อนรับ
 * title/desc คือสิ่งที่คนอ่าน ("กดแล้วได้อะไร") ส่วน prompt คือข้อความที่ส่งให้ AI จริง
 * เดิมเป็นประโยคตัวอย่างล้วน ๆ เรียงเป็นเม็ดยา อ่านแล้วต้องเดาเองว่าระบบทำอะไรได้บ้าง
 */
const STARTERS = [
  { icon: FileText, title: "ออกใบแจ้งหนี้", desc: "บอกยอดกับชื่อลูกค้า เดี๋ยวออกเอกสารและลงบัญชีให้",
    prompt: "ออกใบแจ้งหนี้ค่าบริการ 5,000 บาท ให้บริษัท ตัวอย่าง จำกัด บวก VAT หัก ณ ที่จ่าย 3%" },
  { icon: Receipt, title: "บันทึกค่าใช้จ่าย", desc: "พิมพ์บอก หรือแนบรูปบิลให้อ่านก็ได้",
    prompt: "บันทึกค่าไฟเดือนนี้ 2,340 บาท จ่ายแล้ว" },
  { icon: BarChart3, title: "กำไร-ขาดทุนเดือนนี้", desc: "ตัวเลขจริงจากสมุดรายวัน พร้อมรายการที่ค้างอยู่",
    prompt: "เดือนนี้กำไรเท่าไหร่ มีอะไรค้างบ้าง" },
  { icon: Users, title: "ใครค้างจ่ายเรา", desc: "ไล่ยอดลูกหนี้ พร้อมแนะว่าควรทวงใครก่อน",
    prompt: "ใครค้างจ่ายเราบ้าง ทวงใครก่อนดี" },
  { icon: Landmark, title: "ภาษีที่ต้องยื่นเดือนนี้", desc: "ภ.พ.30 · ภ.ง.ด.3/53 พร้อมกำหนดส่ง",
    prompt: "สรุปภาษีที่ต้องยื่นเดือนนี้" },
  { icon: Package, title: "เช็คสต๊อกใกล้หมด", desc: "ดูว่าสินค้าตัวไหนควรสั่งเติมก่อนของขาด",
    prompt: "สินค้าตัวไหนใกล้หมดสต๊อก" },
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
  id?: string;                                     // ใช้หาข้อความให้ถูกตัวตอนแทนรูปย่อทีหลัง (ห้ามอ้าง "ตัวสุดท้าย")
  display?: string;                                // ข้อความที่ "คนเห็น" (content คือที่ส่งให้ AI)
  images?: string[];                               // รูปย่อที่แนบมากับข้อความนี้
  fileNames?: string[];
  toolCalls?: { name: string; label: string }[];
  artifacts?: { label: string; href: string }[];
  choices?: { label: string; reply: string; hint?: string }[];    // ปุ่มตอบ AI — กดแล้วส่งคำตอบให้เลย ไม่ต้องพิมพ์
}

const MAX_FILES = 8;
const MAX_KEEP = 20;   // เก็บแชทล่าสุด 20 ข้อความ — เกินแล้วตัดอันเก่าสุดออกทีละอัน
// ============================================================
//  ห้องแชทหลายห้อง + เก็บถาวร
//
//  ⚠️ เดิมใช้ sessionStorage โดยตั้งใจว่า "ปิดแท็บแล้วเริ่มใหม่ ไม่ค้างข้ามวัน"
//  แต่เจ้าของเจอจริง 4 ส.ค. 2569: "กลับมาหน้าแชทที่คุยไว้ก็หายไปตลอด"
//  งานบัญชีไม่ใช่แชทเล่น — สั่งค้างไว้แล้วปิดแท็บไปทำอย่างอื่น กลับมาต้องยังอยู่
//  จึงย้ายมา localStorage และแยกเป็นห้อง เพื่อให้แยกงานคนละเรื่องได้
//  (เช่น ห้องออกบิลลูกค้า กับ ห้องปิดงบ ไม่ต้องปนกันจน AI สับสนบริบท)
//
//  เก็บฝั่งเครื่องผู้ใช้เท่านั้น ไม่ขึ้นฐานข้อมูล — ประวัติแชทมีทั้งชื่อลูกค้าและยอดเงิน
//  เก็บขึ้นเซิร์ฟเวอร์เท่ากับเพิ่มพื้นที่ข้อมูลส่วนบุคคลที่ต้องดูแลตาม PDPA โดยไม่จำเป็น
// ============================================================
const MAX_THREADS = 8;
const threadsKey = (shopId: string) => `sc_chat_threads_${shopId}`;
const storeKey = (shopId: string, threadId: string) => `sc_chat_${shopId}_${threadId}`;
/** คีย์เดิมสมัยห้องเดียว — ใช้ย้ายของเก่าเข้าห้องแรกครั้งเดียว ไม่ให้แชทที่ค้างอยู่หาย */
const legacyKey = (shopId: string) => `sc_chat_${shopId}`;

interface Thread { id: string; title: string; at: number }

const newThreadId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** ตั้งชื่อห้องจากสิ่งที่ผู้ใช้พิมพ์ประโยคแรก — ผู้ใช้ไม่ต้องมานั่งตั้งชื่อเอง
 *  ใช้ display ก่อน content เพราะ content คือข้อความที่ส่งให้ AI (อาจมีบริบทพ่วง)
 *  ส่วน display คือสิ่งที่ผู้ใช้เห็นว่าตัวเองพิมพ์ ซึ่งตรงกับที่เขาจำได้มากกว่า */
function titleFrom(msgs: Msg[]): string {
  const first = msgs.find((m) => m.role === "user" && (m.display ?? m.content)?.trim());
  const t = (first?.display ?? first?.content ?? "").trim().replace(/\s+/g, " ");
  return t ? (t.length > 26 ? t.slice(0, 26) + "…" : t) : "ห้องใหม่";
}

function readThreads(shopId: string): Thread[] {
  try {
    const raw = localStorage.getItem(threadsKey(shopId));
    const list = raw ? (JSON.parse(raw) as Thread[]) : [];
    return Array.isArray(list) ? list.filter((t) => t && typeof t.id === "string") : [];
  } catch { return []; }
}

function writeThreads(shopId: string, list: Thread[]) {
  try { localStorage.setItem(threadsKey(shopId), JSON.stringify(list.slice(0, MAX_THREADS))); } catch { /* เต็มก็ข้าม */ }
}
/** ตัดให้เหลือ 20 ล่าสุดเสมอ (ทั้งบนจอและที่เก็บไว้) */
const keepLast = <T,>(list: T[]) => (list.length > MAX_KEEP ? list.slice(-MAX_KEEP) : list);

export default function AssistantChat({ shopId, initialMessage }: { shopId: string; initialMessage?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [restored, setRestored] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState("");                    // ข้อความความคืบหน้าตอนอ่านบิล
  const [error, setError] = useState<string | null>(null);
  // ประวัติของรอบที่ส่งไม่สำเร็จ — ให้ปุ่ม "ส่งอีกครั้ง" ยิงซ้ำได้โดยไม่ต้องพิมพ์ใหม่
  const retryRef = useRef<Msg[] | null>(null);
  // พูดสั่งงาน (Web Speech API) — เพิ่ม 28 ส.ค. 2569 ตามมอคอัพ Sudo Financial OS
  // เสียงแค่ "พิมพ์แทนมือ" ลงช่องเดิม ไม่ auto-submit เด็ดขาด — ต้องผ่านด่านตรวจ/ยืนยันเดิม
  // ทุกอย่างเหมือนคำสั่งพิมพ์เอง ไม่เปิดทางลัดให้เสียงสั่งเงินตรงๆ โดยไม่มีคนเห็นข้อความก่อนส่ง
  const { listening, supported: voiceSupported, toggle: toggleVoice } = useVoiceInput(setInput, setError);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);  // แนบค้างไว้หลายใบ พิมพ์สั่งกำกับก่อนส่ง
  const [dragOver, setDragOver] = useState(false);               // ลากไฟล์มาวางเหนือกล่องพิมพ์
  const [stepLabel, setStepLabel] = useState<string | null>(null);  // ขั้นตอนจริงที่ AI กำลังทำ (จาก server)
  const [preview, setPreview] = useState<DocPreviewData | null>(null);   // ใบเอกสารที่กำลังดูคาแชท
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);   // href ที่กำลังโหลด

  /**
   * ทางเข้าไฟล์ทางเดียวสำหรับทั้งสามวิธี: กดคลิปหนีบ · วางจากคลิปบอร์ด (Ctrl+V) · ลากมาวาง
   *
   * ⚠️ ทำไมต้องรวมเป็นตัวเดียว: เดิมตรรกะอยู่ใน onChange ของ input file บรรทัดเดียว
   * ถ้าก๊อปมาแปะอีกสองที่ วันหนึ่งจะแก้เพดานจำนวนไฟล์ตกไปทางใดทางหนึ่งแล้วไม่มีใครรู้
   *
   * ⚠️ รูปที่วางจากคลิปบอร์ดไม่มีชื่อไฟล์ (Windows/macOS ให้มาเป็น "image.png" หรือว่างเลย)
   * ต้องตั้งชื่อให้เอง ไม่งั้นชื่อบนการ์ดไฟล์ว่างเปล่าและผู้ใช้แยกไม่ออกว่าวางไปกี่รูป
   */
  const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  function addFiles(incoming: File[], source: "pick" | "paste" | "drop") {
    const good: File[] = [];
    let rejected = 0;
    for (const f of incoming) {
      if (!OK_TYPES.includes(f.type)) { rejected++; continue; }
      // ตั้งชื่อให้รูปที่วางมาแบบไม่มีชื่อ เพื่อให้เห็นบนการ์ดไฟล์ว่าคือรูปที่วางเมื่อไหร่
      if (source !== "pick" && (!f.name || f.name === "image.png" || f.name === "blob")) {
        const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1] ?? "png";
        const stamp = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        good.push(new File([f], `รูปที่วาง ${stamp}.${ext}`, { type: f.type }));
        continue;
      }
      good.push(f);
    }
    if (good.length) {
      setPendingFiles((prev) => [...prev, ...good].slice(0, MAX_FILES));
      setError(null);
    }
    if (rejected > 0 && !good.length) {
      setError("วางได้เฉพาะรูป (PNG/JPG/WebP) หรือไฟล์ PDF — ถ้าก๊อปมาจากหน้าจอ ให้แคปเป็นรูปก่อน");
    }
  }
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
  // onListScroll เป็น handler ธรรมดา อ่าน state ตรง ๆ จะได้ค่าเก่า — เก็บจำนวนข้อความไว้ใน ref
  const msgsRef = useRef(0);

  const NEAR_BOTTOM = 80;   // ห่างขอบล่างไม่เกินนี้ ถือว่ายังตามอยู่
  const FAR_ENOUGH = 160;   // ห่างเกินนี้ค่อยโชว์ปุ่ม ไม่งั้นปุ่มกะพริบตอนเลื่อนนิดเดียว

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < NEAR_BOTTOM;
    // ⚠️ ห้ามโชว์ปุ่ม "ไปข้อความล่าสุด" ตอนยังไม่มีข้อความ
    // เจ้าของเจอจริง: หน้าต้อนรับมีการ์ด 6 ใบ สูงกว่าจอ -> dist เกิน 160
    // ปุ่มเลยโผล่ลอยทับการ์ดทั้งที่ไม่มีข้อความให้ไปหาสักข้อความ
    setShowJump(msgsRef.current > 0 && dist > FAR_ENOUGH);
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

  // เปิดหน้า/สลับกิจการ -> โหลดรายการห้อง แล้วเปิดห้องล่าสุด
  useEffect(() => {
    setRestored(false);
    let list = readThreads(shopId);

    // ย้ายแชทเดิมสมัยห้องเดียวเข้าห้องแรกครั้งเดียว — ของที่ค้างอยู่ต้องไม่หายตอนอัปเดต
    if (!list.length) {
      let legacy: Msg[] = [];
      try {
        const raw = sessionStorage.getItem(legacyKey(shopId)) ?? localStorage.getItem(legacyKey(shopId));
        if (raw) legacy = keepLast(JSON.parse(raw) as Msg[]);
      } catch { /* ของเก่าเสียก็ข้าม */ }
      const id = newThreadId();
      list = [{ id, title: legacy.length ? titleFrom(legacy) : "ห้องใหม่", at: Date.now() }];
      if (legacy.length) {
        try { localStorage.setItem(storeKey(shopId, id), JSON.stringify(legacy)); } catch { /* ข้าม */ }
      }
      writeThreads(shopId, list);
      try { sessionStorage.removeItem(legacyKey(shopId)); localStorage.removeItem(legacyKey(shopId)); } catch { /* ข้าม */ }
    }

    const active = list[0];
    setThreads(list);
    setThreadId(active.id);
    try {
      const raw = localStorage.getItem(storeKey(shopId, active.id));
      setMsgs(raw ? keepLast(JSON.parse(raw) as Msg[]) : []);
    } catch { setMsgs([]); }
    setRestored(true);
  }, [shopId]);

  useEffect(() => {
    if (!restored || !threadId) return;
    // เก็บรูปย่อ (data URL) ไปด้วย — เดิมลบทิ้งเพราะเก็บ blob url ที่ตายเมื่อรีเฟรช
    // ผลคือย้อนดูประวัติแล้วเห็นแต่ชื่อไฟล์ ไม่รู้ว่าส่งบิลใบไหนไป
    const keep = keepLast(msgs);
    try {
      localStorage.setItem(storeKey(shopId, threadId), JSON.stringify(keep));
    } catch {
      // พื้นที่เต็ม (รูปกินที่) — ทิ้งรูปของข้อความเก่า เก็บแค่ 3 ข้อความล่าสุดที่มีรูป
      try {
        const trimmed = keep.map((m, i) => (i < keep.length - 3 ? { ...m, images: undefined } : m));
        localStorage.setItem(storeKey(shopId, threadId), JSON.stringify(trimmed));
      } catch { /* ยังไม่พออีก = ข้ามไป ไม่ทำให้แชทพัง */ }
    }
    // ตั้งชื่อห้องตามประโยคแรก + ดันห้องที่เพิ่งคุยขึ้นบนสุด
    if (!keep.length) return;
    setThreads((cur) => {
      const t = cur.find((x) => x.id === threadId);
      if (!t) return cur;
      const title = titleFrom(keep);
      if (t.title === title && cur[0]?.id === threadId) return cur;
      const next = [{ ...t, title, at: Date.now() }, ...cur.filter((x) => x.id !== threadId)];
      writeThreads(shopId, next);
      return next;
    });
  }, [msgs, shopId, restored, threadId]);

  // ---- ข้อความที่ถูกส่งมาจากช่องสั่งงานบนหน้าแรก (?q=) ----
  //
  // ⚠️ ต้องรอ restored ก่อน ห้ามยิงตอน mount
  // เอฟเฟกต์กู้ประวัติเรียก setMsgs(ของเก่า) ทับสเตตทั้งก้อน
  // ถ้ายิงคำถามไปก่อน ข้อความของผู้ใช้จะถูกประวัติเก่าทับหายไปต่อหน้าต่อตา
  //
  // ⚠️ ต้องยิงผ่าน ref ไม่ใช่ใส่ send ใน deps
  // send ถูกสร้างใหม่ทุก render ถ้าใส่ใน deps เอฟเฟกต์จะวิ่งซ้ำและส่งคำถามเดิมรัว ๆ
  // (กติกาข้อ 3: อยากให้หยุดต้องบังคับด้วยโค้ด — firedRef คือด่านนั้น)
  const sendRef = useRef<(t: string) => void>(() => {});
  sendRef.current = send;
  const firedRef = useRef(false);
  useEffect(() => {
    const q = initialMessage?.trim();
    if (!restored || firedRef.current || !q) return;
    firedRef.current = true;
    // ⚠️ ต้องล้าง ?q= ออกจาก URL ทันทีที่ยิงไปแล้ว ห้ามปล่อยค้าง
    // ถ้าปล่อยไว้ แล้วผู้ใช้กดรีเฟรช (หรือกดย้อนกลับมาหน้านี้) คำสั่งเดิมจะถูกส่งซ้ำ
    // ซึ่งกับคำสั่งอย่าง "ออกใบแจ้งหนี้ 15,000" = ออกเอกสารซ้ำใบที่สองโดยไม่มีใครสั่ง
    // firedRef กันได้แค่ภายในคอมโพเนนต์ตัวเดิม รีเฟรชแล้วมันเริ่มใหม่หมด
    router.replace("/dashboard/assistant", { scroll: false });
    sendRef.current(q);
  }, [restored, initialMessage, router]);

  // ข้อความใหม่เข้ามา — ตามให้เฉพาะตอนที่ผู้ใช้ยังจอดอยู่ล่างสุด
  // ถ้าเขากำลังอ่านของเก่าอยู่ ไม่แตะจอเขา แค่ขึ้นปุ่มบอกว่ามีของใหม่
  useEffect(() => {
    // ยังไม่มีข้อความ = หน้าจอต้อนรับ ห้ามเลื่อนเด็ดขาด
    // ของเดิมเลื่อนลงล่างสุดตั้งแต่เปิดหน้า ทำให้ไอคอนกับคำอธิบายด้านบน
    // ถูกดันพ้นขอบการ์ดไป เห็นเป็นไอคอนโดนตัดครึ่งค้างอยู่ที่ขอบบน
    msgsRef.current = msgs.length;
    if (!restored || msgs.length === 0) { setShowJump(false); return; }
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
    // ป้ายบอกขั้นตอนจริงระหว่างรอ (ผลตรวจ 28 ส.ค. 2569) — engine เขียนขั้นที่กำลังทำ
    // ลงตาราง assistant_progress แล้วฝั่งนี้ poll ทุก 1.2 วิ · เป็นของจริงจาก server
    // ไม่ใช่ข้อความหมุนตามเวลา และพังได้เงียบ ๆ โดยไม่กระทบคำตอบ
    const rid = crypto.randomUUID();
    const poll = setInterval(async () => {
      try {
        const label = await assistantProgress(shopId, rid);
        if (label) setStepLabel(label);
      } catch { /* ป้ายหายไม่เป็นไร */ }
    }, 1200);
    try {
      const r = await assistantReply(shopId, history.map(({ role, content }) => ({ role, content })), rid);
      if (r.ok && r.text) {
        setMsgs(keepLast([...history, { role: "assistant", content: r.text, toolCalls: r.toolCalls, artifacts: r.artifacts, choices: r.choices }]));
        if (r.toolCalls?.some((c) => !c.name.startsWith("get_") && !c.name.startsWith("search_") && !c.name.startsWith("list_"))) {
          router.refresh();   // มีการแก้ข้อมูล -> หน้าอื่นเห็นค่าล่าสุด
        }
      } else if (r.quotaExceeded) {
        setQuotaWall(r.error ?? "โควตางาน AI เต็มแล้ว");
      } else {
        retryRef.current = history;
        setError(r.error ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }
    } catch {
      retryRef.current = history;
      setError("เชื่อมต่อไม่สำเร็จ — ข้อความของคุณยังอยู่ กดส่งอีกครั้งได้เลย");
    } finally {
      clearInterval(poll);
      setStepLabel(null);
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
    // ⚠️ ต้องมี id ประจำข้อความ — เจ้าของเจอบั๊กรูปขึ้นเป็นไอคอนรูปแตก
    // ต้นเหตุ: ของเดิมหาข้อความที่จะใส่รูปด้วย "ตัวสุดท้ายที่เป็น user"
    // ถ้าย่อรูปเสร็จช้ากว่า AI ตอบ ตัวสุดท้ายจะเป็นข้อความ AI แล้ว -> ใส่รูปไม่ลง
    // แต่โค้ดยัง revoke blob url ต่อ = รูปที่โชว์อยู่ตาย กลายเป็นรูปแตกทันที
    const mid = `m${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    const shown: Msg[] = keepLast([...msgs, {
      id: mid,
      role: "user",
      content: "",                     // เดี๋ยวเติมหลังอ่านบิลเสร็จ
      display: note.trim() || `แนบบิล ${files.length} ใบ`,
      images: previews, fileNames: names,
    } as Msg]);
    setMsgs(shown);

    // แปลงเป็นภาพย่อ data URL เพื่อให้ย้อนดูประวัติแล้วยังเห็นว่าส่งบิลใบไหนไป
    void makeThumbs(files).then((thumbs) => {
      // ย่อไม่สำเร็จ (เช่นไฟล์ HEIC จาก iPhone ที่ createImageBitmap อ่านไม่ได้)
      // ให้คา blob url ไว้ใช้ต่อในรอบนี้ ห้าม revoke ไม่งั้นรูปที่กำลังโชว์ตายทันที
      if (!thumbs.length) return;
      let replaced = false;
      setMsgs((cur) => cur.map((m) => {
        if (m.id !== mid) return m;
        replaced = true;
        return { ...m, images: thumbs };
      }));
      // revoke เฉพาะตอนแทนสำเร็จจริง — ไม่งั้นทิ้ง url ที่จอยังใช้อยู่
      if (replaced) previews.forEach((u) => URL.revokeObjectURL(u));
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

  /** ล้างเฉพาะข้อความในห้องนี้ ห้องยังอยู่ (ผู้ใช้มักอยากเริ่มเรื่องใหม่ในห้องเดิม) */
  function clearChat() {
    setMsgs([]);
    setError(null);
    setQuotaWall(null);
    if (threadId) { try { localStorage.removeItem(storeKey(shopId, threadId)); } catch { /* ข้าม */ } }
  }

  function openThread(id: string) {
    if (id === threadId) return;
    setError(null);
    setQuotaWall(null);
    setThreadId(id);
    try {
      const raw = localStorage.getItem(storeKey(shopId, id));
      setMsgs(raw ? keepLast(JSON.parse(raw) as Msg[]) : []);
    } catch { setMsgs([]); }
  }

  function addThread() {
    // เต็มเพดานแล้วให้ทิ้งห้องที่เก่าที่สุด — ไม่งั้น localStorage บวมไปเรื่อย ๆ
    const id = newThreadId();
    const next = [{ id, title: "ห้องใหม่", at: Date.now() }, ...threads].slice(0, MAX_THREADS);
    const dropped = threads.find((t) => !next.some((n) => n.id === t.id));
    if (dropped) { try { localStorage.removeItem(storeKey(shopId, dropped.id)); } catch { /* ข้าม */ } }
    setThreads(next);
    writeThreads(shopId, next);
    setError(null);
    setQuotaWall(null);
    setThreadId(id);
    setMsgs([]);
  }

  function removeThread(id: string) {
    const rest = threads.filter((t) => t.id !== id);
    try { localStorage.removeItem(storeKey(shopId, id)); } catch { /* ข้าม */ }
    // ปิดห้องสุดท้ายแล้วต้องมีห้องว่างเสมอ ไม่งั้นหน้าจะไม่มีที่ให้พิมพ์
    const list = rest.length ? rest : [{ id: newThreadId(), title: "ห้องใหม่", at: Date.now() }];
    setThreads(list);
    writeThreads(shopId, list);
    if (id === threadId) {
      setThreadId(list[0].id);
      try {
        const raw = localStorage.getItem(storeKey(shopId, list[0].id));
        setMsgs(raw ? keepLast(JSON.parse(raw) as Msg[]) : []);
      } catch { setMsgs([]); }
    }
  }

  return (
    // ⚠️ สองคอลัมน์เฉพาะจอกว้าง (lg ขึ้นไป) — มือถือยังเป็นหน้าต่างทับจอเหมือนเดิม
    // ใบเอกสารกว้างประมาณ 26rem ถ้าบีบลงจอ 375px พร้อมกับแชท จะเหลือช่องละ ~180px
    // ซึ่งอ่านไม่ได้ทั้งคู่ — แผงค้างข้างขวาเป็นของดีเฉพาะตอนมีที่ให้ค้างจริง
    <div className="flex h-full min-h-0">
      <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* แถบห้องแชท — โผล่เมื่อเริ่มคุยแล้วเท่านั้น
          ผู้ใช้เปิดหน้ามาครั้งแรกเจอห้องว่างห้องเดียว การโชว์แถบตั้งแต่ยังไม่มีอะไร
          คือเพิ่มของรกโดยไม่ตอบคำถามอะไรของเขาเลย */}
      {(threads.length > 1 || msgs.length > 0) && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-neutral-100 px-3 py-2">
          {threads.map((t) => (
            <div key={t.id}
              className={cn(
                "group flex shrink-0 items-center gap-1 rounded-full border pl-3 pr-1 transition-colors",
                t.id === threadId
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300",
              )}>
              <button type="button" onClick={() => openThread(t.id)}
                className="max-w-[9rem] truncate py-2 text-[12px] font-medium">
                {t.title}
              </button>
              <button type="button" aria-label={`ปิดห้อง ${t.title}`}
                onClick={() => removeThread(t.id)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-neutral-300 hover:bg-white hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {threads.length < MAX_THREADS && (
            <button type="button" onClick={addThread}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 py-2 text-[12px] font-medium text-neutral-500 hover:border-emerald-400 hover:text-emerald-700">
              <Plus className="h-3.5 w-3.5" /> ห้องใหม่
            </button>
          )}
        </div>
      )}

      {/* ครอบสายเลื่อนด้วยกล่อง relative ของตัวเอง — ปุ่มลอยจะได้เกาะ "ขอบล่างของสายเลื่อน"
          ไม่ใช่ขอบล่างของทั้งแชท ถ้าเกาะทั้งแชท พอแนบบิลไว้ช่องพิมพ์จะสูงขึ้นอีก ~80px
          แล้วปุ่มจะไปทับรูปบิลที่แนบค้างไว้ */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      {/* ⚠️ ข้อความต้องกองอยู่ "ล่าง" ของพื้นที่แชท ไม่ใช่บน (แก้ 29 ส.ค. 2569)
          เจ้าของแคปมาจริง: คุยไป 2 ประโยคแล้วขึ้น "ผู้ช่วยบัญชีกำลังจัดการให้..."
          ตัวข้อความเกาะอยู่บนสุด เหลือพื้นที่ขาวโล่งใต้มันเกินครึ่งจอ
          อ่านแล้วเหมือนหน้าค้าง/โหลดไม่ขึ้น ทั้งที่ระบบกำลังทำงานอยู่จริง
          justify-end + min-h-full = สั้นก็ชิดล่างติดช่องพิมพ์แบบแชททั่วไป
          ยาวเกินจอก็ยืดแล้วเลื่อนได้ตามปกติ (ห้ามใช้ h-full ตัวเนื้อหาจะโดนตัด) */}
      <div ref={listRef} onScroll={onListScroll} className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      <div className={cn("flex min-h-full flex-col space-y-3", msgs.length > 0 && "justify-end")}>
        {msgs.length === 0 && (
          /* ==========================================================
             หน้าต้อนรับ — เจ้าของบอกว่าของเดิม "โล่งและไม่เป็นมืออาชีพ"
             ซึ่งจริง: บนจอเดสก์ท็อป เม็ดยาเล็ก ๆ กองอยู่บนสุดของการ์ดเปล่า
             ที่สูงเกือบเต็มจอ = พื้นที่ว่าง 80% ของจอไม่มีอะไรเลย

             แก้ 2 อย่าง
             1. จัดกึ่งกลางแนวตั้งของพื้นที่แชท (h-full + justify-center)
                แบบเดียวกับผู้ช่วย AI ที่คนคุ้นมือ — จอไม่ดูร้าง
             2. เม็ดยาประโยคตัวอย่าง -> การ์ดงานที่บอกว่า "กดแล้วได้อะไร"
                หัวข้อหนา + คำอธิบาย ผู้ใช้ใหม่อ่านออกโดยไม่ต้องเดา
             ========================================================== */
          /* min-h-full ไม่ใช่ h-full — จอเตี้ย (มือถือแนวนอน/หน้าต่างย่อ) การ์ด 6 ใบ
             สูงกว่าพื้นที่ ถ้าล็อกความสูงแล้ว justify-center หัวจะโดนตัดแบบเลื่อนกลับไม่ได้
             min-h ให้กล่องยืดตามเนื้อหาแล้วเลื่อนดูได้ปกติ จอสูงก็ยังได้กึ่งกลางเหมือนเดิม */
          <div className="flex min-h-full flex-col items-center justify-center px-1 sm:px-2">
            <div className="w-full max-w-2xl">
              <div className="text-center">
                <Mascot size={84} className="mx-auto" />
                <h2 className="mt-2 text-lg font-bold tracking-tight text-neutral-900">วันนี้ให้ช่วยเรื่องไหนดี</h2>
                <p className="mt-1 text-[13px] text-neutral-500">
                  พิมพ์สั่งเป็นภาษาคนในช่องด้านล่าง หรือเริ่มจากงานที่ใช้บ่อย
                </p>
              </div>

              {/* ⚠️ มือถือต้องพอดีจอ ห้ามให้ต้องเลื่อนกว่าจะเจอช่องพิมพ์
                  เจ้าของเจอจริง: การ์ด 6 ใบเต็มรูปแบบสูงเกินจอ "ใช้งานยากมาก"
                  จอแคบ = 4 ใบแรก + คำอธิบายซ่อน (เหลือแค่หัวข้อ) · จอกว้าง = ครบ 6 ใบ 2 คอลัมน์
                  4 ใบแรกคืองานที่ใช้บ่อยที่สุด — ที่เหลือพิมพ์สั่งได้อยู่แล้ว */}
              <div className="mt-5 grid gap-2 sm:mt-6 sm:gap-2.5 sm:grid-cols-2">
                {STARTERS.map((s, i) => (
                  <button key={s.title} onClick={() => send(s.prompt)}
                    className={cn(
                      "flex min-h-[52px] items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 sm:items-start sm:px-4 sm:py-3",
                      i >= 4 && "hidden sm:flex",
                    )}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 sm:mt-0.5">
                      <s.icon className="h-4 w-4 text-emerald-700" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold leading-snug text-neutral-800">{s.title}</span>
                      <span className="mt-0.5 hidden text-[12px] leading-relaxed text-neutral-500 sm:block">{s.desc}</span>
                    </span>
                  </button>
                ))}
              </div>

              <p className="mx-auto mt-4 hidden max-w-md items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-neutral-400 sm:flex">
                <Paperclip className="mt-[1px] h-3 w-3 shrink-0" />
                แนบรูปบิลได้ทีละหลายใบ พิมพ์กำกับได้ เช่น &ldquo;ค่าเช่า ยังไม่จ่าย&rdquo; · ตัวเลขไม่ชัดระบบจะถามก่อนบันทึกเสมอ
              </p>
            </div>
          </div>
        )}

        {msgs.length > 0 && (
          <div className="flex justify-end">
            <button onClick={clearChat} className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600">
              <Trash2 className="h-3 w-3" /> ล้างแชท
            </button>
          </div>
        )}

        {msgs.map((m, i) => (
          // data-last-msg = จุดอ้างอิงให้ตัวเลื่อนจอวัดว่าคำตอบล่าสุดสูงเกินจอไหม
          // ⚠️ คำตอบของผู้ช่วยไม่ใส่กรอบฟอง (8 ส.ค. 2569)
          // เดิมเป็นฟองเทาทั้งก้อน ซึ่งพอคำตอบยาว (สรุปภาษี/ไล่รายการค่าใช้จ่าย)
          // จะกลายเป็นบล็อกเทาก้อนใหญ่กลางจอ อ่านยากและดูเป็นของเล่น
          // แชทที่คนใช้ทำงานจริงให้คำตอบเป็น "ข้อความบนหน้า" มีเส้นบาง ๆ คั่น
          // ส่วนคำพูดของผู้ใช้ยังเป็นฟอง เพราะต้องแยกให้ออกว่าใครพูด และมันสั้นเสมอ
          <div key={i} data-last-msg={i === msgs.length - 1 ? "" : undefined}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "text-sm",
              m.role === "user"
                ? "max-w-[85%] cursor-pointer rounded-2xl rounded-br-md bg-neutral-900 px-3.5 py-2 text-white active:opacity-80"
                : "w-full border-l-2 border-emerald-100 pl-3.5 text-neutral-800 sm:pl-4",
            )}
              // ใช้คำสั่งเดิมซ้ำ (ผลตรวจ 28 ส.ค. 2569: "คนที่สั่งผิดหรืออยากทำซ้ำ
              // ควรกดใช้ซ้ำได้ทันที") — แตะฟองของตัวเองแล้วข้อความกลับลงช่องพิมพ์
              // ให้แก้ก่อนส่ง ไม่ยิงซ้ำทันทีเพราะคำสั่งเขียนเงินซ้ำสองรอบอันตรายกว่า
              onClick={m.role === "user" && (m.display ?? m.content) ? () => setInput(m.display ?? m.content ?? "") : undefined}
              title={m.role === "user" ? "แตะเพื่อนำคำสั่งนี้กลับไปแก้และส่งใหม่" : undefined}>
              {/* รูปบิลที่แนบ — โชว์เป็นรูปจริง ไม่ใช่ path */}
              {m.images && m.images.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {m.images.map((src, j) => (
                    // onError: blob url ที่ตายแล้ว (ปิดแท็บ/รีเฟรช) จะโชว์ไอคอนรูปแตก
                    // ซึ่งดูเหมือนระบบพัง — ซ่อนตัวเองไปเลยดีกว่า ชื่อไฟล์ยังอยู่ให้อ่าน
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={j} src={src} alt={`บิล ${j + 1}`} loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                      className="h-20 w-20 rounded-lg border border-white/20 bg-white/10 object-cover" />
                  ))}
                </div>
              )}
              {!m.images?.length && m.fileNames && m.fileNames.length > 0 && (
                <p className="mb-1 flex items-center gap-1 text-xs opacity-70">
                  <Paperclip className="h-3 w-3" /> {m.fileNames.join(", ")}
                </p>
              )}
              <p className={cn("whitespace-pre-wrap break-words", m.role === "assistant" && "leading-relaxed")}>
                {m.display ?? (m.role === "user" && m.content.startsWith("[ไฟล์แนบ") ? m.content.split("\n")[0] : m.content)}
              </p>
              {m.artifacts && m.artifacts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {/* ⚠️ ปุ่ม "ดูใบจริง" มาก่อนปุ่มที่พาออกจากแชทเสมอ
                      เพราะสิ่งที่ผู้ใช้อยากรู้ทันทีหลังสั่งคือ "ที่บอกว่าทำให้แล้ว หน้าตาถูกไหม"
                      ถ้าให้กดออกไปอีกหน้าก่อน เขาจะเสียบริบทที่กำลังคุยอยู่ */}
                  {m.artifacts.map((a, j) => {
                    const id = a.label.startsWith("เปิด ") ? (a.href.match(/[0-9a-f-]{36}/i)?.[0] ?? null) : null;
                    if (!id) return null;
                    return (
                      <button key={`p${j}`} type="button" disabled={previewBusy === a.href}
                        onClick={async () => {
                          setPreviewBusy(a.href);
                          const r = await getDocPreview(shopId, id);
                          setPreviewBusy(null);
                          if (r.ok) setPreview(r.data); else setError(r.error);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                        {previewBusy === a.href
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> กำลังเปิด</>
                          : <><FileText className="h-3 w-3" /> ดูใบจริง</>}
                      </button>
                    );
                  })}
                  {m.artifacts.map((a, j) => (
                    <a key={j} href={a.href} target={a.href.startsWith("/doc/") || a.href.includes("/print/") ? "_blank" : undefined}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                      {a.label} →
                    </a>
                  ))}
                </div>
              )}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <p className="mt-1 text-xs text-neutral-400">{m.toolCalls.map((t) => t.label).join(" · ")}</p>
              )}
              {/* ปุ่มตอบ AI — โชว์เฉพาะข้อความล่าสุด กันกดย้อนอดีตแล้วสับสน */}
              {m.choices && m.choices.length > 0 && i === msgs.length - 1 && !busy && !reading && (
                <div className="mt-2.5 flex flex-col gap-1.5 sm:max-w-md">
                  {m.choices.map((c, j) => (
                    <button key={j} type="button" onClick={() => send(c.reply)}
                      className="group flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-neutral-700 transition-all hover:border-emerald-500/50 hover:bg-emerald-50/60 hover:text-emerald-900 active:scale-[0.99]">
                      <span className="min-w-0">
                        {c.label}
                        {c.hint && <span className="block text-xs font-normal text-neutral-400 group-hover:text-emerald-700">{c.hint}</span>}
                      </span>
                      <span className="shrink-0 text-neutral-300 transition-colors group-hover:text-emerald-500">›</span>
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
            <Loader2 className="h-3 w-3 animate-spin" /> {stepLabel ? `${stepLabel}...` : "ผู้ช่วยบัญชีกำลังจัดการให้..."}
          </p>
        )}
        {/* ล้มแล้วต้องมีปุ่มไปต่อในที่เดียวกัน — ข้อความว่า "ลองใหม่" เฉย ๆ โดยไม่มีปุ่ม
            แปลว่าบังคับให้ผู้ใช้พิมพ์คำสั่งยาว ๆ ใหม่เอง ซึ่งคือจังหวะที่คนปิดแอปจริง */}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-3.5 py-2.5">
            <p className="min-w-0 flex-1 text-sm text-red-600">{error}</p>
            {retryRef.current && (
              <button type="button"
                onClick={() => { const h = retryRef.current; retryRef.current = null; setError(null); if (h) void askAi(h); }}
                className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500">
                ส่งอีกครั้ง
              </button>
            )}
          </div>
        )}
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
              <p className="text-xs font-semibold text-emerald-800">แนบไว้ {pendingFiles.length} ใบ — พิมพ์สั่งกำกับได้ เช่น &ldquo;ทั้งหมดยังไม่จ่าย&rdquo;</p>
              {/* ปุ่มจริง — ลบไฟล์ที่แนบไว้ทั้งหมดเป็นงานที่ย้อนไม่ได้ ต้องเห็นชัดว่าเป็นปุ่ม */}
              <button type="button" onClick={() => setPendingFiles([])}
                className={cn(ACTION_CHIP, "shrink-0 border-emerald-300 text-emerald-700 hover:text-emerald-800")}>
                <Trash2 className="h-3.5 w-3.5" />เอาออกทั้งหมด
              </button>
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
        <form
          className={`flex gap-2 rounded-2xl transition-colors ${dragOver ? "ring-2 ring-emerald-500 ring-offset-2" : ""}`}
          onSubmit={submitForm}
          onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const fs = [...(e.dataTransfer?.files ?? [])];
            if (fs.length) addFiles(fs, "drop");
          }}
        >
          <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
            onChange={(e) => { addFiles([...(e.target.files ?? [])], "pick"); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || !!reading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40"
            title="แนบรูปบิล/เอกสาร เลือกได้หลายใบพร้อมกัน">
            <Paperclip className="h-4 w-4" />
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            // ⚠️ ต้องอ่านจาก clipboardData.items ไม่ใช่ .files เท่านั้น
            // รูปที่ "ก๊อปมาจากหน้าจอ/เว็บ" มาในรูป item ชนิด file ซึ่ง .files บางเบราว์เซอร์ให้ว่าง
            // ถ้าอ่านผิดทาง ผู้ใช้จะกด Ctrl+V แล้วไม่เกิดอะไรขึ้นเลยโดยไม่มีข้อความบอก
            onPaste={(e) => {
              const items = [...(e.clipboardData?.items ?? [])];
              const files = items.filter((it) => it.kind === "file").map((it) => it.getAsFile()).filter((f): f is File => !!f);
              const fromList = [...(e.clipboardData?.files ?? [])];
              const all = files.length ? files : fromList;
              if (all.length) { e.preventDefault(); addFiles(all, "paste"); }
            }}
            placeholder={listening ? "กำลังฟัง... พูดสั่งงานได้เลย" : pendingFiles.length ? "สั่งกำกับบิล (ไม่พิมพ์ก็ได้) เช่น ค่าเช่า ยังไม่จ่าย" : "สั่งงานบัญชี หรือวางรูปบิลด้วย Ctrl+V ได้เลย"}
            // ⚠️ min-w-0 จำเป็น (แก้ 5 ก.ย. 2569 — ภาพจริงบนมือถือ 390px: ปุ่ม "ส่งข้อความ" ถูกดัน
            // หลุดขอบจอขวาไปครึ่งปุ่ม) input มี min-width ตามค่าเริ่มต้นของเบราว์เซอร์ราว 150-180px
            // flex-1 จึงหดไม่ลงเมื่อมีปุ่มแนบ+ไมค์+ส่งอยู่ในแถวเดียว ต้องบอกให้หดได้ถึงศูนย์
            className="h-11 w-0 min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-emerald-500 sm:text-sm" />
          {voiceSupported && (
            <button type="button" onClick={() => { setError(null); toggleVoice(input); }} disabled={busy || !!reading}
              aria-label={listening ? "หยุดฟัง" : "พูดสั่งงาน"} aria-pressed={listening}
              title={listening ? "หยุดฟัง" : "พูดสั่งงาน — พูดจบแล้วหยุดเอง ตรวจข้อความก่อนกดส่งเหมือนพิมพ์เอง"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border disabled:opacity-40",
                listening
                  ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
                  : "border-neutral-300 text-neutral-500 hover:border-emerald-400 hover:text-emerald-600",
              )}>
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          {/* ปุ่มไอคอนล้วนต้องมีชื่อเสมอ — ปุ่มส่งของหน้าแชทเคยไม่มี aria-label
              โปรแกรมอ่านหน้าจอจึงอ่านได้แค่คำว่า "ปุ่ม" (พบจากการกวาดทั้งระบบ 5 ก.ย. 2569) */}
          <button aria-label="ส่งข้อความ" title="ส่งข้อความ"
            disabled={busy || !!reading || (!input.trim() && !pendingFiles.length)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40">
            {busy || reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        {listening && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            กำลังฟัง — พูดจบแล้วหยุดเอง ตรวจข้อความแล้วค่อยกดส่ง
          </p>
        )}
        {/* คำเตือนตามผลตรวจ 28 ส.ค. 2569 — ความเชื่อใจมาจากความตรง ไม่ใช่จากการอวดว่าไม่พลาด */}
        <p className="mt-1.5 text-center text-[11px] leading-snug text-neutral-400">
          AI อาจอ่านบิลหรือสรุปผิดได้ — ตรวจตัวเลขก่อนใช้ยื่นภาษีเสมอ · แตะข้อความเดิมของคุณเพื่อสั่งซ้ำ
        </p>
      </div>

      {/* ใบเอกสารจริงคาแชท — อ่านอย่างเดียว (แก้ตัวเลขบนใบที่ออกไปแล้วไม่ได้ตามกฎหมาย
          ต้องยกเลิกแล้วออกใหม่ หรือออกใบลดหนี้ ซึ่งสั่งจากแชทได้อยู่แล้ว)
          จอแคบ = หน้าต่างทับจอ · จอกว้าง = แผงค้างข้างขวา (ดูด้านล่าง) */}
      {preview && (
        <div className="lg:hidden">
          <DocPreview
            docType={preview.docType as DocType}
            seller={preview.seller}
            buyer={preview.buyer}
            rows={preview.rows}
            totals={preview.totals}
            issueDate={preview.issueDate}
            dueDate={preview.dueDate}
            vatMode={preview.vatMode as VatMode}
            whtRate={preview.whtRate}
            notes={preview.notes}
            onClose={() => setPreview(null)}
          />
        </div>
      )}
      </div>

      {/* แผงตัวอย่างเอกสารค้างข้างขวา — เห็นใบจริงพร้อมกับที่ยังคุยกับ AI ต่อได้
          ไม่ต้องปิดหน้าต่างก่อนถึงจะพิมพ์สั่งแก้ได้ ซึ่งเป็นจังหวะที่คนเลิกกลางคันบ่อยที่สุด */}
      {preview && (
        <aside className="hidden w-[26rem] shrink-0 overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-3 lg:block">
          <DocPreview
            docType={preview.docType as DocType}
            seller={preview.seller}
            buyer={preview.buyer}
            rows={preview.rows}
            totals={preview.totals}
            issueDate={preview.issueDate}
            dueDate={preview.dueDate}
            vatMode={preview.vatMode as VatMode}
            whtRate={preview.whtRate}
            notes={preview.notes}
            onClose={() => setPreview(null)}
            variant="panel"
          />
        </aside>
      )}
    </div>
  );
}
