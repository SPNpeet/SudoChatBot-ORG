// ==== ชนิดข้อมูลหลักที่ Dashboard ใช้ (ย่อจาก schema จริง) ====
export interface Shop {
  id: string; owner_id: string; name: string; description: string | null;
  logo_url: string | null; plan: string; status: string; currency: string;
  billing_name?: string | null; billing_address?: string | null; tax_id?: string | null;
  created_at: string;
}
export interface Product {
  id: string; shop_id: string; sku: string | null; name: string; description: string | null;
  category: string | null; price: number; compare_at_price: number | null; cost: number | null;
  stock: number; track_stock: boolean; status: string; images: unknown[]; created_at: string;
}
export interface ProductVariant {
  id: string; product_id: string; name: string; sku: string | null;
  price: number | null; stock: number; status: string;
}
export interface ShopPaymentSettings {
  shop_id: string; promptpay_id: string | null; promptpay_type: string | null;
  account_name: string | null; bank_name: string | null; slip_provider: string;
}
