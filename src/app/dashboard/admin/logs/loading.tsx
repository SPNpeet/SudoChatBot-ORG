// โครงหน้าระหว่างโหลด — Next แสดงทันทีที่กดเมนู ผู้ใช้จึงไม่เจอจอค้างเปล่า
import { ListSkeleton } from "@/components/skeleton";
export default function Loading() { return <ListSkeleton rows={10}/>; }
