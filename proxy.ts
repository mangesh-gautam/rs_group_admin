import { NextResponse, type NextRequest } from "next/server";

/**
 * Signed-out browsers never get a protected page: without a live session
 * marker (rs_session, set and cleared by auth-service together with the
 * HttpOnly refresh cookie) the request is redirected to /login?next=….
 *
 * This is the first gate only. The marker holds no credential (just the
 * session's expiry); every API call is still authorized with the access token
 * by the gateway, and RequireAuth checks the role in the browser.
 */
const SESSION_COOKIE = "rs_session";

export function proxy(request: NextRequest) {
  const marker = request.cookies.get(SESSION_COOKIE)?.value;
  const expiresAt = Number(marker) * 1000;
  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.redirect(login);
  if (marker) response.cookies.delete(SESSION_COOKIE);   // expired / malformed marker
  return response;
}

export const config = {
  // every signed-in screen; /login, /api/*, /health and static files stay public
  matcher: ["/admin/:path*", "/super-admin/:path*", "/change-password", "/forms/:path*"],
};
