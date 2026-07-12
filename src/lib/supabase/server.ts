import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Client ผูก session ผู้ใช้ (เคารพ RLS) — ใช้ใน Server Components / Actions */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* Server Component — middleware จะ refresh ให้ */ }
        },
      },
    },
  );
}

/** Service-role client (ข้าม RLS) — ใช้เฉพาะใน Server Actions ที่ตรวจสิทธิ์แล้วเท่านั้น */
export function createServiceClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
