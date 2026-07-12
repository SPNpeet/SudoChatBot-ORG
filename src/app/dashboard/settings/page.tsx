import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";
import { saveBotSettings, savePaymentSettings, addMember, removeMember } from "../actions";
import type { BotSettings, ShopPaymentSettings } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, shop } = await getCurrentShop();
  const [{ data: bot }, { data: pay }, { data: members }] = await Promise.all([
    supabase.from("bot_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("shop_payment_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("shop_members").select("id, role, profiles(display_name, email)").eq("shop_id", shop.id),
  ]);
  const b = (bot ?? {}) as Partial<BotSettings>;
  const p = (pay ?? {}) as Partial<ShopPaymentSettings>;
  const ship = p.shipping_options ?? [];

  async function saveBot(fd: FormData) { "use server"; await saveBotSettings(String(fd.get("shop_id")), fd); }
  async function savePay(fd: FormData) { "use server"; await savePaymentSettings(String(fd.get("shop_id")), fd); }
  async function invite(fd: FormData) { "use server"; await addMember(String(fd.get("shop_id")), fd); }
  async function kick(fd: FormData) { "use server"; await removeMember(String(fd.get("member_id")), String(fd.get("shop_id"))); }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">ตั้งค่า</h1>
        <p className="text-sm text-neutral-400">บุคลิกบอท การรับเงิน และทีมของร้าน {shop.name}</p>
      </div>

      {/* ===== บอท ===== */}
      <Card>
        <CardHeader><CardTitle>🤖 พนักงานขาย AI</CardTitle></CardHeader>
        <CardContent>
          <form action={saveBot} className="space-y-4">
            <input type="hidden" name="shop_id" value={shop.id} />
            <div className="flex items-center gap-6">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>คีย์เวิร์ดส่งต่อแอดมิน (คั่นด้วย ,)</Label>
                <Input name="handoff_keywords" defaultValue={(b.handoff_keywords ?? ["คุยกับคน", "ติดต่อแอดมิน"]).join(", ")} />
              </div>
              <div>
                <Label>ข้อความเมื่อส่งต่อแอดมิน</Label>
                <Input name="fallback_message" defaultValue={b.fallback_message ?? "ขออภัยค่ะ เดี๋ยวแอดมินจะรีบมาตอบนะคะ"} />
              </div>
            </div>
            <Button size="sm">บันทึกการตั้งค่าบอท</Button>
          </form>
        </CardContent>
      </Card>

      {/* ===== การเงิน ===== */}
      <Card>
        <CardHeader><CardTitle>💸 การรับเงินและค่าจัดส่ง</CardTitle></CardHeader>
        <CardContent>
          <form action={savePay} className="space-y-4">
            <input type="hidden" name="shop_id" value={shop.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>พร้อมเพย์ (เบอร์/เลขบัตร ปชช.)</Label>
                <Input name="promptpay_id" defaultValue={p.promptpay_id ?? ""} placeholder="0812345678" />
              </div>
              <div>
                <Label>ประเภท</Label>
                <Select name="promptpay_type" defaultValue={p.promptpay_type ?? "phone"}>
                  <option value="phone">เบอร์โทรศัพท์</option>
                  <option value="citizen_id">เลขบัตรประชาชน</option>
                  <option value="ewallet">e-Wallet ID</option>
                </Select>
              </div>
              <div><Label>ชื่อบัญชี</Label><Input name="account_name" defaultValue={p.account_name ?? ""} /></div>
              <div><Label>ธนาคาร</Label><Input name="bank_name" defaultValue={p.bank_name ?? ""} /></div>
            </div>

            <div>
              <Label>การตรวจสลิปอัตโนมัติ</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select name="slip_provider" defaultValue={p.slip_provider ?? "manual"}>
                  <option value="manual">ตรวจเอง (แอดมินกดยืนยันในหน้าออเดอร์)</option>
                  <option value="easyslip">EasySlip — อัตโนมัติ 100%</option>
                  <option value="slipok">SlipOK — อัตโนมัติ 100%</option>
                </Select>
                <Input name="slip_api_key" type="password" placeholder="API Key (กรอกเมื่อเปลี่ยน)" />
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">สมัคร EasySlip ที่ easyslip.com (~0.05฿/สลิป) — ระบบกันสลิปปลอม/สลิปซ้ำ/ยอดไม่ตรงให้อัตโนมัติ</p>
            </div>

            <div>
              <Label>ตัวเลือกจัดส่ง (บอทใช้คำนวณยอดรวม)</Label>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <Input name={`ship_name_${i}`} defaultValue={ship[i]?.name ?? (i === 0 ? "ส่งด่วน Kerry/Flash" : "")} placeholder={`ช่องทางที่ ${i + 1}`} />
                    <Input name={`ship_fee_${i}`} type="number" min="0" defaultValue={ship[i]?.fee ?? (i === 0 ? 40 : "")} placeholder="ค่าส่ง (บาท)" />
                    <Input name={`ship_free_${i}`} type="number" min="0" defaultValue={ship[i]?.free_over ?? ""} placeholder="ฟรีเมื่อครบ (บาท)" />
                  </div>
                ))}
              </div>
            </div>
            <Button size="sm">บันทึกการตั้งค่าการเงิน</Button>
          </form>
        </CardContent>
      </Card>

      {/* ===== ทีม ===== */}
      <Card>
        <CardHeader><CardTitle>👥 ทีมของร้าน</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {(members ?? []).map((m) => {
              const prof = m.profiles as unknown as { display_name: string | null; email: string | null } | null;
              return (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{prof?.display_name ?? prof?.email ?? "สมาชิก"}</p>
                    <p className="text-[11px] text-neutral-400">{prof?.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={m.role === "owner" ? "green" : "neutral"}>
                      {m.role === "owner" ? "เจ้าของ" : m.role === "admin" ? "ผู้ดูแล" : m.role === "agent" ? "แอดมินเพจ" : "ดูอย่างเดียว"}
                    </Badge>
                    {m.role !== "owner" && (
                      <form action={kick}>
                        <input type="hidden" name="member_id" value={m.id} />
                        <input type="hidden" name="shop_id" value={shop.id} />
                        <button className="text-xs text-neutral-400 hover:text-red-600">ลบออก</button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <form action={invite} className="flex gap-2">
            <input type="hidden" name="shop_id" value={shop.id} />
            <Input name="email" type="email" required placeholder="อีเมลของสมาชิก (ต้องเคย Login แล้ว)" className="flex-1" />
            <Select name="role" defaultValue="agent" className="w-40">
              <option value="admin">ผู้ดูแล</option>
              <option value="agent">แอดมินเพจ</option>
              <option value="viewer">ดูอย่างเดียว</option>
            </Select>
            <Button size="sm" className="h-10">เพิ่ม</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
