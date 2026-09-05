// โครงต้องตรงกับหน้าจริงเป๊ะ ไม่งั้นเนื้อหากระโดดตอนโหลดเสร็จ (ดู skeleton.tsx)
import { FormSkeleton } from "@/components/skeleton";

// หน้าจริงกว้าง max-w-5xl — โครงที่แคบกว่าทำให้การ์ดกระโดดกว้างตอนโหลดเสร็จ
export default function Loading() { return <FormSkeleton hint fields={3} action={false} width="max-w-5xl" />; }
