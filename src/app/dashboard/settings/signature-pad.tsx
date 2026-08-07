"use client";
// ============================================================
//  ลายเซ็นอิเล็กทรอนิกส์ — วาดด้วยนิ้วบนมือถือ หรือเมาส์บนคอม
//
//  ทำไมทำ: เจ้าของเทียบกับระบบคู่แข่งแล้วเห็นว่าเขามีช่องเซ็นบนจอ
//  ของเราเอกสารพิมพ์ออกมามีแต่เส้นประให้เซ็นด้วยปากกา ซึ่งแปลว่า
//  ทุกครั้งที่ส่งไฟล์ PDF ให้ลูกค้า ต้องปริ้น -> เซ็น -> สแกน -> ส่ง
//  มีลายเซ็นเก็บไว้ = ส่ง PDF ที่เซ็นแล้วได้ทันที
//
//  ⚠️ เก็บเป็นรูป PNG ใน bucket shop-assets (public) ไม่ได้เก็บใน localStorage
//  เพราะเปลี่ยนเครื่อง/ล้าง cache แล้วต้องยังอยู่ — จุดที่คู่แข่งทำไม่ได้
//
//  ⚠️ ลายเซ็นนี้ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์ตามกฎหมายที่ผูกพันสัญญา
//  เป็นภาพลายเซ็นบนเอกสารเท่านั้น — เขียนกำกับไว้บนหน้าจอด้วย ห้ามเอาออก
// ============================================================
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { saveSignature, clearSignature } from "../actions";

const W = 600, H = 200;   // ขนาดจริงของภาพที่เก็บ (คงที่ ไม่ขึ้นกับขนาดจอ)

export default function SignaturePad({ shopId, current }: { shopId: string; current: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  /** พิกัดในระบบของ canvas — ต้องหารด้วยอัตราส่วนที่ CSS ย่อ/ขยายไว้
   *  ไม่งั้นเส้นจะไปโผล่คนละที่กับนิ้วบนจอที่ความกว้างไม่เท่า 600px */
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    // จับ pointer ไว้ — ลากนิ้วออกนอกกรอบแล้วกลับเข้ามา เส้นต้องไม่ขาด
    ref.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!dirty.current) { dirty.current = true; setHasInk(true); }
  }

  function up() { drawing.current = false; }

  function wipe() {
    const c = ref.current;
    c?.getContext("2d")?.clearRect(0, 0, W, H);
    dirty.current = false;
    setHasInk(false);
  }

  function save() {
    const c = ref.current;
    if (!c || !dirty.current) return;
    // PNG พื้นหลังโปร่งใส — วางทับเส้นในเอกสารได้พอดี ไม่มีกล่องขาวบัง
    const dataUrl = c.toDataURL("image/png");
    start(async () => {
      const r = await saveSignature(shopId, dataUrl);
      if (!r.ok) { toast({ text: r.error, tone: "error" }); return; }
      toast({ text: "บันทึกลายเซ็นแล้ว — จะขึ้นบนเอกสารที่พิมพ์ทุกใบ", tone: "success" });
      wipe();
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const r = await clearSignature(shopId);
      if (!r.ok) { toast({ text: r.error, tone: "error" }); return; }
      toast({ text: "ลบลายเซ็นแล้ว — เอกสารจะกลับไปเป็นเส้นให้เซ็นด้วยปากกา", tone: "success" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {current && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-xs font-medium text-neutral-500">ลายเซ็นที่ใช้อยู่</p>
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt="ลายเซ็นปัจจุบัน" className="h-16 max-w-full bg-white object-contain" />
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={remove}>
              <Trash2 className="h-4 w-4" /> ลบลายเซ็น
            </Button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-neutral-600">
          {current ? "วาดใหม่เพื่อเปลี่ยน" : "วาดลายเซ็นด้วยนิ้วหรือเมาส์"}
        </p>
        <canvas
          ref={ref} width={W} height={H}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          // touch-none = กันจอเลื่อนตามนิ้วตอนวาดบนมือถือ ซึ่งทำให้เซ็นไม่ได้เลย
          className="w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed border-neutral-300 bg-white"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" disabled={!hasInk || pending} onClick={save}>
            <Check className="h-4 w-4" /> {pending ? "กำลังบันทึก..." : "บันทึกลายเซ็น"}
          </Button>
          <Button type="button" variant="outline" disabled={!hasInk || pending} onClick={wipe}>
            <PenLine className="h-4 w-4" /> วาดใหม่
          </Button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-neutral-400">
        ลายเซ็นนี้เป็น<b>ภาพประกอบบนเอกสาร</b>เพื่อความสะดวก ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์
        ที่ใช้ผูกพันตามกฎหมายธุรกรรมทางอิเล็กทรอนิกส์ · เก็บบนคลาวด์ เปลี่ยนเครื่องก็ยังอยู่
      </p>
    </div>
  );
}
