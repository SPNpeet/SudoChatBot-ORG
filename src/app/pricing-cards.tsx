"use client";
// ============================================================
//  การ์ดราคาที่ "เลือกได้จริง"
//
//  ปัญหาที่ผู้ใช้แจ้ง: กดที่กรอบราคาแล้วไม่มีอะไรเข้มขึ้นให้เห็น
//  รอบก่อนผมใส่แค่ active: ซึ่งแสดงผลเฉพาะตอนกดค้าง ปล่อยนิ้วปุ๊บหายปั๊บ
//  บนมือถือยิ่งไม่ทันเห็นเลย — แก้ไม่ตรงจุด
//
//  ของจริงที่ต้องการคือ "สถานะถูกเลือก" ที่ค้างอยู่จนกว่าจะไปเลือกใบอื่น
//  จึงต้องมี state ไม่ใช่แค่ CSS pseudo-class
//
//  ออกแบบให้ทุกวัยใช้เป็น: กดที่การ์ด = เลือกดู (ยังไม่ผูกมัด ไม่พาไปไหน)
//  แล้วปุ่มในการ์ดที่เลือกจะเปลี่ยนเป็นปุ่มหลักสีเข้ม ให้กดต่อเมื่อพร้อม
//  คนที่ไม่อยากเลือกก็กดปุ่มในการ์ดไหนก็ได้ตรง ๆ เหมือนเดิม
// ============================================================
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export interface Plan {
  name: string; price: string; per: string;
  items: string[]; cta: string; hot: boolean;
}

export default function PricingCards({ plans }: { plans: Plan[] }) {
  // ตั้งต้นที่แพ็กยอดนิยม เพื่อให้เห็นตั้งแต่แรกว่าการ์ด "เลือกได้"
  const [picked, setPicked] = useState(plans.find((p) => p.hot)?.name ?? plans[0]?.name ?? "");

  return (
    <div role="radiogroup" aria-label="เลือกแพ็กเกจ" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((p, i) => {
        const on = picked === p.name;
        return (
          <div
            key={p.name}
            role="radio"
            aria-checked={on}
            aria-label={`แพ็กเกจ ${p.name} ${p.price} ${p.per}`}
            tabIndex={on || (!picked && i === 0) ? 0 : -1}
            onClick={() => setPicked(p.name)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(p.name); return; }
              if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
                e.preventDefault();
                const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                const next = plans[(i + step + plans.length) % plans.length];
                setPicked(next.name);
                (e.currentTarget.parentElement?.children[plans.indexOf(next)] as HTMLElement | undefined)?.focus();
              }
            }}
            className={[
              "relative flex cursor-pointer flex-col rounded-2xl border p-6 transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6B4A] focus-visible:ring-offset-2",
              on
                // สถานะถูกเลือก — เข้มขึ้นจริงและค้างอยู่ ทั้งขอบ พื้น เงา และยกใบขึ้น
                ? "-translate-y-0.5 border-[#0B6B4A] bg-[#0B6B4A]/[.06] shadow-[0_0_0_3px_rgba(11,107,74,.14),0_12px_28px_-16px_rgba(11,107,74,.5)]"
                : "border-neutral-200 bg-white hover:border-[#0B6B4A]/40 hover:shadow-md",
            ].join(" ")}
          >
            {p.hot && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0B6B4A] px-3 py-0.5 text-[11px] font-medium text-white">
                ยอดนิยม
              </span>
            )}

            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{p.name}</p>
              {/* จุดวงกลมบอกสถานะเลือก — สัญญาณที่คนทุกวัยอ่านออกทันทีว่านี่คือตัวเลือก */}
              <span aria-hidden className={[
                "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                on ? "border-[#0B6B4A] bg-[#0B6B4A]" : "border-neutral-300 bg-white",
              ].join(" ")}>
                {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
            </div>

            <p className="mt-2 text-3xl font-bold tracking-tight">
              {p.price}<span className="ml-1 text-sm font-normal text-neutral-400">{p.per}</span>
            </p>

            <ul className="mt-4 flex-1 space-y-2">
              {p.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-neutral-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0B6B4A]" /> {it}
                </li>
              ))}
            </ul>

            {/* ปุ่มของการ์ดที่เลือกจะเป็นปุ่มหลัก — ชี้ชัดว่าจะกดอะไรต่อ */}
            <Link
              href="/signup"
              onClick={(e) => e.stopPropagation()}
              className={[
                "mt-5 block rounded-xl py-2.5 text-center text-sm font-semibold transition-colors",
                on
                  ? "bg-[#0B6B4A] text-white hover:brightness-110"
                  : "border border-neutral-300 text-neutral-700 hover:border-[#0B6B4A] hover:text-[#0B6B4A]",
              ].join(" ")}
            >
              {on ? `เริ่มใช้ ${p.name}` : p.cta}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
