// โครงต้องตรงกับหน้าจริงเป๊ะ ไม่งั้นเนื้อหากระโดดตอนโหลดเสร็จ (ดู skeleton.tsx)
import { FormSkeleton } from "@/components/skeleton";

export default function Loading() { return <FormSkeleton hint fields={3} action={false} />; }
