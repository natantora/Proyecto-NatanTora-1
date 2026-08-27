export type BillingAccountRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  external_reference: string | null;
  notes: string | null;
  profile_id: string | null;
  profile_name: string | null;
  profile_email: string | null;
  open_balance: number;
  open_charges: number;
  total_paid: number;
  charges: BillingChargeRow[];
  payments: BillingPaymentRow[];
};

export type BillingChargeRow = {
  id: string;
  concept: string;
  period: string | null;
  original_amount: number;
  outstanding_amount: number;
  status: "open" | "paid" | "waived";
  source: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
};

export type BillingPaymentRow = {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  description: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  applied_to: string | null;
};

export type ProfileOption = { id: string; full_name: string; email: string };
export type ImportSummary = {
  id: string;
  filename: string;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  error_rows: number;
  created_at: string;
};
