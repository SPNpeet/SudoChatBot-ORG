import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { APP_ORIGIN } from "@/lib/app-origin";
import { deployRichMenu } from "@/lib/line-menu-deploy";

// ============================================================
//  สร้าง/อัปเดต Rich Menu ของ LINE OA กลาง (แอดมินแพลตฟอร์มเท่านั้น)
//
//  ⚠️ ตัวงานจริงย้ายไป lib/line-menu-deploy แล้ว
//  เพราะเมนูต้องสร้างได้จากสองทาง: ปุ่มในหน้านี้ และสคริปต์ที่รันจากเครื่อง
//  ถ้าเขียนงานไว้ในไฟล์ route ทางที่สองจะต้องก๊อปโค้ดไปอีกชุด
//  แล้วเมนูจะกลายเป็นคนละหน้าตาแล้วแต่ว่าใครกดสร้าง
// ============================================================

export const maxDuration = 60;

export async function POST() {
  try {
    const { supabase } = await requireUser();
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) return NextResponse.json({ ok: false, error: "เฉพาะผู้ดูแลแพลตฟอร์ม" }, { status: 403 });

    const r = await deployRichMenu(createServiceClient(), APP_ORIGIN);
    if (!r.ok) return NextResponse.json(r, { status: r.status ?? 502 });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
