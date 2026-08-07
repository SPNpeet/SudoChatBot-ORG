"use client";
// ฟอร์มฝั่ง client: เพิ่มทรัพย์สิน · ลงค่าเสื่อมรายเดือน · ปิดบัญชีสิ้นปี
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Calculator, BookLock, TriangleAlert, Camera, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { addFixedAsset, runDepreciation, closeFiscalYear, uploadAssetPhoto } from "./actions";
import DateField from "@/components/date-field";

/** อายุการใช้งานที่พบบ่อย — เป็นตัวช่วยกรอก ไม่ใช่คำวินิจฉัยทางภาษี */
const LIFE_PRESETS = [
  { label: "คอมพิวเตอร์ / อุปกรณ์ไอที", years: 3 },
  { label: "เครื่องใช้สำนักงาน / เฟอร์นิเจอร์", years: 5 },
  { label: "เครื่องจักร / อุปกรณ์โรงงาน", years: 5 },
  { label: "ยานพาหนะ", years: 5 },
  { label: "อาคาร", years: 20 },
];

export default function AssetForms({ shopId, canEdit, isOwner, defaultMonth }: {
  shopId: string; canEdit: boolean; isOwner: boolean; defaultMonth: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [life, setLife] = useState("3");
  const [depMonth, setDepMonth] = useState(defaultMonth);
  const [yearEnd, setYearEnd] = useState(`${new Date().getFullYear() - 1}-12-31`);
  // ตั้งต้นเป็นวันนี้ตามเวลาไทย — ค่าที่คนเลือกบ่อยสุด และกันช่องว่างที่ทำให้ลืมกรอก
  const [acquiredOn, setAcquiredOn] = useState(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [confirmClose, setConfirmClose] = useState(false);
  // รูปทรัพย์สิน — อัปโหลดก่อนกดบันทึก แล้วส่งแค่ path ไปกับฟอร์ม
  // (อัปพร้อมฟอร์มไม่ได้ เพราะ server action รับ FormData ที่มีไฟล์ใหญ่แล้วช้า/ติดเพดาน)
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoErr(null); setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const r = await uploadAssetPhoto(shopId, fd);
      if (!r.ok) { setPhotoErr(r.error); return; }
      setPhotoPath(r.path); setPhotoName(file.name);
    } finally {
      setPhotoBusy(false);
    }
  }

  if (!canEdit) {
    return <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
      เฉพาะเจ้าของ/ผู้ดูแลจัดการทรัพย์สินและงานปิดงวดได้
    </p>;
  }

  function run(fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>เพิ่มทรัพย์สินเข้าทะเบียน</CardTitle></CardHeader>
        <CardContent>
          <form action={(fd) => run(() => addFixedAsset(shopId, fd))} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>ชื่อทรัพย์สิน *</Label>
                <Input name="name" required placeholder="เช่น โน้ตบุ๊ก Dell สำหรับฝ่ายบัญชี" />
              </div>
              <div>
                <Label>ราคาทุน (บาท) *</Label>
                <Input name="cost" inputMode="decimal" required placeholder="60000" />
                <p className="mt-1 text-xs text-neutral-400">ราคาซื้อ + ค่าติดตั้ง/ขนส่ง ไม่รวมภาษีซื้อที่ขอคืนได้</p>
              </div>
              <div>
                <DateField label="วันที่ได้ทรัพย์สินมา" required name="acquired_on"
                  value={acquiredOn} onChange={setAcquiredOn}
                  hint="ปีแรกคิดค่าเสื่อมตามส่วนเฉลี่ยรายวันจากวันนี้" />
              </div>
              <div>
                <Label>อายุการใช้งาน (ปี) *</Label>
                <Input name="life_years" inputMode="decimal" required value={life} onChange={(e) => setLife(e.target.value)} />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {LIFE_PRESETS.map((p) => (
                    <button key={p.label} type="button" title={`${p.years} ปี`}
                      onClick={() => setLife(String(p.years))}
                      className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-600 transition-colors hover:border-emerald-300 hover:text-emerald-700">
                      {p.label} {p.years}ปี
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>ราคาซาก (บาท)</Label>
                <Input name="salvage" inputMode="decimal" defaultValue="1" />
                <p className="mt-1 text-xs text-neutral-400">กฎหมายให้เหลือไว้อย่างน้อย 1 บาทจนกว่าจะขายทิ้ง</p>
              </div>
              <div className="sm:col-span-2">
                <Label>หมายเหตุ</Label>
                <Input name="note" placeholder="เช่น เลขเครื่อง / ที่ตั้ง / ผู้ครอบครอง" />
              </div>

              {/* รูปทรัพย์สินจริง — หลักฐานว่าของมีอยู่จริงและอยู่ที่ไหน
                  ผู้สอบบัญชีขอดูหลักฐานการตรวจนับทุกปี · เก็บใน bucket ส่วนตัว
                  ไม่ใช่ public เพราะรูปมักติดเลขเครื่อง/ที่ตั้ง/หน้าตาสำนักงาน */}
              <div className="sm:col-span-2">
                <Label>รูปทรัพย์สิน (ไม่บังคับ)</Label>
                <input type="hidden" name="photo_path" value={photoPath ?? ""} />
                {photoPath ? (
                  <div className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                    <Camera className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1 truncate text-sm text-emerald-800">{photoName}</span>
                    <button type="button" aria-label="เอารูปออก"
                      onClick={() => { setPhotoPath(null); setPhotoName(null); }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-emerald-700 hover:bg-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 transition-colors hover:border-emerald-400 hover:text-emerald-700">
                    <Camera className="h-4 w-4 shrink-0" />
                    {photoBusy ? "กำลังอัปโหลด..." : "ถ่ายรูป / เลือกรูปทรัพย์สิน"}
                    <input type="file" accept="image/*" className="hidden" disabled={photoBusy}
                      onChange={(e) => pickPhoto(e.target.files?.[0])} />
                  </label>
                )}
                {photoErr && <p className="mt-1 text-xs text-red-600">{photoErr}</p>}
                <p className="mt-1 text-xs text-neutral-400">
                  เก็บเป็นความลับของกิจการ เปิดดูได้เฉพาะคนในทีม · ใช้เป็นหลักฐานตอนตรวจนับ
                </p>
              </div>
            </div>
            <Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> เพิ่มทรัพย์สิน</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>ลงค่าเสื่อมราคาประจำเดือน</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[12px] leading-relaxed text-neutral-500">
              ระบบคำนวณให้ทุกชิ้นในทะเบียนแล้วลงสมุดรายวันให้เอง
              <b className="text-neutral-700"> กดซ้ำได้ปลอดภัย</b> — เดือนที่ลงไปแล้วจะไม่ลงซ้ำ
            </p>
            <div>
              <Label>เดือนที่ต้องการลง</Label>
              <Input type="month" value={depMonth} onChange={(e) => setDepMonth(e.target.value)} />
              <p className="mt-1 text-xs text-neutral-400">ลงได้เมื่อสิ้นเดือนนั้นผ่านไปแล้ว</p>
            </div>
            <Button variant="outline" disabled={pending} onClick={() => run(() => runDepreciation(shopId, depMonth))}>
              <Calculator className="h-4 w-4" /> {pending ? "กำลังคำนวณ..." : "ลงค่าเสื่อมเดือนนี้"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ปิดบัญชีสิ้นปี</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[12px] leading-relaxed text-neutral-500">
              ล้างยอดรายได้และค่าใช้จ่ายทั้งรอบเข้า <b className="text-neutral-700">กำไรสะสม (3020)</b> ·
              ถ้าไม่ทำ ยอดจะสะสมข้ามปีและงบดุลผิดตั้งแต่ปีที่สอง
            </p>
            <div>
              <DateField label="วันสิ้นรอบบัญชี" value={yearEnd} onChange={setYearEnd} hideToday />
            </div>
            {!isOwner ? (
              <p className="text-[12px] text-neutral-400">ปิดบัญชีสิ้นปีได้เฉพาะเจ้าของกิจการ</p>
            ) : !confirmClose ? (
              <Button variant="outline" onClick={() => setConfirmClose(true)} disabled={pending}>
                <BookLock className="h-4 w-4" /> ปิดบัญชีรอบนี้
              </Button>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-amber-800">
                  <TriangleAlert className="h-4 w-4 shrink-0" /> ยืนยันปิดบัญชีถึง {yearEnd}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                  ระบบจะลงรายการปิดบัญชีในสมุดรายวัน ณ วันสิ้นรอบ ควรตรวจงบทดลองให้เรียบร้อยก่อน
                  แนะนำให้ลงค่าเสื่อมของทุกเดือนในรอบนั้นให้ครบก่อนปิด
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="danger" disabled={pending}
                    onClick={() => { setConfirmClose(false); run(() => closeFiscalYear(shopId, yearEnd)); }}>
                    {pending ? "กำลังปิด..." : "ยืนยันปิดบัญชี"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmClose(false)}>ยกเลิก</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {msg && (
        <p className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
