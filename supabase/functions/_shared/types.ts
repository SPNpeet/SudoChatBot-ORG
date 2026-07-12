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
}

export interface QueueDoc { document_id: string; shop_id: string }

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
