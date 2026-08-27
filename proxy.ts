import { type NextRequest, NextResponse } from "next/server";
import { canAccessAdminPanel, type Role } from "@/lib/permissions";
import { SESSION_COOKIE, getSessionByToken, verifySessionToken } from "@/lib/auth";
import { PRODUCTION_SITE_ORIGIN } from "@/lib/site-url";

const PUBLIC_PATHS = new Set([
  "/",
  "/auth/login",
  "/auth/registro",
  "/auth/callback",
  "/auth/pendiente",
  "/auth/error",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/approve/")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Railway debe ser solamente la infraestructura. La dirección pública y
  // cualquier flujo de autenticación siempre viven en el dominio oficial.
  if (
    process.env.NODE_ENV === "production" &&
    (request.nextUrl.hostname.endsWith(".up.railway.app") ||
      request.nextUrl.hostname === "www.natantora.com")
  ) {
    return NextResponse.redirect(
      new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, PRODUCTION_SITE_ORIGIN),
      308,
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // verifySessionToken is a cheap signature/expiry check to skip a DB round trip
  // for requests with no cookie or a garbage/expired one. The actual role/status
  // used below always comes fresh from the DB so a rejected/degraded user or a
  // logged-out session loses access immediately, not only after the JWT expires.
  const session = verifySessionToken(token) ? await getSessionByToken(token) : null;

  // Una cuenta con sesión activa no debe volver a ver acceso o registro.
  if (session && (pathname === "/auth/login" || pathname === "/auth/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = session.status === "approved" ? "/" : "/auth/pendiente";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // /admin/* requiere acceso al panel (rabino, editor, admin u owner)
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (session.status !== "approved" || !canAccessAdminPanel(session.role as Role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("error", "admin_only");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Resto de rutas: requieren miembro aprobado
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session.status !== "approved") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/pendiente";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|venue-plan-reference.png).*)"],
};
