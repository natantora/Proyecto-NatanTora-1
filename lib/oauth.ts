import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { importPKCS8, createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { transaction } from "@/lib/db";
import { siteOrigin } from "@/lib/site-url";

export type OAuthProvider = "google" | "apple";

type OAuthState = {
  provider: OAuthProvider;
  state: string;
  nonce: string;
  codeVerifier?: string;
  next: string;
  exp: number;
};

export type OAuthIdentity = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
};

export type OAuthAccountResult = {
  id: string;
  status: string;
  role: string;
  created: boolean;
};

const GOOGLE_ISSUER = "https://accounts.google.com";
const APPLE_ISSUER = "https://appleid.apple.com";
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

function oauthSecret(): string {
  const value = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  }
  return createHmac("sha256", value).update("natantora-oauth-state-v1").digest("hex");
}

function signState(encoded: string): string {
  return createHmac("sha256", oauthSecret()).update(encoded).digest("base64url");
}

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function createOAuthState(provider: OAuthProvider, next?: string | null) {
  const state: OAuthState = {
    provider,
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    codeVerifier: provider === "google" ? randomBytes(48).toString("base64url") : undefined,
    next: safeNext(next),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  return { state, cookieValue: `${encoded}.${signState(encoded)}` };
}

export function readOAuthState(
  value: string | undefined,
  provider: OAuthProvider,
  returnedState: string | null,
): OAuthState | null {
  if (!value || !returnedState) return null;
  try {
    const [encoded, signature] = value.split(".");
    if (!encoded || !signature) return null;
    const expected = Buffer.from(signState(encoded));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
    if (parsed.provider !== provider || parsed.state !== returnedState) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function oauthCookieName(provider: OAuthProvider): string {
  return `natantora_oauth_${provider}`;
}

export function appBaseUrl(origin: string): string {
  return siteOrigin(origin);
}

export function callbackUrl(provider: OAuthProvider, origin: string): string {
  return `${appBaseUrl(origin)}/api/auth/oauth/${provider}/callback`;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} no configurada`);
  return value;
}

export function authorizationUrl(
  provider: OAuthProvider,
  origin: string,
  state: OAuthState,
): URL {
  if (provider === "google") {
    const clientId = required("GOOGLE_CLIENT_ID");
    const challenge = createHash("sha256").update(state.codeVerifier ?? "").digest("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl(provider, origin),
      response_type: "code",
      scope: "openid email profile",
      state: state.state,
      nonce: state.nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url;
  }

  const clientId = required("APPLE_CLIENT_ID");
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(provider, origin),
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state: state.state,
    nonce: state.nonce,
  }).toString();
  return url;
}

async function appleClientSecret(): Promise<string> {
  const clientId = required("APPLE_CLIENT_ID");
  const teamId = required("APPLE_TEAM_ID");
  const keyId = required("APPLE_KEY_ID");
  const privateKey = required("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(key);
}

export async function exchangeOAuthCode(
  provider: OAuthProvider,
  origin: string,
  code: string,
  state: OAuthState,
  appleUser?: string | null,
): Promise<OAuthIdentity> {
  if (provider === "google") {
    const clientId = required("GOOGLE_CLIENT_ID");
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      redirect_uri: callbackUrl(provider, origin),
      grant_type: "authorization_code",
      code_verifier: state.codeVerifier ?? "",
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const tokens = await response.json();
    if (!response.ok || !tokens.id_token) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
    const { payload } = await jwtVerify(tokens.id_token, googleJwks, {
      issuer: [GOOGLE_ISSUER, "accounts.google.com"],
      audience: clientId,
    });
    if (payload.nonce !== state.nonce || !payload.sub || !payload.email) {
      throw new Error("GOOGLE_ID_TOKEN_INVALID");
    }
    return {
      provider,
      providerAccountId: payload.sub,
      email: String(payload.email).trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      fullName: String(payload.name ?? payload.email).trim(),
    };
  }

  const clientId = required("APPLE_CLIENT_ID");
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: await appleClientSecret(),
    redirect_uri: callbackUrl(provider, origin),
    grant_type: "authorization_code",
  });
  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.id_token) throw new Error("APPLE_TOKEN_EXCHANGE_FAILED");
  const { payload } = await jwtVerify(tokens.id_token, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: clientId,
  });
  if (payload.nonce !== state.nonce || !payload.sub) throw new Error("APPLE_ID_TOKEN_INVALID");

  let suppliedName = "";
  if (appleUser) {
    try {
      const user = JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } };
      suppliedName = [user.name?.firstName, user.name?.lastName].filter(Boolean).join(" ");
    } catch {
      suppliedName = "";
    }
  }
  const email = String(payload.email ?? "").trim().toLowerCase();
  return {
    provider,
    providerAccountId: payload.sub,
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    fullName: suppliedName || email || "Miembro de NatanTora",
  };
}

export async function findOrCreateOAuthAccount(identity: OAuthIdentity): Promise<OAuthAccountResult> {
  return transaction(async (client) => {
    const linked = await client.query<{ id: string; status: string; role: string }>(
      `SELECT p.id, p.status, p.role
         FROM oauth_accounts oa
         JOIN profiles p ON p.id = oa.user_id
        WHERE oa.provider = $1 AND oa.provider_account_id = $2
        LIMIT 1`,
      [identity.provider, identity.providerAccountId],
    );
    if (linked.rows[0]) return { ...linked.rows[0], created: false };

    if (!identity.email || !identity.emailVerified) throw new Error("OAUTH_EMAIL_NOT_VERIFIED");
    const existing = await client.query<{ id: string; status: string; role: string }>(
      "SELECT id, status, role FROM profiles WHERE LOWER(email) = $1 LIMIT 1",
      [identity.email],
    );

    let profile = existing.rows[0];
    let created = false;
    if (!profile) {
      const count = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM profiles");
      const first = Number(count.rows[0]?.count ?? 0) === 0;
      const initialOwner = (process.env.INITIAL_OWNER_EMAIL ?? "").trim().toLowerCase();
      const owner = first && initialOwner !== "" && identity.email === initialOwner;
      const inserted = await client.query<{ id: string; status: string; role: string }>(
        `INSERT INTO profiles (full_name, email, phone, password_hash, status, role)
         VALUES ($1, $2, NULL, NULL, $3, $4)
         RETURNING id, status, role`,
        [identity.fullName, identity.email, owner ? "approved" : "pending", owner ? "owner" : "member"],
      );
      profile = inserted.rows[0];
      created = true;
    }

    await client.query(
      `INSERT INTO oauth_accounts (provider, provider_account_id, user_id, email)
       VALUES ($1, $2, $3, $4)`,
      [identity.provider, identity.providerAccountId, profile.id, identity.email],
    );
    return { ...profile, created };
  });
}
