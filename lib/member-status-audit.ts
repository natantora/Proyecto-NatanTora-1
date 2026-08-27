import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type MemberStatus = "pending" | "approved" | "rejected";
export type MemberStatusSource = "email_link" | "admin_panel";

const schemaSql = `
  CREATE TABLE IF NOT EXISTS member_status_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    source TEXT NOT NULL CHECK (source IN ('email_link', 'admin_panel')),
    approval_token_id UUID REFERENCES approval_tokens(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_member_status_audit_profile_created
    ON member_status_audit(profile_id, created_at DESC);
`;

export async function ensureMemberStatusAuditSchema(): Promise<void> {
  await query(schemaSql);
}

export async function ensureMemberStatusAuditSchemaWithClient(
  client: PoolClient,
): Promise<void> {
  await client.query(schemaSql);
}

export async function recordMemberStatusChange(
  client: PoolClient,
  params: {
    profileId: string;
    previousStatus: MemberStatus;
    newStatus: MemberStatus;
    changedBy: string;
    source: MemberStatusSource;
    approvalTokenId?: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO member_status_audit
       (profile_id, previous_status, new_status, changed_by, source, approval_token_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.profileId,
      params.previousStatus,
      params.newStatus,
      params.changedBy,
      params.source,
      params.approvalTokenId ?? null,
    ],
  );
}
