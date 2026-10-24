/**
 * app/api/documents/ingest/route.ts
 *
 * Admin-only. Second half of the client-direct-upload flow: the browser has
 * already uploaded the raw file straight to Vercel Blob (see
 * app/api/documents/upload-token/route.ts) and calls this route with just
 * the resulting blob URL + metadata — a tiny JSON body, so it never touches
 * Vercel's 4.5MB function request-body cap regardless of the original file
 * size. This route fetches the file content back from Blob and runs the
 * same extract -> chunk -> embed -> persist pipeline as the legacy
 * app/api/documents/upload/route.ts (shared via lib/ingest.ts).
 */

import { auth } from "@/lib/auth";
import { ALLOWED_TYPES, ingestDocument } from "@/lib/ingest";

export const runtime = "nodejs"; // pdf-parse needs Node APIs, not Edge
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, blobUrl, filename, mimeType } = (await req.json()) as {
    title?: string;
    blobUrl?: string;
    filename?: string;
    mimeType?: string;
  };

  if (!title?.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!blobUrl || !filename || !mimeType) {
    return Response.json(
      { error: "blobUrl, filename, and mimeType are required" },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(mimeType)) {
    return Response.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 });
  }

  const fileRes = await fetch(blobUrl);
  if (!fileRes.ok) {
    return Response.json(
      { error: "Could not fetch uploaded file from storage" },
      { status: 500 }
    );
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  const result = await ingestDocument({
    title: title.trim(),
    filename,
    mimeType,
    blobUrl,
    uploadedBy: session.user.id,
    buffer,
  });

  if (result.status === "failed") {
    return Response.json(result, { status: 500 });
  }
  return Response.json(result);
}
