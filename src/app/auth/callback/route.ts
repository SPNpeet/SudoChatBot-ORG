import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // ลิงก์รีเซ็ตรหัสผ่านส่ง next=/reset-password มาด้วย
  // รับเฉพาะ path ภายในที่รู้จัก — ถ้ารับ URL อะไรก็ได้ จะกลายเป็นช่องให้พาผู้ใช้
  // ที่เพิ่งล็อกอินไปเว็บปลอม (open redirect)
  const ALLOWED_NEXT = new Set(["/reset-password"]);
  const nextRaw = searchParams.get("next") ?? "";
  const next = ALLOWED_NEXT.has(nextRaw) ? nextRaw : null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (next) return NextResponse.redirect(`${origin}${next}`);
        const { count } = await supabase.from("shop_members")
          .select("id", { count: "exact", head: true }).eq("user_id", user.id);
        return NextResponse.redirect(`${origin}${count ? "/dashboard" : "/onboarding"}`);
      }
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
