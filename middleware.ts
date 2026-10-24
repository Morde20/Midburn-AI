/**
 * middleware.ts
 *
 * Edge middleware guarding every route:
 *  - Unauthenticated users are redirected to /login (pages) or get a 401 (API).
 *  - Admin-only routes (document management, user management) reject
 *    volunteers with a 403 before the request ever reaches the route handler.
 *
 * Doing this in middleware — rather than only inside each route handler —
 * means a new API route can never accidentally ship without auth: the
 * matcher below is the single source of truth for what's protected.
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_ONLY_PREFIXES = ["/api/documents", "/api/admin", "/admin"];
const PUBLIC_PATHS = ["/login", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = req.auth;

  if (!session?.user) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;
  const isAdminRoute = ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAdminRoute && role !== "admin") {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match everything except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|midburn-hero\\.jpg|habak-logo-mask\\.png).*)",
  ],
};
