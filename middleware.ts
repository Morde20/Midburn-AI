/**
 * middleware.ts
 *
 * The chat is public (no login). The only protected surface is document
 * management: every /api/documents* route requires the secret admin key,
 * sent either as an `x-admin-key` header or a `key` query param (the
 * Vercel Blob client upload can only pass it on the URL).
 *
 * The key lives in the DOCUMENTS_ADMIN_KEY env var. If it is not set,
 * document management is locked for everyone (fail closed).
 */

import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const expected = process.env.DOCUMENTS_ADMIN_KEY;
  const provided =
    req.headers.get("x-admin-key") ?? req.nextUrl.searchParams.get("key");

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/documents/:path*"],
};
