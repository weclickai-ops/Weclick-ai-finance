export type FinanceRole = "owner" | "accountant" | "member";
export type FinanceKind = "expense" | "income" | "gst_setaside";
export type EntryStatus = "pending" | "approved" | "rejected";

export interface FinanceUser {
  id: string; email: string; full_name: string | null;
  role: FinanceRole; active: boolean; created_at: string;
}
export interface FinanceEntry {
  id: string; kind: FinanceKind; amount: number; category: string;
  note: string | null; entry_date: string; status: EntryStatus;
  /** Cash | Bank transfer | UPI | Card | Cheque | Other */
  method: string | null;
  logged_by: string | null; approved_by: string | null;
  approved_at: string | null; created_at: string;
}
export interface Payable {
  id: string; label: string; amount: number;
  due_date: string | null; paid: boolean; created_at: string;
}
export interface Invoice {
  id: string; number: string; client_name: string; currency: string;
  subtotal: number; tax_percent: number; total: number; amount_paid: number;
  status: string; due_date: string | null; paid_at: string | null; created_at: string;
}
export interface InvoicePayment {
  id: string; invoice_id: string; amount: number; paid_on: string;
  method: string; reference: string | null; note: string | null;
}
