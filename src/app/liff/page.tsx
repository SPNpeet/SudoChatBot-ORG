// ============================================================
//  ทางเข้าจาก LINE (LIFF) — เปิดจากเมนูในแชทแล้วพาไปหน้าที่ต้องการ
//
//  ⚠️ ทำไมต้องมีหน้านี้ (8 ส.ค. 2569)
//  เมนูใน LINE เดิมยิงไป https://sudochatbot.online/... ตรง ๆ
//  ซึ่งเปิดในเบราว์เซอร์ในแอป LINE (คนละที่เก็บ cookie กับเบราว์เซอร์หลักของเครื่อง)
//  ผลจริง: กดเมนูทีไรก็เจอหน้าล็อกอินทุกครั้ง คนส่วนใหญ่ปิดทิ้งตรงนั้น
//  เจ้าของสรุปว่า "เมนูใช้งานยากมาก" — ถูกแล้ว เพราะมันพาไปเจอกำแพงทุกครั้ง
//
//  หน้านี้เปิดเป็น LIFF (แอปในไลน์) ซึ่งได้สองอย่างที่ลิงก์ธรรมดาไม่มี:
//   1. เปิดเต็มจอเหมือนแอป ไม่มีแถบเบราว์เซอร์เกะกะ และปิดแล้วกลับเข้าแชทเดิม
//   2. LINE ยืนยันตัวคนกดมาให้แล้ว จึงพาไปหน้าที่ถูกต้องได้ทันทีโดยไม่ต้องถามอะไรก่อน
//
//  ⚠️ สิ่งที่หน้านี้ยัง "ไม่" ทำ และห้ามแอบทำเอง:
//  การล็อกอินเข้าบัญชี SudoChatBot ให้อัตโนมัติด้วยตัวตน LINE
//  ต้องเปิด LINE เป็น provider ใน Supabase Auth ซึ่งเป็นการตั้งค่าที่เจ้าของทำเองเท่านั้น
//  (ปิด/เปลี่ยน provider ผิดครั้งเดียว = ล็อกผู้ใช้ที่ผูกไว้ออกถาวร — เคยเกิดกับ Facebook มาแล้ว)
//  ระหว่างนี้: คนที่เคยล็อกอินใน LIFF แล้ว session จะอยู่ต่อ ไม่ต้องล็อกอินซ้ำทุกครั้งเหมือนเดิม
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import LiffBoot from "./liff-boot";

export const dynamic = "force-dynamic";

/** อนุญาตเฉพาะ path ภายในระบบ — กัน open redirect จาก query ที่ใครก็ใส่ได้ */
function safePath(raw: string | undefined): string {
  const p = (raw ?? "").trim();
  if (!p.startsWith("/") || p.startsWith("//")) return "/dashboard";
  return p.slice(0, 200);
}

export default async function LiffEntryPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const target = safePath(to);

  const svc = createServiceClient();
  const { data: pf } = await svc.from("platform_billing_settings")
    .select("line_liff_id").eq("id", true).maybeSingle();
  const liffId = (pf?.line_liff_id ?? "").trim();

  return <LiffBoot liffId={liffId} target={target} />;
}
