// โครงต้องตรงกับหน้าจริงเป๊ะ ไม่งั้นเนื้อหากระโดดตอนโหลดเสร็จ (ดู skeleton.tsx)
import { ListSkeleton } from "@/components/skeleton";

// หน้าจริงอยู่ในกรอบ max-w-3xl กึ่งกลาง — โครงเต็มจอจะกระโดดเข้าหากึ่งกลางตอนโหลดเสร็จ
export default function Loading() { return <div className="mx-auto w-full max-w-3xl"><ListSkeleton rows={6} filters={false} action={false} /></div>; }
