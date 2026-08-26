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
