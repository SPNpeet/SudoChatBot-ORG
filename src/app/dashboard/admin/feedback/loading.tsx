// โครงหน้าระหว่างโหลด — รูปร่างต้องตรงกับหน้าจริง (หัวเรื่อง/กล่องคำแนะนำ/แถบตัวกรอง)
// ไม่งั้นพอข้อมูลมาถึง เนื้อหาจะกระโดดและผู้ใช้ที่กำลังจะกดปุ่มจะกดพลาด
import { ListSkeleton } from "@/components/skeleton";
export default function Loading() { return <ListSkeleton rows={6} head={false} />; }
