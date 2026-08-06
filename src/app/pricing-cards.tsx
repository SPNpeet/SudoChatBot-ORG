"use client";
// ============================================================
//  การ์ดราคา
//
//  ⚠️ กติกาการแสดง "ราคา" ที่ห้ามเปลี่ยนกลับ (6 ส.ค. 2569)
//  ตอนเลือกงวดรายปี ให้โชว์ "ราคาต่อเดือนหลังลดแล้ว" เป็นตัวเลขใหญ่
//  ส่วนยอดที่เรียกเก็บจริงทั้งปีเป็นบรรทัดรองด้านล่าง
//  เหตุผล: คนเทียบราคากันที่ "เดือนละเท่าไหร่" เสมอ เอายอดเต็มทั้งปี (990/1,990)
//  ขึ้นตัวใหญ่ทำให้ดูแพงกว่าความจริง ทั้งที่มันคือราคาที่ถูกลง — ขายของแล้วโชว์ตัวเลข
//  ที่ทำให้ตัวเองดูแพงขึ้นคือการทำร้ายตัวเอง
//
//  ⚠️ ความหนาตัวอักษรห้ามเกิน 700 ทั้งไฟล์
//  IBM Plex Sans Thai มีน้ำหนักถึง 700 เท่านั้น ใส่ font-extrabold (800) แล้ว
//  เบราว์เซอร์จะ "ปลอมตัวหนา" ให้ ซึ่งขอบตัวอักษรจะเยินและดูถูกทันที
//  (วัดเจอบนหน้าแรกจริง: h1 ขอ 800 ทั้งที่โหลดมาแค่ 400/500/600/700)
//
//  ⚠️ ขนาดตัวอักษรใช้เฉพาะในสเกลนี้: 12 · 13 · 14 · 16 · 24 · 40
//  เดิมทั้งหน้ามี 9 ขนาด (มี 10px และ 11px ปนด้วย) ซึ่งเป็นสาเหตุที่อ่านแล้วรู้สึก "มั่ว"
//  ขนาดที่ไม่ได้อยู่ในสเกลไม่ได้ทำให้ข้อมูลชัดขึ้น แค่ทำให้หน้าดูไม่ได้ตั้งใจ
// ============================================================
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export interface Plan {
  code: string; name: string; price: string;
  items: string[]; hot: boolean; free: boolean;
  yearly?: string;
}

const BRAND = "#0B6B4A";
const num = (n: number) => n.toLocaleString("th-TH");
const toNum = (s: string) => Number(String(s).replace(/,/g, "")) || 0;

export default function PricingCards({ plans }: { plans: Plan[] }) {
  const paid = plans.filter((p) => !p.free);
  const free = plans.find((p) => p.free);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const [picked, setPicked] = useState(paid.find((p) => p.hot)?.code ?? paid[0]?.code ?? "");

  return (
    <>
      {/* ---- สวิตช์งวดชำระ — ค่าเริ่มต้นคือรายปี เพราะเป็นราคาที่ดีที่สุดของเรา ---- */}
      <div className="mt-8 flex justify-center">
        <div role="radiogroup" aria-label="งวดชำระ"
          className="inline-flex items-center gap-1 rounded-2xl border border-neutral-200 bg-white p-1">
          {([["monthly", "รายเดือน"], ["yearly", "รายปี"]] as const).map(([v, label]) => {
            const on = period === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setPeriod(v)}
                className={[
                  "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors",
                  on ? "text-white" : "text-neutral-500 hover:text-neutral-900",
                ].join(" ")}
                style={on ? { backgroundColor: BRAND } : undefined}>
                {label}
                {v === "yearly" && (
                  <span className={["rounded-full px-2 py-0.5 text-xs font-semibold", on ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"].join(" ")}>
                    ประหยัด 2 เดือน
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div role="radiogroup" aria-label="เลือกแพ็กเกจ" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {paid.map((p, i) => {
          const on = picked === p.code;
          const monthly = toNum(p.price);
          const yearTotal = toNum(p.yearly ?? "0");
          // ราคาต่อเดือนหลังลด — สูตรเดียวกับที่เก็บเงินจริง (จ่าย 10 เดือน ใช้ 12 เดือน)
          const perMonth = yearTotal ? Math.round(yearTotal / 12) : monthly;
          const show = period === "yearly" ? perMonth : monthly;
          const save = yearTotal ? monthly * 12 - yearTotal : 0;

          return (
            <div
              key={p.code}
              role="radio"
              aria-checked={on}
              aria-label={`แพ็กเกจ ${p.name} ${num(show)} บาทต่อเดือน${period === "yearly" ? " เมื่อชำระรายปี" : ""}`}
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
                "relative flex cursor-pointer flex-col rounded-2xl border bg-white p-5 transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                on ? "-translate-y-0.5 shadow-[0_12px_32px_-18px_rgba(11,107,74,.55)]"
                   : "border-neutral-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md",
              ].join(" ")}
              style={on ? { borderColor: BRAND, boxShadow: `0 0 0 3px rgba(11,107,74,.12), 0 12px 32px -18px rgba(11,107,74,.55)` } : undefined}
            >
              {p.hot && (
                <span className="absolute -top-2.5 left-5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: BRAND }}>
                  ยอดนิยม
                </span>
              )}

              <div className="flex items-start justify-between gap-2 pt-1">
                <p className="text-base font-semibold text-neutral-900">{p.name}</p>
                <span aria-hidden className={[
                  "mt-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                  on ? "" : "border-neutral-300 bg-white",
                ].join(" ")}
                  style={on ? { borderColor: BRAND, backgroundColor: BRAND } : undefined}>
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </div>

              {/* ---- บล็อกราคา ---- */}
              <div className="mt-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{num(show)}</span>
                  <span className="text-sm font-medium text-neutral-500">บาท</span>
                </div>
                <p className="mt-1.5 text-xs text-neutral-400">ต่อเดือน{period === "yearly" ? " · เมื่อชำระรายปี" : ""}</p>
              </div>

              {/* บรรทัดรอง: ยอดที่เรียกเก็บจริง + ส่วนที่ประหยัด (โชว์เฉพาะตอนรายปี) */}
              <div className="mt-3 min-h-[42px]">
                {period === "yearly" && yearTotal > 0 ? (
                  <div className="rounded-xl bg-emerald-50/70 px-3 py-2">
                    <p className="text-xs leading-relaxed text-neutral-600">
                      เรียกเก็บปีละครั้ง <span className="font-semibold tabular-nums text-neutral-900">{num(yearTotal)}</span> บาท
                      <span className="ml-1 font-semibold" style={{ color: BRAND }}>ประหยัด {num(save)} บาท</span>
                    </p>
                  </div>
                ) : (
                  <p className="px-3 text-xs leading-relaxed text-neutral-400">จ่ายเดือนต่อเดือน ยกเลิกได้ทุกเมื่อ</p>
                )}
              </div>

              <ul className="mt-4 flex-1 space-y-2 border-t border-neutral-100 pt-4">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[13px] leading-relaxed text-neutral-600">
                    <Check className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} /> {it}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                onClick={(e) => e.stopPropagation()}
                className={[
                  "mt-5 flex min-h-[44px] items-center justify-center rounded-xl text-sm font-semibold transition-colors",
                  on ? "text-white" : "border border-neutral-300 text-neutral-800 hover:border-neutral-400",
                ].join(" ")}
                style={on ? { backgroundColor: BRAND } : undefined}
              >
                {on ? `เริ่มใช้ ${p.name}` : "เลือกแพ็กนี้"}
              </Link>
            </div>
          );
        })}
      </div>

      {/* ---- แพ็กฟรี: ทางเข้า ไม่ใช่ตัวเลือกที่เอามาเทียบราคา ---- */}
      {free && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
              {free.name}
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">ฟรี ไม่ต้องใช้บัตร</span>
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{free.items.join(" · ")}</p>
          </div>
          <Link href="/signup"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-800 hover:border-neutral-400">
            เริ่มใช้ฟรี
          </Link>
        </div>
      )}
    </>
  );
}
