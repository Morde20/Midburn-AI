/**
 * app/api/documents/local/[filename]/route.ts
 *
 * Serves files written by the local-disk storage fallback (lib/storage.ts).
 * Only relevant in local dev — once BLOB_READ_WRITE_TOKEN is set (production),
 * new uploads go straight to Vercel Blob and never hit this route.
 *
 * Nested under /api/documents/* on purpose so middleware.ts's existing
 * admin-only rule for that prefix applies here automatically.
 */

import { readFile } from "fs/promises";
import path from "path";

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "local-uploads");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Guard against path traversal — filename must resolve to a direct child
  // of LOCAL_UPLOADS_DIR with no "..".
  const safeFilename = path.basename(filename);
  if (safeFilename !== filename) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(LOCAL_UPLOADS_DIR, safeFilename);

  try {
    const buffer = await readFile(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
