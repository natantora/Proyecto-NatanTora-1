import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export const SESSION_COOKIE = "natantora_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  role: string;
};

export type SessionClaims = {
  sub: string;
  role: string;
  status: string;
  exp: number;
  nonce: string;
};

function sessionSecret(): string {
  const value = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return value;
}

function sign(encoded: string): string {
  return createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
}

export function verifySessionToken(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expected = Buffer.from(sign(encoded));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionClaims;
    if (!claims.sub || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getSessionByToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const result = await query<AuthUser>(
    `SELECT p.id, p.email, p.full_name, p.phone, p.status, p.role
       FROM sessions s JOIN profiles p ON p.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionByToken(token);
}

export async function createSession(userId: string): Promise<void> {
  const userResult = await query<{ role: string; status: string }>(
    "SELECT role, status FROM profiles WHERE id = $1 LIMIT 1",
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) throw new Error("Usuario no encontrado");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const claims: SessionClaims = {
    sub: userId,
    role: user.role,
    status: user.status,
    exp: Math.floor(expires.getTime() / 1000),
    nonce: randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const token = `${encoded}.${sign(encoded)}`;
  await query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashToken(token), expires],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
