import { query } from "@/lib/db";

const schemaSql = `
  CREATE TABLE IF NOT EXISTS aliyot_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_name TEXT NOT NULL,
    occurred_on DATE NOT NULL,
    reading_type TEXT NOT NULL CHECK (reading_type IN ('Rosh Hodesh', 'Lunes', 'Jueves', 'Shabat', 'Fiesta')),
    parasha TEXT NOT NULL,
    had_donation BOOLEAN NOT NULL DEFAULT FALSE,
    donation_amount NUMERIC(12,2),
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (donation_amount IS NULL OR donation_amount > 0),
    CHECK (had_donation OR donation_amount IS NULL)
  );
  CREATE INDEX IF NOT EXISTS idx_aliyot_records_date ON aliyot_records(occurred_on DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_aliyot_records_name ON aliyot_records(LOWER(person_name));
`;

export async function ensureAliyotSchema(): Promise<void> {
  await query(schemaSql);
}
