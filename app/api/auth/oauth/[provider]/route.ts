import { NextResponse, type NextRequest } from "next/server";
import {
  appBaseUrl,
  authorizationUrl,
  createOAuthState,
  oauthCookieName,
  type OAuthProvider,
} from "@/lib/oauth";

function isProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "apple";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Proveedor inválido" }, { status: 404 });

  try {
    const { state, cookieValue } = createOAuthState(provider, request.nextUrl.searchParams.get("next"));
    const response = NextResponse.redirect(authorizationUrl(provider, request.nextUrl.origin, state));
    response.cookies.set(oauthCookieName(provider), cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: provider === "apple" ? "none" : "lax",
      path: "/api/auth/oauth",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error(`[oauth/${provider}]`, error);
    return NextResponse.redirect(
      new URL(`/auth/login?oauth_error=${provider}_not_configured`, appBaseUrl(request.nextUrl.origin)),
    );
  }
}
