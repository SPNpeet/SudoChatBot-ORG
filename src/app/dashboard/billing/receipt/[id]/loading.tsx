// โครงใบเสร็จค่าบริการ — หน้าจริงเป็นกล่องเดียว max-w-lg กึ่งกลาง
import { FormSkeleton } from "@/components/skeleton";
export default function Loading() { return <FormSkeleton head={false} fields={5} action={false} width="max-w-lg" />; }
