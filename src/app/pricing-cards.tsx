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
//
//  ⚠️ แพ็กฟรีแยกออกมาเป็นแถบ ไม่ใช่การ์ดใบที่ 5 (แก้ 6 ส.ค. 2569)
//  เหตุผล: แพ็กที่เปิดขายมี 5 แพ็ก แต่กริดกว้าง 4 คอลัมน์ ใส่ 5 ใบแล้วเหลือใบเดี่ยว
//  ขึ้นบรรทัดใหม่ ดูเหมือนหน้าเว็บพัง · และแพ็กฟรีไม่ได้อยู่ในสเกลเดียวกับแพ็กจ่ายเงิน
//  (ไม่มีรายปี ไม่ใช่ตัวเลือกที่เอามาเทียบราคากัน) มันคือ "ทางเข้า" ไม่ใช่ "ตัวเลือก"
// ============================================================
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export interface Plan {
  code: string; name: string; price: string;
  items: string[]; hot: boolean; free: boolean;
  /** ราคารายปี (จ่าย 10 เดือน ใช้ 12 เดือน) — แพ็กฟรีไม่มี */
  yearly?: string;
}

export default function PricingCards({ plans }: { plans: Plan[] }) {
  const paid = plans.filter((p) => !p.free);
  const free = plans.find((p) => p.free);
  // ตั้งต้นที่แพ็กยอดนิยม เพื่อให้เห็นตั้งแต่แรกว่าการ์ด "เลือกได้"
  const [picked, setPicked] = useState(paid.find((p) => p.hot)?.code ?? paid[0]?.code ?? "");

  return (
    <>
      {/* ---- แพ็กฟรี: แถบทางเข้า ไม่ใช่ตัวเลือกที่เอามาเทียบราคา ---- */}
      {free && (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {free.name} <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-500 ring-1 ring-neutral-200">ฟรี ไม่ต้องใช้บัตร</span>
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{free.items.join(" · ")}</p>
          </div>
          <Link href="/signup"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-800 hover:border-[#0B6B4A] hover:text-[#0B6B4A]">
            เริ่มใช้ฟรี
          </Link>
        </div>
      )}

      <div role="radiogroup" aria-label="เลือกแพ็กเกจ" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {paid.map((p, i) => {
          const on = picked === p.code;
          return (
            <div
              key={p.code}
              role="radio"
              aria-checked={on}
              aria-label={`แพ็กเกจ ${p.name} ${p.price} บาทต่อเดือน`}
              tabIndex={on || (!picked && i === 0) ? 0 : -1}
              onClick={() => setPicked(p.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(p.code); return; }
                if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
                  e.preventDefault();
                  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                  const next = paid[(i + step + paid.length) % paid.length];
                  setPicked(next.code);
                  (e.currentTarget.parentElement?.children[paid.indexOf(next)] as HTMLElement | undefined)?.focus();
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

              {/* ราคา: ตัวเลขเด่น หน่วยเป็นบรรทัดของตัวเอง
                  เดิมเอา "บาท/เดือน" ไปห้อยท้ายตัวเลข 30px ด้วยช่องว่าง 4px
                  อ่านออกมาติดกันเป็น "99บาท/เดือน" และแย่งสายตากับตัวเลข */}
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{p.price}</span>
                <span className="text-sm font-medium text-neutral-500">บาท</span>
              </p>
              <p className="mt-1 text-xs text-neutral-400">ต่อเดือน · ยกเลิกได้ตลอด</p>
              {p.yearly && (
                <p className="mt-2 rounded-lg bg-[#0B6B4A]/[.07] px-2.5 py-1.5 text-[12px] leading-snug text-neutral-600">
                  รายปี <span className="font-semibold text-[#0B6B4A] tabular-nums">{p.yearly}</span> บาท
                  <span className="text-neutral-400"> — จ่าย 10 เดือน ใช้ 12 เดือน</span>
                </p>
              )}

              <ul className="mt-4 flex-1 space-y-2">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[13px] leading-relaxed text-neutral-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0B6B4A]" /> {it}
                  </li>
                ))}
              </ul>

              {/* ปุ่มของการ์ดที่เลือกจะเป็นปุ่มหลัก — ชี้ชัดว่าจะกดอะไรต่อ */}
              <Link
                href="/signup"
                onClick={(e) => e.stopPropagation()}
                className={[
                  "mt-5 flex min-h-[44px] items-center justify-center rounded-xl text-center text-sm font-semibold transition-colors",
                  on
                    ? "bg-[#0B6B4A] text-white hover:brightness-110"
                    : "border border-neutral-300 text-neutral-700 hover:border-[#0B6B4A] hover:text-[#0B6B4A]",
                ].join(" ")}
              >
                {on ? `เริ่มใช้ ${p.name}` : "เลือกแพ็กนี้"}
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
