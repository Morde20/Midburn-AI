/**
 * app/api/documents/upload/route.ts
 *
 * Admin-only. middleware.ts already blocks non-admins from ever reaching
 * this handler, but we re-check the role here too (defense in depth — this
 * route should never trust middleware alone given what it can do).
 *
 * This route receives the raw file bytes directly in the request body, so
 * it's subject to Vercel's hard 4.5MB serverless function request-body cap
 * in production — that limit cannot be raised via vercel.json or any app
 * code. It's kept as the local-dev path (no Vercel Blob store configured
 * there, so there's nothing to direct-upload to) and as a fallback for
 * small files. For anything larger in production, the admin UI
 * (app/admin/documents/page.tsx) uses the client-direct-upload flow
 * instead: app/api/documents/upload-token/route.ts issues a token, the
 * browser uploads straight to Blob, then app/api/documents/ingest/route.ts
 * does the actual extract -> chunk -> embed -> persist work (shared with
 * this route via lib/ingest.ts).
 */

import { auth } from "@/lib/auth";
import { storeFile } from "@/lib/storage";
import { ALLOWED_TYPES, ingestDocument } from "@/lib/ingest";

export const runtime = "nodejs"; // pdf-parse needs Node APIs, not Edge
export const maxDuration = 60;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();

  if (!file) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  // Store the original file so admins can re-download/audit it later.
  // Uses Vercel Blob in production, local disk in dev — see lib/storage.ts.
  const stored = await storeFile(file, `habak-docs/${file.name}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await ingestDocument({
    title,
    filename: file.name,
    mimeType: file.type,
    blobUrl: stored.url,
    uploadedBy: session.user.id,
    buffer,
  });

  if (result.status === "failed") {
    return Response.json(result, { status: 500 });
  }
  return Response.json(result);
}
