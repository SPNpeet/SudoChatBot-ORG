// ============================================================
//  บัญชีของฉัน — หน้าเดียวที่ตอบว่า "ระบบรู้จักฉันในชื่ออะไร"
//
//  เดิมทั้งเว็บไม่มีจุดไหนแสดงชื่อหรืออีเมลผู้ใช้เลย มีแค่ปุ่มออกจากระบบ
//  ผลคือถ้าเปิดค้างไว้หรือใช้เครื่องร่วมกัน จะไม่มีทางรู้เลยว่ากำลังบันทึก
//  เอกสารในนามใคร ทั้งที่ระบบประทับชื่อคนทำลงประวัติการแก้ไขทุกครั้ง
//
//  หน้านี้ตั้งใจให้ "แก้ได้เท่าที่ปลอดภัย"
//   · ชื่อที่แสดง / เบอร์  -> แก้ได้ทันที
//   · อีเมล                -> อ่านอย่างเดียว เพราะเป็นกุญแจล็อกอินและตัวระบุใน audit log
//   · รหัสผ่าน             -> ผ่านลิงก์ทางอีเมลเท่านั้น ไม่ให้ตั้งใหม่ตรง ๆ ในหน้าที่เปิดค้างไว้ได้
// ============================================================
export const dynamic = "force-dynamic";

import { getCurrentShop } from "@/lib/shop";
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
// ต้องดึงจาก lib ไม่ใช่จาก account-menu.tsx — ไฟล์นั้นเป็น "use client"
// Server Component เรียกฟังก์ชันจากไฟล์ client ไม่ได้ (build ผ่านแต่พังตอนรันจริง)
import { roleLabel } from "@/lib/roles";
import AccountForm from "./account-form";
import { Building2, ShieldCheck } from "lucide-react";

export default async function AccountPage() {
  const { supabase, user, memberships } = await getCurrentShop();
  const { data: prof } = await supabase
    .from("profiles").select("display_name,phone,email,created_at").eq("id", user.id).maybeSingle();

  const email = user.email ?? prof?.email ?? null;
  const joined = prof?.created_at ?? user.created_at;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageHeader
        title="บัญชีของฉัน"
        lead="ข้อมูลผู้ใช้ที่กำลังล็อกอินอยู่ตอนนี้"
        back={{ href: "/dashboard", label: "ภาพรวม" }}
      />

      <AccountForm
        email={email}
        displayName={prof?.display_name ?? (user.user_metadata?.full_name as string | undefined) ?? null}
        phone={prof?.phone ?? null}
        joined={joined ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-neutral-400" /> กิจการที่บัญชีนี้เข้าถึงได้
          </CardTitle>
          <p className="mt-1 text-xs font-normal text-neutral-500">
            สิทธิ์ต่างกันในแต่ละกิจการได้ — สลับกิจการได้จากปุ่มด้านบนของเมนู
          </p>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {memberships.map((m) => (
            <div key={m.shop.id} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{m.shop.name}</span>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11px] text-neutral-500">
                {roleLabel(m.role)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* คนใช้เครื่องร่วมกันต้องรู้ว่าการกระทำผูกกับบัญชีนี้ ไม่ใช่กับเครื่อง */}
      <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
        <p className="text-[12px] leading-relaxed text-neutral-500">
          ทุกครั้งที่บันทึก แก้ไข หรือยกเลิกเอกสาร ระบบจะเก็บชื่อบัญชีนี้ไว้ในประวัติการแก้ไขของเอกสารนั้น
          และลบทิ้งไม่ได้ — ถ้าใช้คอมพิวเตอร์ร่วมกับคนอื่น ให้เช็คชื่อด้านบนก่อนลงบัญชีทุกครั้ง
          หรือกดออกจากระบบเมื่อใช้เสร็จ
        </p>
      </div>
    </div>
  );
}
