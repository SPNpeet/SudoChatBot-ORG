// ============================================================
//  รายชื่อตารางที่ต้องสำรอง — ที่เดียวของความจริง
//  ใช้ร่วมกันทั้ง scripts/backup-data.mjs (สำรองลงเครื่อง)
//  และ /api/cron/backup (สำรองอัตโนมัติรายวันลง Storage)
//  เป็น .mjs ไม่ใช่ .ts เพราะสคริปต์ node ธรรมดาต้อง import ได้ตรง ๆ
//
//  เรียงตามลำดับกู้คืน: ตารางแม่มาก่อนตารางลูก (foreign key)
//  โครงสร้างตารางอยู่ใน supabase/migrations ในกิต — ข้อมูล + migrations = กู้ครบ
// ============================================================

/** ตารางธุรกิจหลัก — ปลอดภัยที่จะเก็บทั้งในเครื่องและใน Storage bucket (private) */
export const BACKUP_TABLES = [
  // แพลตฟอร์ม/แผน
  "plans", "platform_admins", "platform_billing_settings", "system_alerts",
  // กิจการและสมาชิก
  "profiles", "shops", "shop_members", "shop_notify_settings", "shop_payment_settings",
  "shop_counters", "line_identities",
  // ข้อมูลตั้งต้นบัญชี
  "chart_of_accounts", "expense_categories", "contacts", "products", "product_variants",
  // เอกสารการเงิน + สมุดรายวัน (หัวใจของระบบ)
  "fin_doc_counters", "fin_docs", "fin_doc_items", "fin_doc_files", "fin_payments",
  "fin_period_locks", "journal_entries", "journal_lines",
  "fixed_assets", "depreciation_runs", "fiscal_closes", "vat_recognitions",
  // เงินจริง — เดิมสคริปต์สำรองลืม wallets ทั้งตาราง (ยอดเครดิตทุกร้านหายถ้าต้องกู้)
  "wallets", "wallet_transactions", "topups", "slip_refs", "invoice_counters",
  // กฎหมายภาษี (ประกาศมีวันหมดอายุ)
  "vat_rates", "rd_filing_extensions", "th_public_holidays",
  // แจ้งเตือน/ร่องรอย
  "push_subscriptions", "notifications", "notice_dismissals", "feedback",
  "audit_logs", "ai_usage_logs", "usage_monthly", "platform_ai_daily",
];

/** ตารางที่มีความลับ (API key) — สำรองเฉพาะลงเครื่องเจ้าของ ห้ามขึ้น Storage
 *  เหตุผล: ถ้า DB ล่ม คีย์พวกนี้เจ้าของกดออกใหม่จากผู้ให้บริการได้เสมอ
 *  แต่ถ้า bucket รั่ว คีย์รั่ว = เสียหายทันที — ความเสี่ยงไม่คุ้ม */
export const SECRET_TABLES = ["ai_provider_keys", "ai_purpose_keys", "ai_settings"];
