// โครงหน้าระหว่างโหลด — หน้าคู่ค้ารายเดียว: หัวชื่อ + การ์ดยอด 3 ใบ + รายการเอกสาร (เดิมไม่มี = จอขาวจนกว่าจะโหลดเสร็จ)
import { FormSkeleton } from "@/components/skeleton";
export default function Loading() { return <FormSkeleton head back fields={4} action={false} width="max-w-none" />; }
