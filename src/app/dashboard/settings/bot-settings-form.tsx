"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { saveBotSettings } from "../actions";
import type { BotSettings } from "@/lib/types/db";

export default function BotSettingsForm({ shopId, b }: { shopId: string; b: Partial<BotSettings> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await saveBotSettings(shopId, fd);
      setResult(r.ok ? { ok: true, msg: "บันทึกแล้ว" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(() => setResult(null), 3000);
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="shop_id" value={shopId} />
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={b.enabled ?? true} className="h-4 w-4 accent-emerald-600" />
          เปิดใช้งานบอท
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="auto_close_sale" defaultChecked={b.auto_close_sale ?? true} className="h-4 w-4 accent-emerald-600" />
          ให้บอทปิดการขาย + ส่ง QR เอง
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="upsell_enabled" defaultChecked={b.upsell_enabled ?? true} className="h-4 w-4 accent-emerald-600" />
          ชวนซื้อเพิ่ม (upsell)
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label>ชื่อบอท</Label><Input name="persona_name" defaultValue={b.persona_name ?? "แอดมิน"} /></div>
        <div>
          <Label>โทนการพูด</Label>
          <Select name="tone" defaultValue={b.tone ?? "friendly"}>
            <option value="friendly">เป็นกันเอง</option>
            <option value="formal">ทางการ</option>
            <option value="playful">สนุกสนาน</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>ข้อความทักทายแรก (ไม่บังคับ)</Label>
        <Textarea name="greeting" defaultValue={b.greeting ?? ""} placeholder="เว้นว่าง = ให้บอทแต่งคำทักทายเอง — ถ้าใส่ บอทจะทักด้วยข้อความนี้คำต่อคำตอนเริ่มบทสนทนาใหม่" />
      </div>
      <div>
        <Label>คุณภาพโมเดล AI</Label>
        <Select name="model_tier" defaultValue={b.model_tier ?? "standard"}>
          <option value="economy">ประหยัด — เร็ว ค่าใช้จ่ายต่ำสุด</option>
          <option value="standard">มาตรฐาน — ฉลาด ปิดการขายเก่ง (แนะนำ)</option>
          <option value="premium">พรีเมียม — ดีที่สุดสำหรับสินค้าซับซ้อน</option>
        </Select>
      </div>
      <div>
        <Label>คำสั่งเพิ่มเติมถึงบอท (จุดขาย โปรโมชัน สิ่งที่ห้ามพูด)</Label>
        <Textarea name="custom_instructions" defaultValue={b.custom_instructions ?? ""} placeholder="เช่น ตอนนี้มีโปรซื้อ 2 แถม 1 ทุกรายการ / ห้ามรับปากวันจัดส่งที่แน่นอน" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>คีย์เวิร์ดส่งต่อแอดมิน (คั่นด้วย ,)</Label>
          <Input name="handoff_keywords" defaultValue={(b.handoff_keywords ?? ["คุยกับคน", "ติดต่อแอดมิน"]).join(", ")} />
        </div>
        <div>
          <Label>ข้อความเมื่อส่งต่อแอดมิน</Label>
          <Input name="fallback_message" defaultValue={b.fallback_message ?? "ขออภัยค่ะ เดี๋ยวแอดมินจะรีบมาตอบนะคะ"} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending} className="w-full sm:w-auto">{pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่าบอท"}</Button>
        {result?.ok && <span className="text-sm text-emerald-600">✓ {result.msg}</span>}
      </div>
      {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
    </form>
  );
}
