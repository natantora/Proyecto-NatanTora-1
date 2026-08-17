import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { notifyAdminsOfPending } from "@/lib/notifications";
import {
  exchangeOAuthCode,
  findOrCreateOAuthAccount,
  oauthCookieName,
  readOAuthState,
  type OAuthProvider,
} from "@/lib/oauth";

function isProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "apple";
}

async function finish(
  request: NextRequest,
  providerValue: string,
  values: { code: string | null; state: string | null; error: string | null; user?: string | null },
) {
  if (!isProvider(providerValue)) return NextResponse.json({ error: "Proveedor inválido" }, { status: 404 });
  const provider = providerValue;
  const loginUrl = new URL("/auth/login", request.url);

  try {
    if (values.error || !values.code) throw new Error(values.error || "OAUTH_CODE_MISSING");
    const saved = readOAuthState(
      request.cookies.get(oauthCookieName(provider))?.value,
      provider,
      values.state,
    );
    if (!saved) throw new Error("OAUTH_STATE_INVALID");

    const identity = await exchangeOAuthCode(
      provider,
      request.nextUrl.origin,
      values.code,
      saved,
      values.user,
    );
    const account = await findOrCreateOAuthAccount(identity);
    await createSession(account.id);

    if (account.created && account.status !== "approved") {
      notifyAdminsOfPending({
        userId: account.id,
        fullName: identity.fullName,
        email: identity.email,
        phone: "",
      }).catch(console.error);
    }

    const destination = account.status === "approved" ? saved.next : "/auth/pendiente";
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.set(oauthCookieName(provider), "", { path: "/api/auth/oauth", maxAge: 0 });
    return response;
  } catch (error) {
    console.error(`[oauth/${provider}/callback]`, error);
    loginUrl.searchParams.set("oauth_error", "oauth_failed");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(oauthCookieName(provider), "", { path: "/api/auth/oauth", maxAge: 0 });
    return response;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  return finish(request, provider, {
    code: request.nextUrl.searchParams.get("code"),
    state: request.nextUrl.searchParams.get("state"),
    error: request.nextUrl.searchParams.get("error"),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const form = await request.formData();
  return finish(request, provider, {
    code: String(form.get("code") ?? "") || null,
    state: String(form.get("state") ?? "") || null,
    error: String(form.get("error") ?? "") || null,
    user: String(form.get("user") ?? "") || null,
  });
}
