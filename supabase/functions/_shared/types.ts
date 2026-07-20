// ==== Queue payload types (pgmq) ====
export type Platform = "facebook" | "instagram" | "line" | "tiktok";

export interface QueueIncoming {
  webhook_event_id: string;
  shop_id: string;
  channel_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_message_id?: string;
  reply_token?: string; // LINE only
  content_type: "text" | "image" | "sticker" | "file" | "audio" | "video" | "location" | "postback";
  text?: string;
  attachments?: { type: string; url?: string; media_id?: string }[];
  timestamp: number;
  customer_profile?: { display_name?: string; avatar_url?: string };
}

export type OutMessage = { type: "text"; text: string } | { type: "image"; url: string };

export interface QueueOutbound {
  shop_id: string;
  channel_id: string;
  conversation_id: string;
  platform: Platform;
  platform_user_id: string;
  reply_token?: string;
  messages: OutMessage[];
  attempt: number;
  // Meta: ข้อความนอกหน้าต่าง 24 ชม. (แจ้งจัดส่ง/ยืนยันจ่าย) ต้องส่งแบบ MESSAGE_TAG ไม่งั้นโดนปฏิเสธ
  tag?: "POST_PURCHASE_UPDATE";
}

export interface QueueDoc { document_id: string; shop_id: string }

/** คอมเมนต์ใหม่บนโพสต์ของเพจ (FB feed / IG comments webhook) -> บอทตอบสาธารณะ + ทัก inbox */
export interface QueueComment {
  webhook_event_id?: string;
  shop_id: string;
  channel_id: string;
  platform: "facebook" | "instagram";
  page_id: string;          // FB page id หรือ IG user id (ใช้ยิง private reply)
  comment_id: string;
  post_id?: string;
  commenter_id: string;
  commenter_name?: string;
  text: string;
  timestamp: number;
}

export interface QueueSlip {
  shop_id: string;
  channel_id: string;
  conversation_id: string;
  customer_id: string;
  platform: Platform;
  platform_user_id: string;
  order_id?: string;
  media: { url?: string; line_message_id?: string };
  webhook_event_id?: string;
}
