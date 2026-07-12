import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Shop } from "@/lib/types/db";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** ร้านปัจจุบันของผู้ใช้ (ร้านแรกที่เป็นสมาชิก) + role */
export async function getCurrentShop() {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from("shop_members")
    .select("role, shops(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership?.shops) redirect("/onboarding");
  return {
    supabase, user,
    shop: membership.shops as unknown as Shop,
    role: membership.role as string,
  };
}

/** ตรวจว่า user เป็นสมาชิกร้าน (ใช้ก่อนทำงานด้วย service client เสมอ) */
export async function assertMember(shopId: string, roles?: string[]) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("shop_members")
    .select("role").eq("shop_id", shopId).eq("user_id", user.id).maybeSingle();
  if (!data) throw new Error("forbidden: not a member");
  if (roles && !roles.includes(data.role)) throw new Error("forbidden: insufficient role");
  return { user, role: data.role };
}
