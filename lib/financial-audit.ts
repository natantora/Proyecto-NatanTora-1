import type { PoolClient } from "pg";

export async function recordFinancialAudit(
  client: PoolClient,
  entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    accountId?: string | null;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO financial_audit_log
       (actor_id, action, entity_type, entity_id, account_id, before_data, after_data, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)`,
    [
      entry.actorId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.accountId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      JSON.stringify(entry.metadata ?? {}),
    ],
  );
}
