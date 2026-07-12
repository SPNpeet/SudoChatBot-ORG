import Link from "next/link";
import { getCurrentShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, ShoppingBag, Package,
  BookOpen, Share2, Settings, LogOut,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/dashboard/chats", label: "แชท", icon: MessageSquare },
  { href: "/dashboard/orders", label: "ออเดอร์", icon: ShoppingBag },
  { href: "/dashboard/products", label: "สินค้า", icon: Package },
  { href: "/dashboard/knowledge", label: "คลังความรู้", icon: BookOpen },
  { href: "/dashboard/channels", label: "ช่องทาง", icon: Share2 },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: Settings },
];

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { shop } = await getCurrentShop();
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 flex w-56 flex-col border-r border-neutral-200 bg-white">
        <div className="px-5 py-5">
          <p className="text-sm font-bold">Sudo<span className="text-emerald-600">ChatBot</span></p>
          <p className="mt-0.5 truncate text-xs text-neutral-400">{shop.name}</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="border-t border-neutral-100 p-3">
          <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </button>
        </form>
      </aside>
      <main className="ml-56 flex-1 px-8 py-7">{children}</main>
    </div>
  );
}
