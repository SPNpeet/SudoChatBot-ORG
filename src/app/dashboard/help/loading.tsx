// โครงต้องตรงกับหน้าจริงเป๊ะ ไม่งั้นเนื้อหากระโดดตอนโหลดเสร็จ (ดู skeleton.tsx)
import { ListSkeleton } from "@/components/skeleton";

export default function Loading() { return <ListSkeleton rows={6} filters={false} action={false} />; }
