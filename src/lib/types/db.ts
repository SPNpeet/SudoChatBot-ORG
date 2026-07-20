// ==== ชนิดข้อมูลหลักที่ Dashboard ใช้ (ย่อจาก schema จริง) ====
export interface Shop {
  id: string; owner_id: string; name: string; description: string | null;
  logo_url: string | null; plan: string; status: string; currency: string;
  created_at: string;
}
export interface Channel {
  id: string; shop_id: string; platform: "facebook" | "instagram" | "line" | "tiktok";
  platform_page_id: string; page_name: string | null; avatar_url: string | null;
  status: string; created_at: string;
}
export interface Customer {
  id: string; display_name: string | null; avatar_url: string | null; phone: string | null;
  platform_user_id: string; last_active_at: string;
}
export interface Conversation {
  id: string; shop_id: string; channel_id: string; customer_id: string;
  status: "bot" | "human" | "closed"; bot_enabled: boolean;
  last_message_at: string | null; created_at: string;
  customers?: Customer; channels?: Channel;
}
export interface Message {
  id: string; conversation_id: string; direction: "inbound" | "outbound";
  sender_type: string; content_type: string; content: string | null;
  status: string; ai_model: string | null; latency_ms: number | null; created_at: string;
}
export interface Product {
  id: string; shop_id: string; sku: string | null; name: string; description: string | null;
  category: string | null; price: number; compare_at_price: number | null;
  stock: number; track_stock: boolean; status: string; images: unknown[]; created_at: string;
}
export interface ProductVariant {
  id: string; product_id: string; name: string; sku: string | null;
  price: number | null; stock: number; status: string;
}
export interface Order {
  id: string; shop_id: string; order_number: string; status: string;
  subtotal: number; shipping_fee: number; total: number;
  shipping_name: string | null; shipping_phone: string | null;
  shipping_address: { text?: string } | null; shipping_method: string | null;
  tracking_number: string | null; closed_by: "bot" | "human" | null;
  paid_at: string | null; created_at: string;
  customers?: Customer | null;
  order_items?: { id: string; product_name: string; variant_name: string | null; quantity: number; unit_price: number; total: number }[];
  payments?: Payment[];
}
export interface Payment {
  id: string; order_id: string; method: string; amount: number; status: string;
  slip_storage_path: string | null; verified_by: string | null; created_at: string;
}
export interface KnowledgeDocument {
  id: string; shop_id: string; title: string; source_type: string;
  status: string; error: string | null; page_count: number | null;
  chunk_count: number; created_at: string;
}
export interface BotSettings {
  shop_id: string; enabled: boolean; persona_name: string; greeting: string | null;
  tone: string; language: string; custom_instructions: string | null;
  auto_close_sale: boolean; upsell_enabled: boolean; handoff_keywords: string[];
  fallback_message: string; model_tier: string;
  comment_reply_enabled: boolean; comment_public_reply: string | null; comment_keywords: string[];
}
export interface ShopPaymentSettings {
  shop_id: string; promptpay_id: string | null; promptpay_type: string | null;
  account_name: string | null; bank_name: string | null; slip_provider: string;
  shipping_options: { name: string; fee: number; free_over?: number }[];
}
export interface DailyAnalytics {
  shop_id: string; date: string; messages_in: number; messages_out: number;
  conversations_new: number; orders_created: number; orders_paid: number;
  orders_closed_by_bot: number; revenue: number; ai_cost_usd: number;
}
