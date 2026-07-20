"use client";
// การ์ดตั้งค่า "บอทตอบคอมเมนต์ → ทัก inbox" + กล่องทดลองพรีวิว DM จริง
import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { MessageCircleReply, Sparkles } from "lucide-react";
import { saveCommentSettings, previewCommentReply, type CommentPreview } from "./comment-actions";

export default function CommentSettingsForm({ shopId, enabled, publicReply, keywords }: {
  shopId: string; enabled: boolean; publicReply: string | null; keywords: string[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testText, setTestText] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [preview, setPreview] = useState<CommentPreview | null>(null);

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await saveCommentSettings(shopId, fd);
      setResult(r.ok ? { ok: true, msg: "บันทึกแล้ว" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(() => setResult(null), 3000);
    });
  }

  async function runTest() {
    if (!testText.trim() || testBusy) return;
    setTestBusy(true);
    setPreview(null);
    try {
      setPreview(await previewCommentReply(shopId, testText));
    } catch {
      setPreview({ ok: false, error: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={submit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="comment_reply_enabled" defaultChecked={enabled} className="h-4 w-4 accent-emerald-600" />
          เปิดให้บอทตอบคอมเมนต์ + ทัก inbox อัตโนมัติ (Facebook / Instagram)
        </label>
        <p className="text-xs text-neutral-400">
          เมื่อมีคนคอมเมนต์ใต้โพสต์ของเพจ บอทจะอ่านคอมเมนต์ ตอบกลับสาธารณะสั้นๆ แล้วทัก inbox ไปตอบคำถามจริง
          (ราคา/สต๊อกดึงจากคลังสินค้า) — Facebook ให้ทัก inbox ได้ 1 ครั้งต่อคอมเมนต์ บอทจึงชวนลูกค้าพิมพ์ตอบกลับเพื่อคุยต่อ
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>ข้อความตอบใต้คอมเมนต์ (สาธารณะ)</Label>
            <Input name="comment_public_reply" defaultValue={publicReply ?? ""} placeholder="เว้นว่าง = ไม่ตอบสาธารณะ ทัก inbox อย่างเดียว" />
          </div>
          <div>
            <Label>ตอบเฉพาะคอมเมนต์ที่มีคำ (คั่นด้วย , — เว้นว่าง = ตอบทุกคอมเมนต์)</Label>
            <Input name="comment_keywords" defaultValue={keywords.join(", ")} placeholder="เช่น ราคา, สนใจ, cf" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
          {result?.ok && <span className="text-sm text-emerald-600">✓ {result.msg}</span>}
        </div>
        {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
      </form>

      {/* กล่องทดลอง — เห็นของจริงก่อนเปิดใช้ */}
      <div className="rounded-xl border border-dashed border-neutral-200 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Sparkles className="h-3.5 w-3.5" /> ทดลอง: พิมพ์คอมเมนต์ตัวอย่าง แล้วดูว่าบอทจะทัก inbox ว่าอะไร (ฟรี ไม่หักเครดิต)
        </p>
        <div className="flex gap-2">
          <Input value={testText} onChange={(e) => setTestText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runTest(); } }}
            placeholder='เช่น "ตัวนี้ราคาเท่าไหร่คะ" หรือ "cf สีดำ"' />
          <Button size="sm" variant="outline" type="button" onClick={runTest} disabled={testBusy || !testText.trim()}>
            {testBusy ? "กำลังคิด..." : "ทดลอง"}
          </Button>
        </div>
        {preview && (
          preview.ok ? (
            <div className="mt-3 space-y-2">
              {preview.publicReply && (
                <div className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">ตอบใต้คอมเมนต์ (สาธารณะ)</p>
                  <p className="mt-0.5">{preview.publicReply}</p>
                </div>
              )}
              <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm">
                <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-emerald-500">
                  <MessageCircleReply className="h-3 w-3" /> ทัก inbox (DM)
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{preview.dm}</p>
                {preview.toolCalls && preview.toolCalls.length > 0 && (
                  <p className="mt-1.5 text-[10px] text-emerald-600/70">
                    บอทใช้: {preview.toolCalls.map((t) => t.label).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{preview.error}</p>
          )
        )}
      </div>
    </div>
  );
}
