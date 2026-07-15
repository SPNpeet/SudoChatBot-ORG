"use server";
// ============================================================
//  Server Actions — ทุกฟังก์ชันตรวจสิทธิ์สมาชิกก่อนแตะ service role เสมอ
// ============================================================
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";

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

// ---------- แชท ----------
export async function toggleConversationMode(conversationId: string, shopId: string, mode: "bot" | "human") {
  await assertMember(shopId, ["owner", "admin", "agent"]);
  const supabase = await createClient();
  await supabase.from("conversations").update({ status: mode }).eq("id", conversationId);
  revalidatePath("/dashboard/chats");
}

export async function sendManualReply(shopId: string, conversationId: string, text: string) {
  if (!text.trim()) return;
  await assertMember(shopId, ["owner", "admin", "agent"]);
  const svc = createServiceClient();
  const { data: conv } = await svc.from("conversations")
    .select("id, channel_id, channels(platform), customers(platform_user_id)")
    .eq("id", conversationId).eq("shop_id", shopId).single();
  if (!conv) throw new Error("ไม่พบบทสนทนา");
  const channel = conv.channels as unknown as { platform: string };
  const customer = conv.customers as unknown as { platform_user_id: string };

  await svc.from("messages").insert({
    shop_id: shopId, conversation_id: conversationId,
    direction: "outbound", sender_type: "agent", content_type: "text",
    content: text.trim(), status: "queued",
  });
  await svc.rpc("queue_send", {
    p_queue: "outbound_messages",
    p_msg: {
      shop_id: shopId, channel_id: conv.channel_id, conversation_id: conversationId,
      platform: channel.platform, platform_user_id: customer.platform_user_id,
      messages: [{ type: "text", text: text.trim() }], attempt: 1,
    },
  });
  kickWorker("queue-worker");
  revalidatePath("/dashboard/chats");
}

// ---------- ออเดอร์ ----------
export async function markShipped(orderId: string, shopId: string, tracking: string) {
  await assertMember(shopId, ["owner", "admin", "agent"]);
  const supabase = await createClient();
  await supabase.from("orders").update({
    status: "shipped", tracking_number: tracking.trim() || null,
  }).eq("id", orderId).eq("shop_id", shopId);
  // แจ้งลูกค้าอัตโนมัติ
  const svc = createServiceClient();
  const { data: o } = await svc.from("orders")
    .select("order_number, channel_id, conversation_id, channels(platform), customers(platform_user_id)")
    .eq("id", orderId).single();
  if (o?.conversation_id && o.channel_id) {
    const ch = o.channels as unknown as { platform: string };
    const cu = o.customers as unknown as { platform_user_id: string };
    await svc.rpc("queue_send", {
      p_queue: "outbound_messages",
      p_msg: {
        shop_id: shopId, channel_id: o.channel_id, conversation_id: o.conversation_id,
        platform: ch.platform, platform_user_id: cu.platform_user_id,
        messages: [{ type: "text", text: `ร้านจัดส่งออเดอร์ ${o.order_number} แล้วค่ะ 📦${tracking ? `\nเลขพัสดุ: ${tracking}` : ""} ขอบคุณที่อุดหนุนนะคะ` }],
        attempt: 1,
      },
    });
    kickWorker("queue-worker");
  }
  revalidatePath("/dashboard/orders");
}

export async function verifyPaymentManual(paymentId: string, shopId: string, approve: boolean) {
  const { user } = await assertMember(shopId, ["owner", "admin"]);
  const svc = createServiceClient();
  const { data: pay } = await svc.from("payments")
    .select("id, order_id, amount, status, orders(id, order_number, conversation_id, channel_id, total, channels(platform), customers(platform_user_id))")
    .eq("id", paymentId).eq("shop_id", shopId).single();
  if (!pay) throw new Error("ไม่พบรายการชำระเงิน");
  const order = pay.orders as unknown as {
    id: string; order_number: string; conversation_id: string | null; channel_id: string | null; total: number;
    channels: { platform: string } | null; customers: { platform_user_id: string } | null;
  };

  if (approve) {
    await svc.from("payments").update({
      status: "verified", verified_by: "manual", verified_at: new Date().toISOString(), verifier_id: user.id,
    }).eq("id", paymentId);
    await svc.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", order.id);
    const { data: items } = await svc.from("order_items").select("product_id,variant_id,quantity").eq("order_id", order.id);
    for (const it of items ?? []) {
      if (it.product_id) await svc.rpc("decrement_stock", { p_product_id: it.product_id, p_variant_id: it.variant_id, p_qty: it.quantity });
    }
    await svc.from("audit_logs").insert({
      shop_id: shopId, actor_type: "user", actor_id: user.id, action: "payment_verified_manual",
      resource_type: "payment", resource_id: paymentId,
    });
  } else {
    await svc.from("payments").update({ status: "rejected", verified_by: "manual", verifier_id: user.id }).eq("id", paymentId);
  }

  if (order.conversation_id && order.channel_id && order.channels && order.customers) {
    await svc.rpc("queue_send", {
      p_queue: "outbound_messages",
      p_msg: {
        shop_id: shopId, channel_id: order.channel_id, conversation_id: order.conversation_id,
        platform: order.channels.platform, platform_user_id: order.customers.platform_user_id,
        messages: [{
          type: "text",
          text: approve
            ? `ยืนยันการชำระเงินออเดอร์ ${order.order_number} เรียบร้อยค่ะ ✅ ร้านจะรีบจัดส่งให้เร็วที่สุดนะคะ ขอบคุณค่ะ`
            : `ขออภัยค่ะ การตรวจสอบสลิปออเดอร์ ${order.order_number} ไม่ผ่าน รบกวนติดต่อแอดมินหรือส่งสลิปที่ถูกต้องอีกครั้งนะคะ`,
        }],
        attempt: 1,
      },
    });
    kickWorker("queue-worker");
  }
  revalidatePath("/dashboard/orders");
}

// ---------- สินค้า ----------
export async function upsertProduct(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const row = {
    shop_id: shopId,
    name: String(formData.get("name") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    price: Number(formData.get("price") ?? 0),
    stock: parseInt(String(formData.get("stock") ?? "0"), 10) || 0,
    status: String(formData.get("status") ?? "active"),
  };
  if (!row.name) throw new Error("ต้องมีชื่อสินค้า");

  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("products").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    productId = data.id;
  }

  // สร้าง embedding สำหรับค้นหาเชิงความหมาย (ถ้ามี key — ไม่มีก็ข้าม ระบบยังทำงานได้)
  const gemKey = process.env.GEMINI_API_KEY;
  if (gemKey && productId) {
    try {
      const text = `${row.name} ${row.category ?? ""} ${row.description ?? ""}`.slice(0, 4000);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${gemKey}`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] },
            taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 1536,
          }),
        },
      );
      if (res.ok) {
        const j = await res.json();
        const v: number[] = j.embedding.values;
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
        const svc = createServiceClient();
        await svc.from("products").update({ embedding: JSON.stringify(v.map((x) => x / norm)) }).eq("id", productId);
      }
    } catch { /* ข้าม — keyword search ยังใช้ได้ */ }
  }
  revalidatePath("/dashboard/products");
}

export async function archiveProduct(productId: string, shopId: string) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  await supabase.from("products").update({ status: "archived" }).eq("id", productId).eq("shop_id", shopId);
  revalidatePath("/dashboard/products");
}

// ---------- คลังความรู้ ----------
export async function addKnowledgeText(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!title || !text) throw new Error("กรอกหัวข้อและเนื้อหา");
  const { data: doc, error } = await supabase.from("knowledge_documents").insert({
    shop_id: shopId, title, source_type: "text", raw_text: text, status: "pending",
  }).select("id").single();
  if (error) throw new Error(error.message);
  const svc = createServiceClient();
  await svc.rpc("queue_send", { p_queue: "document_processing", p_msg: { document_id: doc.id, shop_id: shopId } });
  kickWorker("doc-processor");
  revalidatePath("/dashboard/knowledge");
}

export async function uploadKnowledgeFile(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) throw new Error("เลือกไฟล์ก่อน");
  if (file.size > 20 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 20MB");
  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) throw new Error("รองรับเฉพาะ PDF และรูปภาพ");

  const path = `${shopId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-ก-๙]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("knowledge").upload(path, file, { contentType: file.type });
  if (upErr) throw new Error(upErr.message);

  const { data: doc, error } = await supabase.from("knowledge_documents").insert({
    shop_id: shopId, title: file.name, source_type: isPdf ? "pdf" : "image",
    storage_path: path, file_size: file.size, mime_type: file.type, status: "pending",
  }).select("id").single();
  if (error) throw new Error(error.message);

  const svc = createServiceClient();
  await svc.rpc("queue_send", { p_queue: "document_processing", p_msg: { document_id: doc.id, shop_id: shopId } });
  kickWorker("doc-processor");
  revalidatePath("/dashboard/knowledge");
}

export async function deleteDocument(docId: string, shopId: string) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  const { data: doc } = await supabase.from("knowledge_documents").select("storage_path").eq("id", docId).single();
  await supabase.from("knowledge_documents").delete().eq("id", docId).eq("shop_id", shopId);
  if (doc?.storage_path) await supabase.storage.from("knowledge").remove([doc.storage_path]);
  revalidatePath("/dashboard/knowledge");
}

// ---------- ตั้งค่า ----------
export async function saveBotSettings(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  const keywords = String(formData.get("handoff_keywords") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const { error } = await supabase.from("bot_settings").upsert({
    shop_id: shopId,
    enabled: formData.get("enabled") === "on",
    persona_name: String(formData.get("persona_name") ?? "แอดมิน").trim(),
    greeting: String(formData.get("greeting") ?? "").trim() || null,
    tone: String(formData.get("tone") ?? "friendly"),
    custom_instructions: String(formData.get("custom_instructions") ?? "").trim() || null,
    auto_close_sale: formData.get("auto_close_sale") === "on",
    upsell_enabled: formData.get("upsell_enabled") === "on",
    handoff_keywords: keywords.length ? keywords : ["คุยกับคน", "ติดต่อแอดมิน"],
    fallback_message: String(formData.get("fallback_message") ?? "").trim() || "ขออภัยค่ะ เดี๋ยวแอดมินจะรีบมาตอบนะคะ",
    model_tier: String(formData.get("model_tier") ?? "standard"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

export async function savePaymentSettings(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  const shipping: { name: string; fee: number; free_over?: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const name = String(formData.get(`ship_name_${i}`) ?? "").trim();
    const fee = Number(formData.get(`ship_fee_${i}`) ?? 0);
    const freeOver = Number(formData.get(`ship_free_${i}`) ?? 0);
    if (name) shipping.push({ name, fee, ...(freeOver > 0 ? { free_over: freeOver } : {}) });
  }
  const { error } = await supabase.from("shop_payment_settings").upsert({
    shop_id: shopId,
    promptpay_id: String(formData.get("promptpay_id") ?? "").trim() || null,
    promptpay_type: String(formData.get("promptpay_type") ?? "phone"),
    account_name: String(formData.get("account_name") ?? "").trim() || null,
    bank_name: String(formData.get("bank_name") ?? "").trim() || null,
    slip_provider: String(formData.get("slip_provider") ?? "manual"),
    shipping_options: shipping,
  });
  if (error) throw new Error(error.message);

  const slipKey = String(formData.get("slip_api_key") ?? "").trim();
  if (slipKey) {
    const svc = createServiceClient();
    await svc.rpc("store_shop_slip_key", { p_shop_id: shopId, p_key: slipKey });
  }
  revalidatePath("/dashboard/settings");
}

// ---------- ช่องทาง: LINE ----------
export async function connectLine(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  const channelIdLine = String(formData.get("line_channel_id") ?? "").trim();
  const secret = String(formData.get("line_channel_secret") ?? "").trim();
  const token = String(formData.get("line_access_token") ?? "").trim();
  const name = String(formData.get("line_name") ?? "LINE OA").trim();
  if (!channelIdLine || !secret || !token) throw new Error("กรอกข้อมูล LINE ให้ครบ");

  const { data: ch, error } = await supabase.from("channels").upsert({
    shop_id: shopId, platform: "line", platform_page_id: channelIdLine,
    page_name: name, webhook_secret: secret, status: "active",
  }, { onConflict: "platform,platform_page_id" }).select("id").single();
  if (error) throw new Error(error.message);

  const svc = createServiceClient();
  await svc.rpc("store_channel_token", { p_channel_id: ch.id, p_token: token });
  revalidatePath("/dashboard/channels");
  return ch.id;
}

export async function disconnectChannel(channelId: string, shopId: string) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  await supabase.from("channels").update({ status: "disconnected" }).eq("id", channelId).eq("shop_id", shopId);
  revalidatePath("/dashboard/channels");
}

// ---------- ทีม ----------
export async function addMember(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "agent");
  if (!email) throw new Error("กรอกอีเมล");
  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!profile) throw new Error("ไม่พบผู้ใช้อีเมลนี้ — ให้เขา Login เข้าระบบครั้งแรกก่อน");
  const { error } = await svc.from("shop_members").insert({ shop_id: shopId, user_id: profile.id, role });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

export async function removeMember(memberId: string, shopId: string) {
  await assertMember(shopId, ["owner", "admin"]);
  const supabase = await createClient();
  await supabase.from("shop_members").delete().eq("id", memberId).eq("shop_id", shopId).neq("role", "owner");
  revalidatePath("/dashboard/settings");
}

// ---------- แจ้งเตือน ----------
export async function markNotificationRead(notificationId: string, shopId: string) {
  await assertMember(shopId);
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", notificationId).eq("shop_id", shopId);
  revalidatePath("/dashboard", "layout");
}

// ---------- ข้อมูลใบกำกับภาษีของร้าน ----------
export async function saveTaxInfo(shopId: string, formData: FormData) {
  await assertMember(shopId, ["owner", "admin"]);
  const svc = createServiceClient();
  const { error } = await svc.from("shops").update({
    billing_name: String(formData.get("billing_name") ?? "").trim() || null,
    billing_address: String(formData.get("billing_address") ?? "").trim() || null,
    tax_id: String(formData.get("tax_id") ?? "").replace(/[^0-9]/g, "") || null,
  }).eq("id", shopId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

// ---------- ยกเลิก/คืนเงินออเดอร์ (คืนสต๊อก) ----------
export async function refundOrder(orderId: string, shopId: string, reason: string) {
  await assertMember(shopId, ["owner", "admin"]);
  const svc = createServiceClient();
  const { data: order } = await svc.from("orders").select("id,status,order_number").eq("id", orderId).eq("shop_id", shopId).single();
  if (!order) throw new Error("ไม่พบออเดอร์");
  // คืนสต๊อกถ้าเคยตัดไปแล้ว (paid ขึ้นไป) — qty ติดลบ = บวกสต๊อกกลับ
  if (["paid", "confirmed", "shipped"].includes(order.status)) {
    const { data: items } = await svc.from("order_items").select("product_id,variant_id,quantity").eq("order_id", orderId);
    for (const it of items ?? []) {
      if (it.product_id) await svc.rpc("decrement_stock", { p_product_id: it.product_id, p_variant_id: it.variant_id, p_qty: -it.quantity }).then(() => {}, () => {});
    }
  }
  await svc.from("orders").update({ status: "cancelled", cancelled_reason: reason || "ยกเลิกโดยแอดมิน" }).eq("id", orderId);
  await svc.from("audit_logs").insert({ shop_id: shopId, actor_type: "user", action: "order_cancelled", resource_type: "order", resource_id: orderId, details: { reason, order_number: order.order_number } });
  revalidatePath("/dashboard/orders");
}
