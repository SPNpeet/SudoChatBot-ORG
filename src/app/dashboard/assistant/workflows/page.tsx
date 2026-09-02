// ============================================================
//  งานอัตโนมัติ (AI Auto Workflow) — 31 ส.ค. 2569 ตามมอคอัพ Sudo Financial OS
//  ทุกงานทำได้แค่ "เตรียมร่าง + แจ้ง" — คนยังเป็นผู้กดออกจริง/ส่งจริงเสมอ (ดู src/lib/workflows.ts)
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { PageHeader } from "@/components/ui";
import { Workflow } from "lucide-react";
import { WORKFLOW_MAX_PER_SHOP, type AiWorkflow, type WorkflowRun } from "@/lib/workflow-defs";
import WorkflowList from "./workflow-list";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const { supabase, shop, role } = await getCurrentShop();
  const [{ data: wfs }, { data: runs }, { data: contacts }] = await Promise.all([
    supabase.from("ai_workflows").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    supabase.from("ai_workflow_runs").select("id,workflow_id,dedupe_key,status,summary,ran_at").eq("shop_id", shop.id).order("ran_at", { ascending: false }).limit(30),
    supabase.from("contacts").select("id,name").eq("shop_id", shop.id).in("kind", ["customer", "both"]).order("name").limit(200),
  ]);
  const list = (wfs ?? []) as AiWorkflow[];
  const active = list.filter((w) => w.active).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader icon={Workflow} tone="teal"
        title="งานอัตโนมัติ"
        lead={<>เปิดอยู่ <b className="text-neutral-900">{active}</b> งาน จาก {WORKFLOW_MAX_PER_SHOP} — ระบบตรวจให้ทุกวัน แล้วเตรียมงานไว้ให้คุณกดยืนยัน</>}
        help="งานอัตโนมัติจะไม่ออกเอกสารจริง ไม่จ่ายเงิน และไม่ส่งข้อความหาลูกค้าเอง — มันทำได้แค่ “ร่าง” กับ “แจ้งคุณ” (ร่างใบแจ้งหนี้ต้องกดออกจริง ข้อความทวงต้องกดส่งเอง) · ทุกครั้งที่รันมีบันทึกด้านล่าง · งานจะถูกตรวจตอนคุณเปิดแดชบอร์ดครั้งแรกของวัน หรือกด “รันเดี๋ยวนี้”"
        back={{ href: "/dashboard/assistant", label: "กลับไปผู้ช่วย AI" }}
      />
      <WorkflowList shopId={shop.id} items={list} runs={(runs ?? []) as WorkflowRun[]}
        contacts={(contacts ?? []) as { id: string; name: string }[]} canManage={["owner", "admin"].includes(role)} />
    </div>
  );
}
