// กำแพงสิทธิ์แบบอ่านรู้เรื่อง — แทนการปล่อยให้หน้าโหลดแล้วปุ่มทุกปุ่มพังเงียบ ๆ
// บอกว่าใครใช้หน้านี้ได้ และต้องไปขอใคร ไม่ใช่แค่ "forbidden"
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function RoleWall({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-amber-50">
        <ShieldAlert className="h-5 w-5 text-amber-600" />
      </span>
      <h1 className="mt-3 text-lg font-bold text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600">{detail}</p>
      <Link href="/dashboard"
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-700">
        กลับหน้าภาพรวม
      </Link>
    </div>
  );
}
