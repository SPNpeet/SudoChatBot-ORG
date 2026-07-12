import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase.from("shop_members")
          .select("id", { count: "exact", head: true }).eq("user_id", user.id);
        return NextResponse.redirect(`${origin}${count ? "/dashboard" : "/onboarding"}`);
      }
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
