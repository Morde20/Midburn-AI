/**
 * lib/ingest.ts
 *
 * Shared core of the document ingestion pipeline (extract -> chunk -> embed
 * -> persist), factored out of app/api/documents/upload/route.ts so it can
 * be called from two different entry points:
 *
 *   - app/api/documents/upload/route.ts — legacy path, receives the raw
 *     file bytes in the request body. Only safe for files under Vercel's
 *     hard 4.5MB serverless function request-body cap; kept as the local-dev
 *     fallback (no Blob store configured there) and for small files.
 *   - app/api/documents/ingest/route.ts — new path, receives only a Blob
 *     URL + metadata (tiny JSON body) after the browser has already
 *     uploaded the raw file directly to Vercel Blob via
 *     app/api/documents/upload-token/route.ts. This is what lets admins
 *     upload SOP PDFs larger than 4.5MB in production.
 */

import { db } from "@/lib/db";
import { documents, documentChunks } from "@/drizzle/schema";
import { chunkText, estimateTokens } from "@/lib/chunk";
import { embedDocuments } from "@/lib/embeddings";
import { eq } from "drizzle-orm";

export const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    // pdf-parse already extracts Hebrew/RTL text in correct logical reading
    // order — confirmed by inspecting real extracted output character by
    // character. No post-processing needed.
    return parsed.text;
  }
  // txt / md — plain text is plain text.
  return buffer.toString("utf-8");
}

export async function ingestDocument(params: {
  title: string;
  filename: string;
  mimeType: string;
  blobUrl: string;
  buffer: Buffer;
}): Promise<
  | { id: string; status: "ready"; chunkCount: number }
  | { id: string; status: "failed"; error: string }
> {
  const { title, filename, mimeType, blobUrl, buffer } = params;

  // Create the document row up front so it's visible as "processing"
  // immediately in the admin UI, even before ingestion finishes.
  const [doc] = await db
    .insert(documents)
    .values({
      title,
      filename,
      mimeType,
      blobUrl,
      status: "processing",
    })
    .returning();

  try {
    const text = await extractTextFromBuffer(buffer, mimeType);
    if (!text.trim()) {
      throw new Error("No extractable text found in document");
    }
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("Document produced zero chunks after splitting");
    }

    const embeddings = await embedDocuments(chunks.map((c) => c.content));

    await db.insert(documentChunks).values(
      chunks.map((chunk, i) => ({
        documentId: doc.id,
        chunkIndex: chunk.index,
        content: chunk.content,
        tokenCount: estimateTokens(chunk.content),
        embedding: embeddings[i],
      }))
    );

    await db
      .update(documents)
      .set({ status: "ready", chunkCount: chunks.length, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));

    return { id: doc.id, status: "ready", chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown ingestion error";
    await db
      .update(documents)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));

    return { id: doc.id, status: "failed", error: message };
  }
}
