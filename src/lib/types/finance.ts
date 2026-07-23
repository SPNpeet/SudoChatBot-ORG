// ==== ชนิดข้อมูลระบบบัญชี (ย่อจาก schema จริง migration 050-051) ====

export type DocType = "quotation" | "invoice" | "receipt" | "expense";
export type DocStatus = "draft" | "awaiting" | "partial" | "paid" | "void";
export type VatMode = "none" | "exclusive" | "inclusive";

export interface Contact {
  id: string; shop_id: string; kind: "customer" | "vendor" | "both";
  name: string; tax_id: string | null; branch: string | null; address: string | null;
  email: string | null; phone: string | null; notes: string | null;
  status: string; created_at: string;
}

export interface ExpenseCategory {
  id: string; shop_id: string; name: string; sort: number; account_code: string | null;
}

export interface FinDocItem {
  id?: string; doc_id?: string; shop_id?: string;
  name: string; qty: number; unit: string | null;
  unit_price: number; amount: number; sort?: number;
  product_id?: string | null;
}

export interface FinDoc {
  id: string; shop_id: string; doc_type: DocType; doc_number: string;
  contact_id: string | null; contact_name: string | null;
  contact_tax_id: string | null; contact_address: string | null;
  issue_date: string; due_date: string | null;
  category_id: string | null;
  subtotal: number; discount: number;
  vat_mode: VatMode; vat_amount: number;
  wht_rate: number; wht_amount: number;
  total: number; paid_amount: number;
  status: DocStatus; source: string;
  file_path: string | null; ref_doc_id: string | null;
  notes: string | null; share_key?: string; created_at: string;
  fin_doc_items?: FinDocItem[];
  contacts?: Contact | null;
  expense_categories?: ExpenseCategory | null;
}

export interface FinPayment {
  id: string; shop_id: string; doc_id: string | null;
  direction: "in" | "out"; method: string; amount: number; paid_at: string;
  slip_storage_path: string | null; slip_trans_ref: string | null;
  verify_status: "unverified" | "verified" | "failed" | "manual";
  verify_note: string | null; matched_by: string | null; statement_ref: string | null;
  created_at: string;
  fin_docs?: { doc_number: string; doc_type: DocType; contact_name: string | null } | null;
}

export interface Account {
  id: string; shop_id: string; code: string; name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  is_system: boolean; status: string;
}

export interface JournalEntry {
  id: string; shop_id: string; entry_number: string; entry_date: string;
  memo: string | null; source_type: string; source_id: string | null; created_at: string;
  journal_lines?: JournalLine[];
}

export interface JournalLine {
  id: string; entry_id: string; shop_id: string; account_id: string;
  debit: number; credit: number; memo: string | null; sort: number;
  chart_of_accounts?: { code: string; name: string } | null;
}
