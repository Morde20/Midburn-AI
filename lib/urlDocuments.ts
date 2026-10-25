/**
 * lib/urlDocuments.ts
 *
 * Knowledge-base documents added by Google Drive link (see
 * lib/googleDrive.ts) instead of a file upload. The Drive document changes
 * over time, so it is not ingested once and forgotten:
 *
 *   - ingestUrlDocument(): admin adds a link -> first read + chunk + embed.
 *   - refreshStaleUrlDocuments(): called by app/api/chat/route.ts whenever a
 *     question is asked. Re-reads every link document that has not been
 *     checked in the last URL_DOC_REFRESH_SECONDS (default 60) and
 *     re-embeds it only if its text actually changed (SHA-256 compare), so
 *     the answer always comes from the current version of the document
 *     without paying for embeddings on every question.
 *   - syncUrlDocument(): the shared read -> compare -> re-embed core; the
 *     admin "refresh now" button calls it with force=true.
 *
 * If a re-read fails (Drive hiccup, sharing turned off) a document that was
 * already ready keeps serving its last good content and shows the error in
 * the admin list; a document that never had content is marked failed.
 */

import { createHash } from "crypto";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, documentChunks, type Document } from "@/drizzle/schema";
import { chunkText, estimateTokens } from "@/lib/chunk";
import { embedDocuments } from "@/lib/embeddings";
import { fetchGoogleLinkText, parseGoogleLink } from "@/lib/googleDrive";

export const URL_DOC_MIME = "text/x-google-drive-link";

function refreshTtlMs(): number {
  const seconds = Number(process.env.URL_DOC_REFRESH_SECONDS);
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : 60) * 1000;
}

export type SyncResult =
  | { ok: true; changed: boolean; chunkCount: number }
  | { ok: false; error: string };

export async function syncUrlDocument(
  doc: Document,
  opts: { force?: boolean; timeoutMs?: number } = {}
): Promise<SyncResult> {
  try {
    if (!doc.sourceUrl) throw new Error("Document has no source URL");

    const text = await fetchGoogleLinkText(doc.sourceUrl, { timeoutMs: opts.timeoutMs });
    if (!text.trim()) throw new Error("The document is empty or has no readable text");

    const hash = createHash("sha256").update(text).digest("hex");
    if (!opts.force && doc.status === "ready" && doc.contentHash === hash) {
      await db
        .update(documents)
        .set({ lastSyncedAt: new Date(), errorMessage: null })
        .where(eq(documents.id, doc.id));
      return { ok: true, changed: false, chunkCount: doc.chunkCount };
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("Document produced zero chunks after splitting");
    const embeddings = await embedDocuments(chunks.map((c) => c.content));

    // neon-http has no transactions: insert the new chunks first, then drop
    // the old ones, so the document never disappears from search mid-sync.
    const oldIds = (
      await db
        .select({ id: documentChunks.id })
        .from(documentChunks)
        .where(eq(documentChunks.documentId, doc.id))
    ).map((r) => r.id);

    await db.insert(documentChunks).values(
      chunks.map((chunk, i) => ({
        documentId: doc.id,
        chunkIndex: chunk.index,
        content: chunk.content,
        tokenCount: estimateTokens(chunk.content),
        embedding: embeddings[i],
      }))
    );
    if (oldIds.length > 0) {
      await db.delete(documentChunks).where(inArray(documentChunks.id, oldIds));
    }

    await db
      .update(documents)
      .set({
        status: "ready",
        chunkCount: chunks.length,
        contentHash: hash,
        lastSyncedAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id));

    return { ok: true, changed: true, chunkCount: chunks.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown sync error";
    const hadContent = doc.status === "ready" && doc.chunkCount > 0;
    await db
      .update(documents)
      .set(
        hadContent
          ? { errorMessage: error, lastSyncedAt: new Date() }
          : { status: "failed", errorMessage: error, lastSyncedAt: new Date() }
      )
      .where(eq(documents.id, doc.id));
    return { ok: false, error };
  }
}

export async function ingestUrlDocument(params: {
  title: string;
  url: string;
}): Promise<
  | { id: string; status: "ready"; chunkCount: number }
  | { id: string; status: "failed"; error: string }
> {
  const link = parseGoogleLink(params.url);
  if (!link) throw new Error("Not a valid Google Drive / Docs link");

  const [doc] = await db
    .insert(documents)
    .values({
      title: params.title,
      filename: `google-${link.kind}-${link.id}`,
      mimeType: URL_DOC_MIME,
      blobUrl: params.url,
      sourceType: "url",
      sourceUrl: params.url,
      status: "processing",
    })
    .returning();

  const result = await syncUrlDocument(doc, { force: true });
  return result.ok
    ? { id: doc.id, status: "ready", chunkCount: result.chunkCount }
    : { id: doc.id, status: "failed", error: result.error };
}

/**
 * Re-read every link document that is due. The UPDATE ... RETURNING both
 * finds the due documents and claims them (bumps lastSyncedAt) in one
 * atomic statement, so concurrent questions don't all re-read and re-embed
 * the same document — only the request that wins the claim does.
 */
export async function refreshStaleUrlDocuments(): Promise<void> {
  const cutoff = new Date(Date.now() - refreshTtlMs());
  const due = await db
    .update(documents)
    .set({ lastSyncedAt: new Date() })
    .where(
      and(
        eq(documents.sourceType, "url"),
        inArray(documents.status, ["ready", "failed"]),
        or(isNull(documents.lastSyncedAt), lt(documents.lastSyncedAt, cutoff))
      )
    )
    .returning();

  // Chat-path reads get a shorter timeout than the admin's explicit refresh.
  await Promise.allSettled(due.map((doc) => syncUrlDocument(doc, { timeoutMs: 8_000 })));
}
