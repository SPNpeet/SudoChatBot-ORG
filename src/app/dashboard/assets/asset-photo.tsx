// ============================================================
//  รูปทรัพย์สินจริง — bucket asset-photos เป็น private
//  จึงเปิดตรงด้วย URL ไม่ได้ ต้องขอลิงก์มีอายุ (signed URL) ทุกครั้ง
//  Server component: ขอลิงก์ตอน render ไม่ต้องส่ง JS เพิ่มให้ผู้ใช้
// ============================================================
import { assetPhotoUrl } from "./actions";

export default async function AssetPhoto({
  shopId, path, name,
}: { shopId: string; path: string; name: string }) {
  const url = await assetPhotoUrl(shopId, path);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`รูป ${name}`}
      className="mr-2 inline-block h-9 w-9 shrink-0 rounded-lg border border-neutral-200 object-cover align-middle" />
  );
}
