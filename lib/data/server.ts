import { getCurrentUser, destroySession } from "@/lib/auth";
import { query } from "@/lib/db";

const TABLES = new Set([
  "profiles", "sessions", "seats", "classes", "events", "schedules",
  "shabat_config", "payments", "seat_holidays", "approval_tokens", "oauth_accounts",
  "event_seats", "event_reservations",
]);

type Filter = { column: string; op: "=" | "IS" | ">=" | "IN"; value: unknown };
type Order = { column: string; ascending: boolean };
type Result = { data: any; error: any; count?: number | null };

function ident(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Identificador SQL invalido");
  return `"${value}"`;
}

function columns(value: string): string {
  if (value.trim() === "*") return "*";
  return value.split(",").map((part) => ident(part.trim())).join(", ");
}

class QueryBuilder implements PromiseLike<Result> {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selected = "*";
  private payload: any = null;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private maxRows: number | null = null;
  private one: "single" | "maybe" | null = null;
  private countMode = false;
  private head = false;
  private orClause: { column: string; value: unknown } | null = null;

  constructor(private table: string) {
    if (!TABLES.has(table)) throw new Error(`Tabla no permitida: ${table}`);
  }

  select(value = "*", options?: { count?: string; head?: boolean }) {
    this.selected = value;
    this.countMode = options?.count === "exact";
    this.head = options?.head === true;
    return this;
  }
  insert(value: any) { this.operation = "insert"; this.payload = value; return this; }
  upsert(value: any) { this.operation = "upsert"; this.payload = value; return this; }
  update(value: any) { this.operation = "update"; this.payload = value; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, op: "=", value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, op: "IS", value }); return this; }
  in(column: string, value: unknown[]) { this.filters.push({ column, op: "IN", value }); return this; }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false }); return this;
  }
  limit(value: number) { this.maxRows = value; return this; }
  single() { this.one = "single"; return this.execute(); }
  maybeSingle() { this.one = "maybe"; return this.execute(); }

  or(expression: string) {
    // Forma usada por asientos: closes_at.is.null,closes_at.gte.<ISO>
    const match = expression.match(/^([a-z_]+)\.is\.null,\1\.gte\.(.+)$/i);
    if (!match) throw new Error("Filtro OR no soportado");
    this.orClause = { column: match[1], value: match[2] };
    return this;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private where(values: unknown[]): string {
    const parts = this.filters.map((filter) => {
      const col = ident(filter.column);
      if (filter.op === "IS") return `${col} IS ${filter.value === null ? "NULL" : "NOT NULL"}`;
      if (filter.op === "IN") {
        const list = filter.value as unknown[];
        if (!list.length) return "FALSE";
        const marks = list.map((value) => { values.push(value); return `$${values.length}`; });
        return `${col} IN (${marks.join(", ")})`;
      }
      values.push(filter.value);
      return `${col} ${filter.op} $${values.length}`;
    });
    if (this.orClause) {
      values.push(this.orClause.value);
      const col = ident(this.orClause.column);
      parts.push(`(${col} IS NULL OR ${col} >= $${values.length})`);
    }
    return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
  }

  private async execute(): Promise<Result> {
    try {
      const values: unknown[] = [];
      let sql = "";
      const table = ident(this.table);
      const returning = ` RETURNING ${columns(this.selected)}`;

      if (this.operation === "select") {
        sql = `SELECT ${columns(this.selected)} FROM ${table}${this.where(values)}`;
        if (this.orders.length) {
          sql += " ORDER BY " + this.orders.map((o) => `${ident(o.column)} ${o.ascending ? "ASC" : "DESC"}`).join(", ");
        }
        if (this.maxRows !== null) { values.push(this.maxRows); sql += ` LIMIT $${values.length}`; }
      } else if (this.operation === "insert" || this.operation === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (!rows.length) return { data: [], error: null };
        const keys = Object.keys(rows[0]);
        const groups = rows.map((row) => "(" + keys.map((key) => {
          values.push(row[key]); return `$${values.length}`;
        }).join(", ") + ")");
        sql = `INSERT INTO ${table} (${keys.map(ident).join(", ")}) VALUES ${groups.join(", ")}`;
        if (this.operation === "upsert") {
          const updates = keys.filter((key) => key !== "id").map((key) => `${ident(key)} = EXCLUDED.${ident(key)}`);
          sql += ` ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`;
        }
        sql += returning;
      } else if (this.operation === "update") {
        const entries = Object.entries(this.payload ?? {});
        const set = entries.map(([key, value]) => { values.push(value); return `${ident(key)} = $${values.length}`; });
        sql = `UPDATE ${table} SET ${set.join(", ")}${this.where(values)}${returning}`;
      } else {
        sql = `DELETE FROM ${table}${this.where(values)}${returning}`;
      }

      const result = await query(sql, values);
      let data: any = result.rows;
      if (this.head) data = null;
      else if (this.one) data = result.rows[0] ?? null;

      let count: number | null | undefined;
      if (this.countMode) {
        const countValues: unknown[] = [];
        const countResult = await query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM ${table}${this.where(countValues)}`,
          countValues,
        );
        count = Number(countResult.rows[0]?.count ?? 0);
      }
      if (this.one === "single" && !data) {
        return { data: null, error: { message: "No se encontro el registro" }, count };
      }
      return { data, error: null, count };
    } catch (error: any) {
      return { data: null, error: { message: error?.message ?? "Error de base de datos", code: error?.code }, count: null };
    }
  }
}

function client() {
  return {
    from(table: string) { return new QueryBuilder(table); },
    auth: {
      async getUser() { return { data: { user: await getCurrentUser() }, error: null }; },
      async signOut() { await destroySession(); return { error: null }; },
      admin: {
        async updateUserById(_id?: string, _attributes?: unknown) { return { data: null, error: null }; },
        async deleteUser(id: string) {
          const result = await query("DELETE FROM profiles WHERE id = $1", [id]);
          return { data: result.rows, error: null };
        },
      },
    },
  };
}

export async function createClient() { return client(); }
export function createAdminClient() { return client(); }
