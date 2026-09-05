// ============================================================
//  ปุ่มสลับภาษา ไทย / EN
//
//  ⚠️ เป็น Server Component + <form> โดยตั้งใจ ห้ามเปลี่ยนกลับไปเขียน cookie ฝั่ง client
//  ของเดิมใช้ document.cookie + router.refresh() แล้ว **กดไม่เปลี่ยนภาษา**
//  เพราะ Router Cache ฝั่ง client คืนหน้าเดิมมาให้ (เจ้าของแจ้ง 19 ส.ค. 2569)
//
//  ⚠️ กติกาข้อ 9: ต้องเป็นปุ่มจริงเป้ากด 44px และเห็นชัดว่าตอนนี้อยู่ภาษาอะไร
//  ไม่ใช่ปุ่มที่เขียนชื่ออีกภาษาแล้วให้ผู้ใช้เดาว่ากดแล้วจะได้อะไร
// ============================================================
import { setLang } from "@/app/lang-action";
import { Languages } from "lucide-react";

export default function LangToggle({ lang }: { lang: "th" | "en" }) {
  return (
    <form action={setLang}
      className="inline-flex min-h-[44px] items-center gap-0.5 rounded-xl border border-neutral-200 p-0.5"
      aria-label="เลือกภาษา / Choose language">
      <Languages className="ml-1.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
      {(["th", "en"] as const).map((l) => (
        <button key={l} type="submit" name="lang" value={l}
          aria-current={lang === l ? "true" : undefined}
          className={`min-h-10 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
            lang === l ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          }`}>
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </form>
  );
}
