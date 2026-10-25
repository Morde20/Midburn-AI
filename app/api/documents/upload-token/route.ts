/**
 * app/api/documents/upload-token/route.ts
 *
 * Admin-only (defense in depth — also covered by middleware.ts's
 * "/api/documents" prefix rule). Issues short-lived client upload tokens so
 * the browser can upload the raw file directly to Vercel Blob, bypassing
 * this app's serverless functions entirely for the large bytes. Vercel
 * Functions hard-cap request bodies at 4.5MB regardless of vercel.json
 * settings — real SOP PDFs (scanned pages, images) blow past that easily,
 * which is what app/api/documents/upload/route.ts alone used to hit in
 * production.
 *
 * After upload() resolves in the browser, the client calls
 * app/api/documents/ingest/route.ts with the resulting blob URL to actually
 * run extraction/chunking/embedding — NOT the onUploadCompleted callback
 * below, which Vercel only invokes in production over a public URL and
 * would make local dev and prod behave differently.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ALLOWED_TYPES } from "@/lib/ingest";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: Array.from(ALLOWED_TYPES),
        addRandomSuffix: true,
        maximumSizeInBytes: MAX_FILE_BYTES,
      }),
      onUploadCompleted: async () => {
        // Intentional no-op — see file header comment.
      },
    });
    return Response.json(jsonResponse);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Upload authorization failed" },
      { status: 400 }
    );
  }
}
