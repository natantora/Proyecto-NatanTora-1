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
  console.log("Base de datos NatanTora actualizada correctamente");
} finally {
  await client.end();
}
