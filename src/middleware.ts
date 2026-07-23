import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // OAuth (Facebook/Google) บางกรณี redirect กลับมาที่หน้าแรกพร้อม ?code= — ส่งต่อไป exchange ที่ callback ให้จบ flow
  if (path === "/") {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      return NextResponse.redirect(new URL(`/auth/callback?code=${encodeURIComponent(code)}`, request.url));
    }
    // ล็อกอินอยู่แล้วไม่ต้องเห็นหน้าขาย — เข้าแดชบอร์ดเลย
    if (user) return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isProtected = path.startsWith("/dashboard") || path.startsWith("/onboarding");
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (path === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
