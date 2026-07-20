"use client";
// รีเฟรชอัตโนมัติเมื่อสถานะเอกสารเปลี่ยน (ประมวลผลเสร็จ/ล้มเหลว) — ไม่ต้องกด reload เอง
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function KnowledgeLive({ shopId }: { shopId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`kdocs-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_documents", filter: `shop_id=eq.${shopId}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId, router]);
  return null;
}
