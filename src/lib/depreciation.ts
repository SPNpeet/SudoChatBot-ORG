// ============================================================
//  ค่าเสื่อมราคา — วิธีเส้นตรง ปีแรกเฉลี่ยรายวัน
//
//  ฐานกฎหมาย: ประมวลรัษฎากร ม.65 ทวิ (2) ประกอบ พระราชกฤษฎีกา (ฉบับที่ 145)
//  · ใช้วิธีเส้นตรงตามอายุการใช้งาน
//  · ปีที่ได้ทรัพย์สินมา หักได้ "ตามส่วนเฉลี่ยรายวัน" นับจากวันที่ได้มา
//    ไม่ใช่หักเต็มปี ซึ่งเป็นจุดที่คนทำเองพลาดบ่อยที่สุด
//  · ต้องเหลือราคาซากไว้อย่างน้อย 1 บาทจนกว่าจะจำหน่ายทรัพย์สินออกไป
//
//  ⚠️ ไฟล์นี้เป็นการตีความข้อกฎหมายเพื่อทำซอฟต์แวร์ ไม่ใช่คำแนะนำทางภาษี
//     อัตราสูงสุดที่หักได้ต่างกันตามประเภททรัพย์สิน ผู้ใช้ต้องกรอกอายุการใช้งานเอง
//     และควรให้ผู้ทำบัญชียืนยัน
// ============================================================

export interface AssetForDep {
  id: string;
  name: string;
  cost: number;
  salvage: number;
  acquired_on: string;   // YYYY-MM-DD
  life_years: number;
  disposed_on: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** วันสุดท้ายที่ยังคิดค่าเสื่อมได้ = วันก่อนครบอายุการใช้งานพอดี */
export function depreciationEndDate(acquiredOn: string, lifeYears: number): Date {
  const d = new Date(acquiredOn + "T00:00:00Z");
  const wholeYears = Math.floor(lifeYears);
  const extraMonths = Math.round((lifeYears - wholeYears) * 12);
  const end = new Date(d);
  end.setUTCFullYear(end.getUTCFullYear() + wholeYears);
  end.setUTCMonth(end.getUTCMonth() + extraMonths);
  end.setUTCDate(end.getUTCDate() - 1);
  return end;
}

/**
 * ค่าเสื่อมของทรัพย์สินหนึ่งชิ้นสำหรับ "เดือนหนึ่งเดือน"
 *
 * @param monthStart วันที่ 1 ของเดือนที่ต้องการคิด (YYYY-MM-01)
 * @param alreadyTaken ค่าเสื่อมสะสมที่ลงบัญชีไปแล้ว — ใช้กันคิดเกินราคาซาก
 * @returns จำนวนเงินค่าเสื่อมของเดือนนั้น (0 = ไม่ต้องลง)
 */
export function monthlyDepreciation(
  asset: AssetForDep, monthStart: string, alreadyTaken: number,
): number {
  const depreciable = r2(Number(asset.cost) - Number(asset.salvage));
  if (depreciable <= 0) return 0;

  const [y, m] = monthStart.split("-").map(Number);
  const dim = daysInMonth(y, m);
  const mStart = new Date(Date.UTC(y, m - 1, 1));
  const mEnd = new Date(Date.UTC(y, m - 1, dim));

  const acquired = new Date(asset.acquired_on + "T00:00:00Z");
  if (acquired > mEnd) return 0;                       // ยังไม่ได้ทรัพย์สินมา

  const depEnd = depreciationEndDate(asset.acquired_on, Number(asset.life_years));
  if (mStart > depEnd) return 0;                       // หมดอายุการใช้งานแล้ว

  // จำหน่ายออกไปแล้ว: เดือนที่จำหน่ายยังคิดถึงวันที่จำหน่าย เดือนถัดไปไม่คิด
  const disposed = asset.disposed_on ? new Date(asset.disposed_on + "T00:00:00Z") : null;
  if (disposed && mStart > disposed) return 0;

  // ช่วงวันที่คิดค่าเสื่อมจริงในเดือนนี้ (ตัดด้วยวันได้มา / วันหมดอายุ / วันจำหน่าย)
  const from = acquired > mStart ? acquired : mStart;
  let to = depEnd < mEnd ? depEnd : mEnd;
  if (disposed && disposed < to) to = disposed;
  if (from > to) return 0;

  const daysUsed = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;

  // ค่าเสื่อมต่อวัน = มูลค่าที่คิดค่าเสื่อมได้ / จำนวนวันทั้งอายุการใช้งาน
  // ใช้ฐานวันจริง (นับจากวันได้มาถึงวันหมดอายุ) ไม่ใช่ 365 คงที่ จึงรองรับปีอธิกสุรทินเอง
  const totalDays = Math.floor((depEnd.getTime() - acquired.getTime()) / 86400000) + 1;
  if (totalDays <= 0) return 0;

  const amount = r2(depreciable * (daysUsed / totalDays));

  // งวดสุดท้ายต้องปิดให้พอดี ห้ามคิดเกินจนต่ำกว่าราคาซาก
  // และห้ามเหลือเศษค้างไว้ตลอดกาลเพราะการปัดเศษรายเดือน
  const remaining = r2(depreciable - alreadyTaken);
  if (remaining <= 0) return 0;
  const isLastMonth = to.getTime() === depEnd.getTime()
    || (!!disposed && to.getTime() === disposed.getTime());
  if (isLastMonth || amount > remaining) return remaining;
  return amount;
}
