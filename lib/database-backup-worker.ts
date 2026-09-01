import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { query } from "@/lib/db";
import { deleteObjects, listObjects, putObject } from "@/lib/storage";
import { reportSystemAlert } from "@/lib/system-alerts";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;

declare global {
  var natantoraBackupTimer: ReturnType<typeof setInterval> | undefined;
  var natantoraBackupRunning: boolean | undefined;
}

function encrypt(data: Buffer): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurada para cifrar el respaldo");
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([Buffer.from("NATANTORA-BACKUP-V1\n"), iv, cipher.getAuthTag(), encrypted]);
}

export async function createDailyDatabaseBackup(): Promise<boolean> {
  if (global.natantoraBackupRunning) return false;
  global.natantoraBackupRunning = true;
  let backupId: string | null = null;
  try {
    const started = await query<{ id: string }>(
      `INSERT INTO database_backups (backup_date, status) VALUES (CURRENT_DATE, 'running')
       ON CONFLICT (backup_date) DO UPDATE SET status = 'running', started_at = NOW(),
         completed_at = NULL, error_message = NULL
       WHERE database_backups.status = 'failed'
          OR (database_backups.status = 'running' AND database_backups.started_at < NOW() - INTERVAL '1 hour')
       RETURNING id`,
    );
    if (!started.rowCount) return false;
    backupId = started.rows[0].id;
    const tables = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          AND table_name <> 'database_backups'
        ORDER BY table_name`,
    );
    const snapshot: Record<string, unknown[]> = {};
    let rowCount = 0;
    for (const { table_name: table } of tables.rows) {
      if (!/^[a-z0-9_]+$/.test(table)) continue;
      const rows = await query(`SELECT * FROM "${table}"`);
      snapshot[table] = rows.rows;
      rowCount += rows.rows.length;
    }
    const createdAt = new Date();
    const payload = Buffer.from(JSON.stringify({ version: 1, created_at: createdAt.toISOString(), tables: snapshot }));
    const encrypted = encrypt(gzipSync(payload, { level: 9 }));
    const day = createdAt.toISOString().slice(0, 10);
    const key = `backups/database/${day}/${createdAt.toISOString().replace(/[:.]/g, "-")}.json.gz.enc`;
    await putObject(key, encrypted, "application/octet-stream");
    await query(
      `UPDATE database_backups SET status = 'completed', object_key = $2, table_count = $3,
         row_count = $4, size_bytes = $5, completed_at = NOW() WHERE id = $1`,
      [backupId, key, tables.rows.length, rowCount, encrypted.length],
    );
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const old = (await listObjects("backups/database/"))
      .filter((object) => object.Key && object.LastModified && object.LastModified.getTime() < cutoff)
      .map((object) => object.Key!);
    if (old.length) await deleteObjects(old);
    console.info(`[backup] respaldo diario completado: ${tables.rows.length} tablas, ${rowCount} filas`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (backupId) await query("UPDATE database_backups SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1", [backupId, message.slice(0, 1000)]).catch(() => undefined);
    await reportSystemAlert({ severity: "critical", category: "backup", title: "Falló el respaldo diario", message, fingerprint: "backup:daily-failed" });
    return false;
  } finally {
    global.natantoraBackupRunning = false;
  }
}

export function startDatabaseBackupWorker(): void {
  if (global.natantoraBackupTimer || !process.env.DATABASE_URL) return;
  const run = () => void createDailyDatabaseBackup();
  run();
  global.natantoraBackupTimer = setInterval(run, CHECK_INTERVAL_MS);
  global.natantoraBackupTimer.unref();
  console.info("[backup] respaldo cifrado diario activado");
}
