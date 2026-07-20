// ============================================================
//  AI ผู้จัดการร้าน (ERP Copilot) — สั่งงานทุกระบบของร้านจากแชทเดียว
//  หลัก: ทุก tool ผูก shop_id เสมอ · การแก้ไขทุกครั้งลง audit_logs ·
//  ไม่มี tool ลบข้อมูล/คืนเงิน/แตะเงินแพลตฟอร์ม (ชี้ไปหน้า UI แทน) ·
//  ข้อความที่ส่งถึงลูกค้าใช้เส้นทางคิวเดียวกับหน้าแชท (queue_send + kick)
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPENAI_COMPAT_BASE } from "@/lib/ai-catalog";
import { resolvePlaygroundConfig } from "../playground/engine";

export interface AssistantCtx {
  svc: SupabaseClient;
  shopId: string;
  shopName: string;
  userId: string;
  history: { role: "user" | "assistant"; content: string }[];
}

export interface AssistantResult {
  text: string;
  toolCalls: { name: string; label: string }[];
  model: string;
  input_tokens: number;
  output_tokens: number;
}

function kickWorker(fn: string) {
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch(() => {});
}

// วันธุรกิจไทย (UTC+7) — server รันเป็น UTC
function bkkDayStart(daysAgo = 0): string {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  bkk.setUTCHours(0, 0, 0, 0);
  return new Date(bkk.getTime() - 7 * 3600_000 - daysAgo * 86400_000).toISOString();
}

async function audit(ctx: AssistantCtx, action: string, resourceType: string, resourceId: string | null, details?: Record<string, unknown>) {
  await ctx.svc.from("audit_logs").insert({
    shop_id: ctx.shopId, actor_type: "user", actor_id: ctx.userId,
    action: `assistant_${action}`, resource_type: resourceType, resource_id: resourceId, details: details ?? {},
  });
}

// embedding สินค้าแบบ best-effort (ไม่มี key ก็ข้าม — keyword search ยังหาเจอ)
async function refreshProductEmbedding(svc: SupabaseClient, productId: string, name: string, description: string | null) {
  try {
    const { data: gemKey } = await svc.rpc("get_ai_key", { p_provider: "google" });
    const key = (gemKey as string | null) ?? process.env.GEMINI_API_KEY;
    if (!key) return;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: `${name}\n${description ?? ""}`.slice(0, 6000) }] },
          taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 1536,
        }),
      },
    );
    if (!res.ok) return;
    const j = await res.json();
    const v: number[] = j.embedding?.values ?? [];
    if (!v.length) return;
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    await svc.from("products").update({ embedding: JSON.stringify(v.map((x) => x / norm)) }).eq("id", productId);
  } catch { /* best-effort */ }
}

// ส่งข้อความถึงลูกค้าผ่านคิวเดียวกับหน้าแชท — tag ใส่เมื่อเป็นเรื่องหลังการซื้อ (นอกหน้าต่าง 24 ชม.)
async function queueCustomerMessage(
  ctx: AssistantCtx, conversationId: string, channelId: string,
  platform: string, platformUserId: string, text: string, tag?: "POST_PURCHASE_UPDATE",
) {
  await ctx.svc.rpc("queue_send", {
    p_queue: "outbound_messages",
    p_msg: {
      shop_id: ctx.shopId, channel_id: channelId, conversation_id: conversationId,
      platform, platform_user_id: platformUserId,
      messages: [{ type: "text", text }], attempt: 1, ...(tag ? { tag } : {}),
    },
  });
  kickWorker("queue-worker");
}

// ---------- tools ----------
const TOOLS = [
  {
    name: "get_overview",
    description: "ภาพรวมร้านตอนนี้: ยอดขายวันนี้/เดือนนี้ ออเดอร์ค้างแต่ละสถานะ แชทที่รอแอดมิน เครดิต แพ็กเกจ ช่องทางที่เชื่อม",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_orders",
    description: "ค้นหาออเดอร์ด้วยเลขออเดอร์/ชื่อผู้รับ หรือกรองตามสถานะ (pending_payment=รอจ่าย, paid=จ่ายแล้วรอส่ง, shipped=ส่งแล้ว, completed=จบ, cancelled=ยกเลิก)",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "เลขออเดอร์หรือชื่อผู้รับ (เว้นว่าง = ล่าสุด)" },
        status: { type: "string", description: "กรองสถานะ (เว้นว่าง = ทุกสถานะ)" },
      },
    },
  },
  {
    name: "get_order",
    description: "ดูรายละเอียดออเดอร์เต็ม (รายการสินค้า ยอด ที่อยู่ เลขพัสดุ สถานะจ่ายเงิน) ด้วยเลขออเดอร์",
    input_schema: { type: "object", properties: { order_number: { type: "string" } }, required: ["order_number"] },
  },
  {
    name: "mark_order_shipped",
    description: "บันทึกจัดส่ง + ใส่เลขพัสดุ + แจ้งลูกค้าอัตโนมัติทางแชท (ออเดอร์ต้องจ่ายเงินแล้ว)",
    input_schema: {
      type: "object",
      properties: { order_number: { type: "string" }, tracking_number: { type: "string" } },
      required: ["order_number", "tracking_number"],
    },
  },
  {
    name: "verify_order_payment",
    description: "ยืนยันการชำระเงินของออเดอร์ที่รอตรวจ (อนุมัติ = ตัดสต๊อก+แจ้งลูกค้า / ปฏิเสธ = แจ้งลูกค้าส่งสลิปใหม่)",
    input_schema: {
      type: "object",
      properties: { order_number: { type: "string" }, approve: { type: "boolean" } },
      required: ["order_number", "approve"],
    },
  },
  {
    name: "list_waiting_chats",
    description: "ดูแชทที่รอแอดมินตอบ (โหมด human) พร้อมข้อความล่าสุดของลูกค้า",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_chat",
    description: "อ่านบทสนทนากับลูกค้า 15 ข้อความล่าสุด (ใช้ก่อนสั่งตอบ เพื่อให้ตอบตรงเรื่อง)",
    input_schema: { type: "object", properties: { conversation_id: { type: "string" } }, required: ["conversation_id"] },
  },
  {
    name: "reply_to_customer",
    description: "ส่งข้อความตอบลูกค้าในแชท (ส่งในนามแอดมินร้าน) — ใช้หลังอ่านบทสนทนาด้วย get_chat แล้ว",
    input_schema: {
      type: "object",
      properties: { conversation_id: { type: "string" }, text: { type: "string", description: "ข้อความถึงลูกค้า" } },
      required: ["conversation_id", "text"],
    },
  },
  {
    name: "set_chat_mode",
    description: "สลับโหมดแชท: bot = ให้บอทตอบต่อ / human = ปิดบอทให้แอดมินตอบเอง",
    input_schema: {
      type: "object",
      properties: { conversation_id: { type: "string" }, mode: { type: "string", enum: ["bot", "human"] } },
      required: ["conversation_id", "mode"],
    },
  },
  {
    name: "search_products",
    description: "ค้นสินค้าในร้านด้วยชื่อ/SKU ดู id ราคา สต๊อก สถานะ",
    input_schema: { type: "object", properties: { query: { type: "string", description: "เว้นว่าง = ล่าสุด 15 ตัว" } } },
  },
  {
    name: "update_product",
    description: "แก้สินค้า: ราคา สต๊อก ชื่อ รายละเอียด หรือเปิด/ปิดการขาย (status: active/hidden)",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        price: { type: "number" }, stock: { type: "number" },
        name: { type: "string" }, description: { type: "string" },
        status: { type: "string", enum: ["active", "hidden"] },
      },
      required: ["product_id"],
    },
  },
  {
    name: "create_product",
    description: "เพิ่มสินค้าใหม่เข้าร้าน (ขึ้นขายทันที บอทเห็นเลย)",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" }, price: { type: "number" },
        stock: { type: "number", description: "ไม่ระบุ = ไม่จำกัด (ไม่ track สต๊อก)" },
        description: { type: "string" }, sku: { type: "string" },
      },
      required: ["name", "price"],
    },
  },
  {
    name: "get_bot_settings",
    description: "ดูการตั้งค่าบอทปัจจุบันทั้งหมด (ชื่อ บุคลิก คำทักทาย คำสั่งพิเศษ ระบบคอมเมนต์ ฯลฯ) — เรียกก่อนแก้เสมอ",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_bot_settings",
    description: "ปรับการตั้งค่าบอทขาย: เปิด/ปิด ชื่อ บุคลิก คำทักทาย คำสั่งพิเศษ โหมดปิดการขาย ตอบคอมเมนต์ ฯลฯ (ส่งเฉพาะช่องที่จะแก้)",
    input_schema: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "เปิด/ปิดบอททั้งร้าน" },
        persona_name: { type: "string" },
        tone: { type: "string", enum: ["friendly", "formal", "playful"] },
        greeting: { type: "string", description: "คำทักทายลูกค้าใหม่" },
        custom_instructions: { type: "string", description: "คำสั่งพิเศษจากเจ้าของร้าน เช่น โปรโมชั่น วิธีตอบ" },
        auto_close_sale: { type: "boolean", description: "ให้บอทสรุปออเดอร์+ส่ง QR เองได้" },
        upsell_enabled: { type: "boolean" },
        fallback_message: { type: "string" },
        handoff_keywords: { type: "array", items: { type: "string" }, description: "คำที่ลูกค้าพิมพ์แล้วส่งต่อแอดมิน" },
        comment_reply_enabled: { type: "boolean", description: "บอทตอบคอมเมนต์ FB/IG แล้วทัก inbox" },
        comment_public_reply: { type: "string", description: "ข้อความตอบใต้คอมเมนต์ (ว่าง = ไม่ตอบสาธารณะ)" },
        comment_keywords: { type: "array", items: { type: "string" }, description: "ตอบเฉพาะคอมเมนต์ที่มีคำเหล่านี้ (ว่าง = ทุกคอมเมนต์)" },
        model_tier: { type: "string", enum: ["economy", "standard", "premium"] },
      },
    },
  },
  {
    name: "update_shop_info",
    description: "แก้ชื่อร้านหรือคำอธิบายร้าน (คำอธิบายถูกใช้ในสมองของบอทขายด้วย)",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" }, description: { type: "string" } },
    },
  },
  {
    name: "update_payment_settings",
    description: "ตั้งค่ารับเงิน: พร้อมเพย์ ชื่อบัญชี ธนาคาร และตัวเลือกค่าส่ง (ส่งเฉพาะช่องที่จะแก้)",
    input_schema: {
      type: "object",
      properties: {
        promptpay_id: { type: "string", description: "เบอร์มือถือหรือเลขบัตรประชาชน" },
        account_name: { type: "string" }, bank_name: { type: "string" },
        shipping_options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" }, fee: { type: "number" },
              free_over: { type: "number", description: "ฟรีเมื่อยอดครบ (ไม่ระบุ = ไม่มีฟรี)" },
            },
            required: ["name", "fee"],
          },
        },
      },
    },
  },
  {
    name: "add_knowledge",
    description: "เพิ่มข้อมูลเข้าคลังความรู้ของบอท (นโยบายร้าน โปรโมชั่น วิธีใช้สินค้า ฯลฯ) — บอทใช้ตอบลูกค้าได้ในไม่กี่นาที",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, content: { type: "string" } },
      required: ["title", "content"],
    },
  },
  {
    name: "get_analytics",
    description: "สถิติย้อนหลัง: ยอดขาย จำนวนออเดอร์ สินค้าขายดี ค่า AI ที่ใช้ จำนวนข้อความบอทตอบ",
    input_schema: { type: "object", properties: { days: { type: "number", description: "กี่วันย้อนหลัง (1-90, ค่าเริ่ม 7)" } } },
  },
  {
    name: "get_billing_status",
    description: "ดูเครดิตคงเหลือ แพ็กเกจ โควตาที่ใช้ไปเดือนนี้ และรายการเงินล่าสุด",
    input_schema: { type: "object", properties: {} },
  },
];

export const ASSISTANT_TOOL_LABEL_TH: Record<string, string> = {
  get_overview: "ดูภาพรวมร้าน", search_orders: "ค้นออเดอร์", get_order: "เปิดออเดอร์",
  mark_order_shipped: "บันทึกจัดส่ง+แจ้งลูกค้า", verify_order_payment: "ยืนยันยอดเงิน",
  list_waiting_chats: "ดูแชทรอตอบ", get_chat: "อ่านแชท", reply_to_customer: "ตอบลูกค้า",
  set_chat_mode: "สลับโหมดแชท", search_products: "ค้นสินค้า", update_product: "แก้สินค้า",
  create_product: "เพิ่มสินค้า", get_bot_settings: "ดูตั้งค่าบอท", update_bot_settings: "ปรับบอท",
  update_shop_info: "แก้ข้อมูลร้าน", update_payment_settings: "ตั้งค่ารับเงิน",
  add_knowledge: "เพิ่มคลังความรู้", get_analytics: "ดูสถิติ", get_billing_status: "เช็คเครดิต",
};

async function executeTool(ctx: AssistantCtx, name: string, input: Record<string, unknown>): Promise<string> {
  const s = ctx.svc;
  try {
    switch (name) {
      // ================= อ่านข้อมูล =================
      case "get_overview": {
        const today = bkkDayStart();
        const month = bkkDayStart(29);
        const [ordersToday, ordersMonth, byStatus, waiting, wallet, shopPlan, channels] = await Promise.all([
          s.from("orders").select("total,status,paid_at").eq("shop_id", ctx.shopId).gte("paid_at", today),
          s.from("orders").select("total,status,paid_at").eq("shop_id", ctx.shopId).gte("paid_at", month),
          s.from("orders").select("status").eq("shop_id", ctx.shopId).in("status", ["pending_payment", "paid", "confirmed", "shipped"]),
          s.from("conversations").select("id", { count: "exact", head: true }).eq("shop_id", ctx.shopId).eq("status", "human"),
          s.from("wallets").select("balance").eq("shop_id", ctx.shopId).maybeSingle(),
          s.from("shops").select("plan").eq("id", ctx.shopId).single(),
          s.from("channels").select("platform,page_name,status").eq("shop_id", ctx.shopId),
        ]);
        const paidStatuses = ["paid", "confirmed", "shipped", "completed"];
        const sum = (rows: { total: unknown; status: string }[] | null) =>
          (rows ?? []).filter((o) => paidStatuses.includes(o.status)).reduce((a, o) => a + Number(o.total ?? 0), 0);
        const counts: Record<string, number> = {};
        for (const o of byStatus.data ?? []) counts[o.status] = (counts[o.status] ?? 0) + 1;
        const period = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
        const [{ data: usage }, { data: plan }] = await Promise.all([
          s.from("usage_monthly").select("replies_count").eq("shop_id", ctx.shopId).eq("period", period).maybeSingle(),
          s.from("plans").select("name,included_replies").eq("code", shopPlan.data?.plan ?? "free").maybeSingle(),
        ]);
        return JSON.stringify({
          sales_today_thb: sum(ordersToday.data), sales_30d_thb: sum(ordersMonth.data),
          orders_waiting: { รอจ่ายเงิน: counts.pending_payment ?? 0, จ่ายแล้วรอส่ง: (counts.paid ?? 0) + (counts.confirmed ?? 0), ส่งแล้ว: counts.shipped ?? 0 },
          chats_waiting_admin: waiting.count ?? 0,
          credit_balance_thb: Number(wallet.data?.balance ?? 0),
          plan: { code: shopPlan.data?.plan, name: plan?.name, replies_used_this_month: usage?.replies_count ?? 0, included_replies: plan?.included_replies },
          channels: (channels.data ?? []).map((c) => ({ platform: c.platform, page: c.page_name, status: c.status })),
        });
      }
      case "search_orders": {
        let q = s.from("orders")
          .select("order_number,status,total,shipping_name,tracking_number,created_at")
          .eq("shop_id", ctx.shopId).order("created_at", { ascending: false }).limit(20);
        const query = String(input.query ?? "").trim();
        const status = String(input.status ?? "").trim();
        if (status) q = q.eq("status", status);
        if (query) q = q.or(`order_number.ilike.%${query.replace(/[%,()]/g, "")}%,shipping_name.ilike.%${query.replace(/[%,()]/g, "")}%`);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data?.length ? data : { message: "ไม่พบออเดอร์" });
      }
      case "get_order": {
        const { data: o } = await s.from("orders")
          .select("id,order_number,status,subtotal,shipping_fee,total,shipping_method,shipping_name,shipping_phone,shipping_address,tracking_number,paid_at,created_at,conversation_id")
          .eq("shop_id", ctx.shopId).eq("order_number", String(input.order_number ?? "").trim()).maybeSingle();
        if (!o) return JSON.stringify({ error: "ไม่พบออเดอร์นี้" });
        const [{ data: items }, { data: pay }] = await Promise.all([
          s.from("order_items").select("product_name,variant_name,unit_price,quantity,total").eq("order_id", o.id),
          s.from("payments").select("status,amount,verified_by,created_at").eq("order_id", o.id).order("created_at", { ascending: false }).limit(3),
        ]);
        return JSON.stringify({ ...o, id: undefined, items: items ?? [], payments: pay ?? [] });
      }
      // ================= ออเดอร์ (เขียน) =================
      case "mark_order_shipped": {
        const num = String(input.order_number ?? "").trim();
        const tracking = String(input.tracking_number ?? "").trim().slice(0, 60);
        if (!num || !tracking) return JSON.stringify({ error: "ต้องมีเลขออเดอร์และเลขพัสดุ" });
        const { data: o } = await s.from("orders").select("id,status,order_number").eq("shop_id", ctx.shopId).eq("order_number", num).maybeSingle();
        if (!o) return JSON.stringify({ error: "ไม่พบออเดอร์นี้" });
        if (o.status === "shipped" || o.status === "completed") return JSON.stringify({ error: `ออเดอร์นี้จัดส่งแล้ว (เลขเดิมยังอยู่ ถ้าจะแก้เลขให้แจ้งใหม่ชัดๆ)` });
        if (!["paid", "confirmed"].includes(o.status)) return JSON.stringify({ error: `สถานะปัจจุบัน ${o.status} — ต้องจ่ายเงินก่อนถึงจัดส่งได้` });
        await s.from("orders").update({ status: "shipped", tracking_number: tracking }).eq("id", o.id).eq("shop_id", ctx.shopId);
        const { data: full } = await s.from("orders")
          .select("order_number, channel_id, conversation_id, channels(platform), customers(platform_user_id)")
          .eq("id", o.id).single();
        if (full?.conversation_id && full.channel_id) {
          const ch = full.channels as unknown as { platform: string };
          const cu = full.customers as unknown as { platform_user_id: string };
          await queueCustomerMessage(ctx, full.conversation_id, full.channel_id, ch.platform, cu.platform_user_id,
            `ร้านจัดส่งออเดอร์ ${full.order_number} แล้วค่ะ 📦\nเลขพัสดุ: ${tracking} ขอบคุณที่อุดหนุนนะคะ`, "POST_PURCHASE_UPDATE");
        }
        await audit(ctx, "order_shipped", "order", o.id, { order_number: num, tracking });
        return JSON.stringify({ ok: true, note: `บันทึกจัดส่ง ${num} แล้ว และแจ้งลูกค้าให้แล้ว` });
      }
      case "verify_order_payment": {
        const num = String(input.order_number ?? "").trim();
        const approve = Boolean(input.approve);
        const { data: o } = await s.from("orders")
          .select("id,order_number,status,conversation_id,channel_id,channels(platform),customers(platform_user_id)")
          .eq("shop_id", ctx.shopId).eq("order_number", num).maybeSingle();
        if (!o) return JSON.stringify({ error: "ไม่พบออเดอร์นี้" });
        const { data: pay } = await s.from("payments").select("id,status").eq("order_id", o.id).eq("status", "pending")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!pay) return JSON.stringify({ error: o.status === "paid" ? "ออเดอร์นี้ยืนยันเงินไปแล้ว" : "ไม่มีรายการชำระเงินที่รอตรวจสำหรับออเดอร์นี้" });
        if (approve) {
          await s.from("payments").update({ status: "verified", verified_by: "manual", verified_at: new Date().toISOString(), verifier_id: ctx.userId }).eq("id", pay.id);
          await s.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", o.id);
          const { data: items } = await s.from("order_items").select("product_id,variant_id,quantity").eq("order_id", o.id);
          for (const it of items ?? []) {
            if (it.product_id) await s.rpc("decrement_stock", { p_product_id: it.product_id, p_variant_id: it.variant_id, p_qty: it.quantity });
          }
        } else {
          await s.from("payments").update({ status: "rejected", verified_by: "manual", verifier_id: ctx.userId }).eq("id", pay.id);
        }
        if (o.conversation_id && o.channel_id) {
          const ch = o.channels as unknown as { platform: string };
          const cu = o.customers as unknown as { platform_user_id: string };
          await queueCustomerMessage(ctx, o.conversation_id, o.channel_id, ch.platform, cu.platform_user_id,
            approve
              ? `ยืนยันการชำระเงินออเดอร์ ${o.order_number} เรียบร้อยค่ะ ✅ ร้านจะรีบจัดส่งให้เร็วที่สุดนะคะ ขอบคุณค่ะ`
              : `ขออภัยค่ะ การตรวจสอบสลิปออเดอร์ ${o.order_number} ไม่ผ่าน รบกวนติดต่อแอดมินหรือส่งสลิปที่ถูกต้องอีกครั้งนะคะ`,
            "POST_PURCHASE_UPDATE");
        }
        await audit(ctx, approve ? "payment_verified" : "payment_rejected", "payment", pay.id, { order_number: num });
        return JSON.stringify({ ok: true, note: approve ? `ยืนยันเงิน ${num} แล้ว ตัดสต๊อกแล้ว แจ้งลูกค้าแล้ว` : `ปฏิเสธสลิป ${num} และแจ้งลูกค้าแล้ว` });
      }
      // ================= แชทลูกค้า =================
      case "list_waiting_chats": {
        const { data } = await s.from("conversations")
          .select("id, status, last_message_at, customers(display_name)")
          .eq("shop_id", ctx.shopId).eq("status", "human")
          .order("last_message_at", { ascending: false }).limit(15);
        if (!data?.length) return JSON.stringify({ message: "ไม่มีแชทที่รอแอดมินตอบ" });
        const out = [];
        for (const c of data) {
          const { data: last } = await s.from("messages").select("content,direction").eq("conversation_id", c.id)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          const cu = c.customers as unknown as { display_name?: string } | null;
          out.push({ conversation_id: c.id, customer: cu?.display_name ?? "ลูกค้า", last_message: (last?.content ?? "").slice(0, 120), last_at: c.last_message_at });
        }
        return JSON.stringify(out);
      }
      case "get_chat": {
        const convId = String(input.conversation_id ?? "").trim();
        const { data: conv } = await s.from("conversations").select("id,status,bot_enabled,customers(display_name)").eq("id", convId).eq("shop_id", ctx.shopId).maybeSingle();
        if (!conv) return JSON.stringify({ error: "ไม่พบบทสนทนานี้ในร้าน" });
        const { data: msgs } = await s.from("messages")
          .select("direction,sender_type,content,content_type,created_at").eq("conversation_id", convId)
          .order("created_at", { ascending: false }).limit(15);
        const cu = conv.customers as unknown as { display_name?: string } | null;
        return JSON.stringify({
          customer: cu?.display_name ?? "ลูกค้า", mode: conv.status, bot_enabled: conv.bot_enabled,
          messages: (msgs ?? []).reverse().map((m) => ({
            from: m.direction === "inbound" ? "ลูกค้า" : m.sender_type === "bot" ? "บอท" : "แอดมิน",
            text: m.content ?? `[${m.content_type}]`, at: m.created_at,
          })),
        });
      }
      case "reply_to_customer": {
        const convId = String(input.conversation_id ?? "").trim();
        const text = String(input.text ?? "").trim().slice(0, 1900);
        if (!text) return JSON.stringify({ error: "ข้อความว่าง" });
        const { data: conv } = await s.from("conversations")
          .select("id, channel_id, channels(platform), customers(platform_user_id)")
          .eq("id", convId).eq("shop_id", ctx.shopId).maybeSingle();
        if (!conv) return JSON.stringify({ error: "ไม่พบบทสนทนานี้ในร้าน" });
        const channel = conv.channels as unknown as { platform: string };
        const customer = conv.customers as unknown as { platform_user_id: string };
        await s.from("messages").insert({
          shop_id: ctx.shopId, conversation_id: convId,
          direction: "outbound", sender_type: "agent", content_type: "text",
          content: text, status: "queued",
        });
        await queueCustomerMessage(ctx, convId, conv.channel_id, channel.platform, customer.platform_user_id, text);
        await s.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
        await audit(ctx, "replied_customer", "conversation", convId, { text: text.slice(0, 200) });
        return JSON.stringify({ ok: true, note: "ส่งข้อความถึงลูกค้าแล้ว" });
      }
      case "set_chat_mode": {
        const convId = String(input.conversation_id ?? "").trim();
        const mode = input.mode === "bot" ? "bot" : "human";
        const { data: conv } = await s.from("conversations").select("id").eq("id", convId).eq("shop_id", ctx.shopId).maybeSingle();
        if (!conv) return JSON.stringify({ error: "ไม่พบบทสนทนานี้ในร้าน" });
        await s.from("conversations").update({ status: mode === "bot" ? "bot" : "human" }).eq("id", convId);
        await audit(ctx, "chat_mode_changed", "conversation", convId, { mode });
        return JSON.stringify({ ok: true, note: mode === "bot" ? "เปิดให้บอทตอบต่อแล้ว" : "ปิดบอทแชทนี้แล้ว แอดมินตอบเอง" });
      }
      // ================= สินค้า =================
      case "search_products": {
        const query = String(input.query ?? "").trim();
        let q = s.from("products").select("id,name,sku,price,stock,track_stock,status")
          .eq("shop_id", ctx.shopId).neq("status", "archived")
          .order("created_at", { ascending: false }).limit(15);
        if (query) q = q.or(`name.ilike.%${query.replace(/[%,()]/g, "")}%,sku.ilike.%${query.replace(/[%,()]/g, "")}%`);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data?.length
          ? data.map((p) => ({ ...p, stock: p.track_stock ? p.stock : "ไม่จำกัด" }))
          : { message: "ไม่พบสินค้า" });
      }
      case "update_product": {
        const pid = String(input.product_id ?? "").trim();
        const { data: p } = await s.from("products").select("id,name,description,price,stock,status").eq("id", pid).eq("shop_id", ctx.shopId).maybeSingle();
        if (!p) return JSON.stringify({ error: "ไม่พบสินค้านี้ในร้าน (ใช้ id จาก search_products)" });
        const patch: Record<string, unknown> = {};
        if (input.price != null) {
          const price = Number(input.price);
          if (!(price >= 0)) return JSON.stringify({ error: "ราคาต้องเป็นตัวเลข ≥ 0" });
          patch.price = price;
        }
        if (input.stock != null) {
          const stock = Math.floor(Number(input.stock));
          if (!(stock >= 0)) return JSON.stringify({ error: "สต๊อกต้องเป็นตัวเลข ≥ 0" });
          patch.stock = stock; patch.track_stock = true;
        }
        if (typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim().slice(0, 200);
        if (typeof input.description === "string") patch.description = input.description.slice(0, 4000);
        if (input.status === "active" || input.status === "hidden") patch.status = input.status;
        if (!Object.keys(patch).length) return JSON.stringify({ error: "ไม่มีช่องที่จะแก้" });
        patch.updated_at = new Date().toISOString();
        const { error } = await s.from("products").update(patch).eq("id", pid).eq("shop_id", ctx.shopId);
        if (error) return JSON.stringify({ error: error.message });
        if (patch.name || patch.description !== undefined) {
          await refreshProductEmbedding(s, pid, String(patch.name ?? p.name), String(patch.description ?? p.description ?? ""));
        }
        await audit(ctx, "product_updated", "product", pid, { changed: Object.keys(patch), name: p.name });
        return JSON.stringify({ ok: true, note: `แก้ "${p.name}" แล้ว: ${Object.keys(patch).filter((k) => k !== "updated_at").join(", ")}` });
      }
      case "create_product": {
        const name = String(input.name ?? "").trim().slice(0, 200);
        const price = Number(input.price);
        if (!name || !(price >= 0)) return JSON.stringify({ error: "ต้องมีชื่อสินค้าและราคา ≥ 0" });
        const hasStock = input.stock != null;
        const { data: created, error } = await s.from("products").insert({
          shop_id: ctx.shopId, name, price,
          stock: hasStock ? Math.max(0, Math.floor(Number(input.stock))) : 0,
          track_stock: hasStock,
          description: typeof input.description === "string" ? input.description.slice(0, 4000) : null,
          sku: typeof input.sku === "string" && input.sku.trim() ? input.sku.trim().slice(0, 60) : null,
          status: "active",
        }).select("id").single();
        if (error || !created) return JSON.stringify({ error: error?.message ?? "สร้างไม่สำเร็จ" });
        await refreshProductEmbedding(s, created.id, name, typeof input.description === "string" ? input.description : null);
        await audit(ctx, "product_created", "product", created.id, { name, price });
        return JSON.stringify({ ok: true, product_id: created.id, note: `เพิ่ม "${name}" ราคา ${price} บาท ขึ้นขายแล้ว` });
      }
      // ================= ตั้งค่าบอท/ร้าน =================
      case "get_bot_settings": {
        const { data } = await s.from("bot_settings").select("enabled,persona_name,tone,language,greeting,custom_instructions,auto_close_sale,upsell_enabled,model_tier,fallback_message,handoff_keywords,comment_reply_enabled,comment_public_reply,comment_keywords").eq("shop_id", ctx.shopId).maybeSingle();
        return JSON.stringify(data ?? { message: "ยังไม่มีการตั้งค่าบอท" });
      }
      case "update_bot_settings": {
        const patch: Record<string, unknown> = {};
        if (typeof input.enabled === "boolean") patch.enabled = input.enabled;
        if (typeof input.persona_name === "string" && input.persona_name.trim()) patch.persona_name = input.persona_name.trim().slice(0, 60);
        if (input.tone === "friendly" || input.tone === "formal" || input.tone === "playful") patch.tone = input.tone;
        if (typeof input.greeting === "string") patch.greeting = input.greeting.slice(0, 500) || null;
        if (typeof input.custom_instructions === "string") patch.custom_instructions = input.custom_instructions.slice(0, 3000) || null;
        if (typeof input.auto_close_sale === "boolean") patch.auto_close_sale = input.auto_close_sale;
        if (typeof input.upsell_enabled === "boolean") patch.upsell_enabled = input.upsell_enabled;
        if (typeof input.fallback_message === "string" && input.fallback_message.trim()) patch.fallback_message = input.fallback_message.trim().slice(0, 500);
        if (Array.isArray(input.handoff_keywords)) patch.handoff_keywords = input.handoff_keywords.map(String).map((k) => k.trim()).filter(Boolean).slice(0, 20);
        if (typeof input.comment_reply_enabled === "boolean") patch.comment_reply_enabled = input.comment_reply_enabled;
        if (typeof input.comment_public_reply === "string") patch.comment_public_reply = input.comment_public_reply.slice(0, 300) || null;
        if (Array.isArray(input.comment_keywords)) patch.comment_keywords = input.comment_keywords.map(String).map((k) => k.trim()).filter(Boolean).slice(0, 20);
        if (input.model_tier === "economy" || input.model_tier === "standard" || input.model_tier === "premium") patch.model_tier = input.model_tier;
        if (!Object.keys(patch).length) return JSON.stringify({ error: "ไม่มีช่องที่จะแก้" });
        const { error } = await s.from("bot_settings").update(patch).eq("shop_id", ctx.shopId);
        if (error) return JSON.stringify({ error: error.message });
        await audit(ctx, "bot_settings_updated", "bot_settings", ctx.shopId, { changed: Object.keys(patch) });
        return JSON.stringify({ ok: true, note: `ปรับบอทแล้ว: ${Object.keys(patch).join(", ")} — มีผลกับแชทถัดไปทันที` });
      }
      case "update_shop_info": {
        const patch: Record<string, unknown> = {};
        if (typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim().slice(0, 100);
        if (typeof input.description === "string") patch.description = input.description.slice(0, 2000) || null;
        if (!Object.keys(patch).length) return JSON.stringify({ error: "ไม่มีช่องที่จะแก้" });
        const { error } = await s.from("shops").update(patch).eq("id", ctx.shopId);
        if (error) return JSON.stringify({ error: error.message });
        await audit(ctx, "shop_info_updated", "shop", ctx.shopId, { changed: Object.keys(patch) });
        return JSON.stringify({ ok: true, note: "อัปเดตข้อมูลร้านแล้ว" });
      }
      case "update_payment_settings": {
        const patch: Record<string, unknown> = {};
        if (typeof input.promptpay_id === "string") {
          const digits = input.promptpay_id.replace(/[^0-9]/g, "");
          if (digits && digits.length !== 10 && digits.length !== 13) {
            return JSON.stringify({ error: "พร้อมเพย์ต้องเป็นเบอร์ 10 หลักหรือบัตรประชาชน 13 หลัก" });
          }
          patch.promptpay_id = digits || null;
        }
        if (typeof input.account_name === "string") patch.account_name = input.account_name.trim().slice(0, 100) || null;
        if (typeof input.bank_name === "string") patch.bank_name = input.bank_name.trim().slice(0, 60) || null;
        if (Array.isArray(input.shipping_options)) {
          const opts = (input.shipping_options as Record<string, unknown>[])
            .filter((o) => o && typeof o.name === "string" && (o.name as string).trim() && Number(o.fee) >= 0)
            .slice(0, 10)
            .map((o) => ({
              name: (o.name as string).trim().slice(0, 60), fee: Number(o.fee),
              ...(Number(o.free_over) > 0 ? { free_over: Number(o.free_over) } : {}),
            }));
          patch.shipping_options = opts;
        }
        if (!Object.keys(patch).length) return JSON.stringify({ error: "ไม่มีช่องที่จะแก้" });
        const { error } = await s.from("shop_payment_settings").upsert({ shop_id: ctx.shopId, ...patch }, { onConflict: "shop_id" });
        if (error) return JSON.stringify({ error: error.message });
        await audit(ctx, "payment_settings_updated", "shop_payment_settings", ctx.shopId, { changed: Object.keys(patch) });
        return JSON.stringify({ ok: true, note: "บันทึกการตั้งค่ารับเงินแล้ว — บอทใช้ค่าใหม่ทันที" });
      }
      case "add_knowledge": {
        const title = String(input.title ?? "").trim().slice(0, 200);
        const content = String(input.content ?? "").trim().slice(0, 20000);
        if (!title || !content) return JSON.stringify({ error: "ต้องมีหัวข้อและเนื้อหา" });
        const { data: doc, error } = await s.from("knowledge_documents").insert({
          shop_id: ctx.shopId, title, source_type: "text", raw_text: content, status: "pending",
        }).select("id").single();
        if (error || !doc) return JSON.stringify({ error: error?.message ?? "บันทึกไม่สำเร็จ" });
        await s.rpc("queue_send", { p_queue: "document_processing", p_msg: { document_id: doc.id, shop_id: ctx.shopId } });
        kickWorker("doc-processor");
        await audit(ctx, "knowledge_added", "knowledge_document", doc.id, { title });
        return JSON.stringify({ ok: true, note: `เพิ่ม "${title}" เข้าคลังความรู้แล้ว ระบบกำลังประมวลผล บอทใช้ตอบได้ในไม่กี่นาที` });
      }
      // ================= สถิติ/เงิน =================
      case "get_analytics": {
        const days = Math.min(90, Math.max(1, Math.floor(Number(input.days) || 7)));
        const since = bkkDayStart(days - 1);
        const [{ data: orders }, { data: aiLogs }] = await Promise.all([
          s.from("orders").select("id,total,status,paid_at").eq("shop_id", ctx.shopId).gte("paid_at", since),
          s.from("ai_usage_logs").select("purpose,cost_usd").eq("shop_id", ctx.shopId).gte("created_at", since),
        ]);
        const paid = (orders ?? []).filter((o) => ["paid", "confirmed", "shipped", "completed"].includes(o.status));
        const orderIds = paid.map((o) => o.id);
        let top: { product: string; qty: number; sales: number }[] = [];
        if (orderIds.length) {
          const { data: items } = await s.from("order_items").select("product_name,quantity,total").in("order_id", orderIds.slice(0, 500));
          const agg = new Map<string, { qty: number; sales: number }>();
          for (const it of items ?? []) {
            const cur = agg.get(it.product_name) ?? { qty: 0, sales: 0 };
            agg.set(it.product_name, { qty: cur.qty + Number(it.quantity ?? 0), sales: cur.sales + Number(it.total ?? 0) });
          }
          top = [...agg.entries()].map(([product, v]) => ({ product, ...v })).sort((a, b) => b.sales - a.sales).slice(0, 5);
        }
        const replies = (aiLogs ?? []).filter((l) => l.purpose === "reply").length;
        const aiCost = (aiLogs ?? []).reduce((a, l) => a + Number(l.cost_usd ?? 0), 0);
        return JSON.stringify({
          period_days: days,
          sales_thb: paid.reduce((a, o) => a + Number(o.total ?? 0), 0),
          paid_orders: paid.length,
          top_products: top,
          bot_replies: replies,
          ai_cost_usd: +aiCost.toFixed(4),
        });
      }
      case "get_billing_status": {
        const [{ data: wallet }, { data: shopPlan }, { data: txns }] = await Promise.all([
          s.from("wallets").select("balance").eq("shop_id", ctx.shopId).maybeSingle(),
          s.from("shops").select("plan").eq("id", ctx.shopId).single(),
          s.from("wallet_transactions").select("type,amount,note,created_at").eq("shop_id", ctx.shopId).order("created_at", { ascending: false }).limit(5),
        ]);
        const period = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
        const [{ data: usage }, { data: plan }] = await Promise.all([
          s.from("usage_monthly").select("replies_count,billed_replies,billed_amount").eq("shop_id", ctx.shopId).eq("period", period).maybeSingle(),
          s.from("plans").select("name,monthly_price,included_replies,price_per_extra_reply").eq("code", shopPlan?.plan ?? "free").maybeSingle(),
        ]);
        return JSON.stringify({
          credit_balance_thb: Number(wallet?.balance ?? 0),
          plan: { code: shopPlan?.plan, ...plan },
          this_month: usage ?? { replies_count: 0 },
          recent_transactions: txns ?? [],
          note: "เติมเงิน/เปลี่ยนแพ็กเกจทำได้ที่หน้า แพ็กเกจ/เครดิต",
        });
      }
      default: return JSON.stringify({ error: "unknown tool" });
    }
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message.slice(0, 400) });
  }
}

// ---------- system prompt ----------
function buildSystemPrompt(ctx: AssistantCtx): string {
  const now = new Date(Date.now() + 7 * 3600_000);
  return `คุณคือ "ผู้จัดการร้าน AI" ของร้าน "${ctx.shopName}" — ผู้ช่วยคนสนิทของเจ้าของร้านที่สั่งงานได้ทุกระบบจากแชทเดียว: ออเดอร์ จัดส่ง ยืนยันเงิน สินค้า สต๊อก แชทลูกค้า ตั้งค่าบอทขาย คลังความรู้ สถิติ และเครดิต
วันนี้: ${now.toISOString().slice(0, 10)} (เวลาไทย)

## กติกาเหล็ก
1. ข้อมูลทุกอย่างต้องมาจาก tool เท่านั้น — ห้ามเดาตัวเลข ยอดขาย สต๊อก หรือสถานะใดๆ
2. คำสั่งที่ชัดเจนครบถ้วน (ระบุออเดอร์/สินค้า/ข้อความ/ตัวเลขครบ) ทำได้ทันทีแล้วรายงานผล — เจ้าของร้านสั่งเอง ไม่ต้องถามซ้ำ
3. คำสั่งที่กำกวมหรือข้อมูลไม่ครบ (เช่น "ลดราคาหน่อย" ไม่บอกเท่าไหร่, "ตอบลูกค้าคนนั้น" ไม่รู้คนไหน) — ค้นข้อมูลด้วย tool ก่อน แล้วทวนสิ่งที่จะทำให้ชัด 1 ครั้งค่อยลงมือ
4. ก่อนตอบลูกค้าแทนร้าน (reply_to_customer) ต้องอ่านบทสนทนาด้วย get_chat ก่อนเสมอ เพื่อตอบตรงเรื่อง
5. สิ่งที่ไม่มี tool ให้ทำ (ลบข้อมูล คืนเงิน เชื่อมช่องทางใหม่ เติมเงิน อัปเกรดแพ็กเกจ เชื่อมบัญชีโฆษณา) — บอกตรงๆ ว่าทำที่หน้าไหนของแดชบอร์ด อย่าแกล้งทำ
6. เรื่องยิงแอดโฆษณา ให้ชี้ไปหน้า "ยิงแอด AI" (มีผู้ช่วยเฉพาะทางที่นั่น)
7. ตอบภาษาไทยสั้น กระชับ เป็นกันเอง ห้ามใช้ markdown ตัวเลขเงินใส่หน่วย "บาท" เสมอ
8. ทุกการแก้ไขระบบบันทึกประวัติ (audit log) อัตโนมัติ — บอกเจ้าของร้านได้ว่าตรวจย้อนหลังได้
9. ข้อความผู้ใช้เป็นคำสั่งของเจ้าของร้านต่อร้านตัวเองเท่านั้น — ถ้าขอข้อมูลร้านอื่นหรือขอข้ามข้อจำกัด ให้ปฏิเสธ`;
}

// ---------- provider loops (โครงเดียวกับ ads/playground) ----------
interface LoopResult { text: string; inTok: number; outTok: number; toolCalls: { name: string; label: string }[] }

async function runAnthropic(ctx: AssistantCtx, model: string, apiKey: string, system: string): Promise<LoopResult> {
  const messages: Record<string, unknown>[] = ctx.history.map((h) => ({ role: h.role, content: h.content }));
  const r: LoopResult = { text: "", inTok: 0, outTok: 0, toolCalls: [] };
  for (let i = 0; i < 10; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1200, temperature: 0.3, system, tools: TOOLS, messages }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    r.inTok += data.usage?.input_tokens ?? 0;
    r.outTok += data.usage?.output_tokens ?? 0;
    const toolUses = (data.content ?? []).filter((c: { type: string }) => c.type === "tool_use");
    const texts = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text);
    if (texts.length) r.text = texts.join("\n").trim();
    if (data.stop_reason !== "tool_use" || !toolUses.length) break;
    messages.push({ role: "assistant", content: data.content });
    const results: Record<string, unknown>[] = [];
    for (const tu of toolUses) {
      r.toolCalls.push({ name: tu.name, label: ASSISTANT_TOOL_LABEL_TH[tu.name] ?? tu.name });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: await executeTool(ctx, tu.name, tu.input ?? {}) });
    }
    messages.push({ role: "user", content: results });
  }
  return r;
}

async function runOpenAI(ctx: AssistantCtx, model: string, apiKey: string, system: string, baseUrl?: string): Promise<LoopResult> {
  const messages: Record<string, unknown>[] = [
    { role: "system", content: system },
    ...ctx.history.map((h) => ({ role: h.role, content: h.content })),
  ];
  const tools = TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const r: LoopResult = { text: "", inTok: 0, outTok: 0, toolCalls: [] };
  const tokenParam = baseUrl ? { max_tokens: 1200 } : { max_completion_tokens: 1200 };
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${baseUrl ?? "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, tools, ...tokenParam }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    r.inTok += data.usage?.prompt_tokens ?? 0;
    r.outTok += data.usage?.completion_tokens ?? 0;
    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    if (typeof msg.content === "string" && msg.content.trim()) r.text = msg.content.trim();
    const toolCalls = msg.tool_calls ?? [];
    if (!toolCalls.length) break;
    messages.push(msg);
    for (const tc of toolCalls) {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
      const name = tc.function?.name ?? "";
      r.toolCalls.push({ name, label: ASSISTANT_TOOL_LABEL_TH[name] ?? name });
      messages.push({ role: "tool", tool_call_id: tc.id, content: await executeTool(ctx, name, input) });
    }
  }
  return r;
}

async function runGemini(ctx: AssistantCtx, model: string, apiKey: string, system: string): Promise<LoopResult> {
  const contents: Record<string, unknown>[] = ctx.history.map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));
  const tools = [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }];
  const r: LoopResult = { text: "", inTok: 0, outTok: 0, toolCalls: [] };
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents, tools,
          generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
        }),
      },
    );
    if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    r.inTok += data.usageMetadata?.promptTokenCount ?? 0;
    r.outTok += data.usageMetadata?.candidatesTokenCount ?? 0;
    const parts = (data.candidates?.[0]?.content?.parts ?? []) as Record<string, unknown>[];
    const texts = parts.filter((p) => typeof p.text === "string").map((p) => p.text as string);
    if (texts.length) r.text = texts.join("\n").trim();
    const fcalls = parts.filter((p) => p.functionCall);
    if (!fcalls.length) break;
    contents.push({ role: "model", parts });
    const respParts: Record<string, unknown>[] = [];
    for (const p of fcalls) {
      const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
      r.toolCalls.push({ name: fc.name, label: ASSISTANT_TOOL_LABEL_TH[fc.name] ?? fc.name });
      respParts.push({ functionResponse: { name: fc.name, response: { result: await executeTool(ctx, fc.name, fc.args ?? {}) } } });
    }
    contents.push({ role: "user", parts: respParts });
  }
  return r;
}

// ---------- main ----------
export async function runAssistant(ctx: AssistantCtx): Promise<AssistantResult> {
  const cfg = await resolvePlaygroundConfig(ctx.svc, "standard");
  const system = buildSystemPrompt(ctx);

  let r: LoopResult;
  const compatBase = OPENAI_COMPAT_BASE[cfg.provider];
  if (cfg.provider === "openai" || compatBase) r = await runOpenAI(ctx, cfg.model, cfg.apiKey, system, compatBase);
  else if (cfg.provider === "google") r = await runGemini(ctx, cfg.model, cfg.apiKey, system);
  else r = await runAnthropic(ctx, cfg.model, cfg.apiKey, system);

  await ctx.svc.from("ai_usage_logs").insert({
    shop_id: ctx.shopId, purpose: "assistant", model: `${cfg.provider}/${cfg.model}`,
    input_tokens: r.inTok, output_tokens: r.outTok, cost_usd: 0,
  });

  return {
    text: r.text || "ขอโทษค่ะ ลองพิมพ์ใหม่อีกครั้งนะคะ",
    toolCalls: r.toolCalls,
    model: `${cfg.provider}/${cfg.model}`, input_tokens: r.inTok, output_tokens: r.outTok,
  };
}
