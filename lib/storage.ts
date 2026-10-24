/**
 * lib/storage.ts
 *
 * File storage abstraction with two backends:
 *   - Vercel Blob (production) — used whenever BLOB_READ_WRITE_TOKEN is set.
 *   - Local disk (local dev) — used when it isn't, so you can test document
 *     upload end-to-end without creating a Vercel account. Files are written
 *     under ./local-uploads (gitignored) and served back through
 *     app/api/documents/local/[filename]/route.ts, which sits behind the
 *     same admin-only middleware rule as the rest of /api/documents.
 *
 * Swapping back to Vercel Blob for production requires no code change —
 * just set BLOB_READ_WRITE_TOKEN in the deployment's environment.
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "local-uploads");

export type StoredFile = { url: string };

export async function storeFile(file: File, key: string): Promise<StoredFile> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return { url: blob.url };
  }

  // --- local disk fallback ---------------------------------------------
  await mkdir(LOCAL_UPLOADS_DIR, { recursive: true });

  // Flatten the key into a single safe filename (key may contain "/" from
  // the caller's namespacing, e.g. "habak-docs/171234-manual.pdf").
  const safeName = `${Date.now()}-${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(LOCAL_UPLOADS_DIR, safeName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return { url: `/api/documents/local/${encodeURIComponent(safeName)}` };
}
