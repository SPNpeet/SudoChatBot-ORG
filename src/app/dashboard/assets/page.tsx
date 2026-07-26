// ============================================================
//  ทรัพย์สิน + งานปิดงวด — ทะเบียนทรัพย์สิน · ค่าเสื่อมราคา · ปิดบัญชีสิ้นปี
//
//  สามเรื่องนี้เป็นงานที่ SME ลืมทำบ่อยที่สุด และผลเสียหนัก:
//   · ไม่ลงค่าเสื่อม -> กำไรสูงเกินจริง เสียภาษีเงินได้นิติบุคคลเกินทุกปี
//   · ไม่ปิดบัญชีสิ้นปี -> รายได้/ค่าใช้จ่ายสะสมข้ามปี งบดุลผิดตั้งแต่ปีที่สอง
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Table, Th, Td, PageHeader, Badge } from "@/components/ui";
import { baht, dateOnlyTH } from "@/lib/utils";
import { Boxes } from "lucide-react";
import AssetForms from "./asset-forms";
import { monthlyDepreciation, depreciationEndDate, type AssetForDep } from "@/lib/depreciation";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = role === "owner" || role === "admin";

  const [{ data: assetsRaw }, { data: runsRaw }, { data: closesRaw }] = await Promise.all([
    supabase.from("fixed_assets")
      .select("id,name,cost,salvage,acquired_on,life_years,disposed_on,note")
      .eq("shop_id", shop.id).order("acquired_on", { ascending: false }),
    supabase.from("depreciation_runs").select("asset_id,amount,period_month").eq("shop_id", shop.id),
    supabase.from("fiscal_closes").select("year_end,net_profit,closed_at").eq("shop_id", shop.id)
      .order("year_end", { ascending: false }),
  ]);

  const assets = (assetsRaw ?? []) as unknown as AssetForDep[];
  const runs = (runsRaw ?? []) as { asset_id: string; amount: number; period_month: string }[];
  const closes = (closesRaw ?? []) as { year_end: string; net_profit: number; closed_at: string }[];

  const takenBy = new Map<string, number>();
  for (const r of runs) {
    takenBy.set(r.asset_id, Math.round(((takenBy.get(r.asset_id) ?? 0) + Number(r.amount)) * 100) / 100);
  }

  // เดือนล่าสุดที่ยังลงค่าเสื่อมไม่ครบ — เอาไว้เติมให้ในฟอร์ม ผู้ใช้ไม่ต้องเดาเอง
  const now = new Date(Date.now() + 7 * 3600_000);
  const lastClosedMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString().slice(0, 7);

  const totalCost = assets.reduce((a, x) => a + Number(x.cost), 0);
  const totalTaken = [...takenBy.values()].reduce((a, x) => a + x, 0);
  const bookValue = Math.round((totalCost - totalTaken) * 100) / 100;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ทรัพย์สิน + งานปิดงวด"
        lead={<>ทะเบียนทรัพย์สิน ค่าเสื่อมราคา และปิดบัญชีสิ้นปี ของ {shop.name}</>}
        help="ทรัพย์สินที่ใช้ได้หลายปี (คอมพิวเตอร์ รถ เครื่องจักร เฟอร์นิเจอร์) ลงเป็นค่าใช้จ่ายทีเดียวไม่ได้ ต้องทยอยตัดเป็นค่าเสื่อมราคาตามอายุการใช้งาน ถ้าไม่ทำ กำไรจะสูงเกินจริงและเสียภาษีเกินทุกปี"
      />

      {assets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="pt-5">
            <p className="text-xs text-neutral-400">ราคาทุนรวม</p>
            <p className="text-xl font-bold tabular-nums">{baht(totalCost)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-neutral-400">ค่าเสื่อมสะสมที่ลงแล้ว</p>
            <p className="text-xl font-bold tabular-nums text-amber-700">{baht(totalTaken)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-neutral-400">มูลค่าคงเหลือตามบัญชี</p>
            <p className="text-xl font-bold tabular-nums">{baht(bookValue)}</p>
          </CardContent></Card>
        </div>
      )}

      <AssetForms shopId={shop.id} canEdit={canEdit} isOwner={role === "owner"} defaultMonth={lastClosedMonth} />

      <Card>
        <CardHeader><CardTitle>ทะเบียนทรัพย์สิน ({assets.length})</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {assets.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="ยังไม่มีทรัพย์สินในทะเบียน"
              hint="เพิ่มของที่ใช้งานได้เกิน 1 ปี เช่น คอมพิวเตอร์ รถ เครื่องจักร แล้วระบบจะคำนวณค่าเสื่อมให้ทุกเดือน"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>ทรัพย์สิน</Th><Th>ได้มาเมื่อ</Th><Th>อายุ (ปี)</Th>
                    <Th className="text-right">ราคาทุน</Th>
                    <Th className="text-right">ค่าเสื่อมสะสม</Th>
                    <Th className="text-right">คงเหลือ</Th>
                    <Th>หมดอายุ</Th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const taken = takenBy.get(a.id) ?? 0;
                    const nbv = Math.round((Number(a.cost) - taken) * 100) / 100;
                    const end = depreciationEndDate(a.acquired_on, Number(a.life_years));
                    const done = Math.round((Number(a.cost) - Number(a.salvage) - taken) * 100) / 100 <= 0;
                    return (
                      <tr key={a.id}>
                        <Td>
                          <span className="font-medium">{a.name}</span>
                          {a.disposed_on && <Badge tone="neutral" className="ml-2">จำหน่ายแล้ว</Badge>}
                          {!a.disposed_on && done && <Badge tone="green" className="ml-2">ตัดครบแล้ว</Badge>}
                        </Td>
                        <Td>{dateOnlyTH(a.acquired_on)}</Td>
                        <Td>{Number(a.life_years)}</Td>
                        <Td className="text-right tabular-nums">{baht(Number(a.cost))}</Td>
                        <Td className="text-right tabular-nums text-amber-700">{baht(taken)}</Td>
                        <Td className="text-right tabular-nums font-medium">{baht(nbv)}</Td>
                        <Td className="text-neutral-500">{dateOnlyTH(end.toISOString().slice(0, 10))}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {closes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>ประวัติการปิดบัญชีสิ้นปี</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <thead><tr><Th>รอบสิ้นสุด</Th><Th className="text-right">กำไร(ขาดทุน)สุทธิ</Th><Th>ปิดเมื่อ</Th></tr></thead>
              <tbody>
                {closes.map((c) => (
                  <tr key={c.year_end}>
                    <Td className="font-medium">{dateOnlyTH(c.year_end)}</Td>
                    <Td className={`text-right tabular-nums font-medium ${Number(c.net_profit) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {baht(Number(c.net_profit))}
                    </Td>
                    <Td className="text-neutral-500">{new Date(c.closed_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="rounded-xl bg-neutral-50 px-4 py-3 text-[12px] leading-relaxed text-neutral-500">
        ระบบคิดค่าเสื่อมด้วย<b className="text-neutral-700">วิธีเส้นตรง</b> และปีแรกคิด<b className="text-neutral-700">ตามส่วนเฉลี่ยรายวัน</b>นับจากวันที่ได้ทรัพย์สินมา
        (ประมวลรัษฎากร มาตรา 65 ทวิ (2) ประกอบพระราชกฤษฎีกา ฉบับที่ 145) และเหลือราคาซากไว้อย่างน้อย 1 บาทจนกว่าจะจำหน่ายออกไป ·
        อัตราสูงสุดที่หักได้ต่างกันตามประเภททรัพย์สิน ระบบไม่ได้ตัดสินแทน โปรดให้ผู้ทำบัญชียืนยันอายุการใช้งานที่กรอก
      </p>
    </div>
  );
}
