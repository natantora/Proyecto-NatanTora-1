import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL no esta configurada");

const sql = await readFile(new URL("../sql/railway-schema.sql", import.meta.url), "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(sql);

  // Permite recuperar de forma segura la primera cuenta si se registró antes
  // de configurar INITIAL_OWNER_EMAIL. Solo promueve el correo configurado y
  // únicamente mientras todavía no exista ningún administrador o propietario.
  const initialOwnerEmail = (process.env.INITIAL_OWNER_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (initialOwnerEmail) {
    const promoted = await client.query(
      `UPDATE profiles
          SET role = 'owner', status = 'approved', updated_at = NOW()
        WHERE LOWER(email) = $1
          AND NOT EXISTS (
            SELECT 1 FROM profiles WHERE role IN ('admin', 'owner')
          )
        RETURNING id`,
      [initialOwnerEmail],
    );
    if (promoted.rowCount) {
      console.log("Cuenta propietaria inicial aprobada correctamente");
    }
  }

  // Recuperación inicial: si solo existe una cuenta y todavía no hay ningún
  // administrador, esa única cuenta es necesariamente la primera registrada.
  // Esto resuelve el caso en que el correo propietario se configuró después.
  const soleAccount = await client.query(
    `UPDATE profiles
        SET role = 'owner', status = 'approved', updated_at = NOW()
      WHERE id = (SELECT id FROM profiles LIMIT 1)
        AND (SELECT COUNT(*) FROM profiles) = 1
        AND NOT EXISTS (
          SELECT 1 FROM profiles WHERE role IN ('admin', 'owner')
        )
      RETURNING id`,
  );
  if (soleAccount.rowCount) {
    console.log("Primera y única cuenta promovida a propietaria");
  }

  console.log("Base de datos NatanTora actualizada correctamente");
} finally {
  await client.end();
}
