/**
 * lib/vectorSearch.ts
 *
 * Cosine-similarity search over document_chunks using pgvector's `<=>`
 * (cosine distance) operator. Returns similarity (1 - distance) so callers
 * can apply a simple, intuitive threshold.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type RetrievedChunk = {
  content: string;
  documentTitle: string;
  documentId: string;
  similarity: number;
};

export async function searchSimilarChunks(
  queryEmbedding: number[],
  topK: number = 6
): Promise<RetrievedChunk[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  // drizzle-orm's neon-http driver returns a result object with a `.rows`
  // array (same shape as node-postgres), not a bare array — see
  // https://orm.drizzle.team/docs/get-started-postgresql#neon-postgres
  const result = await db.execute<{
    content: string;
    document_title: string;
    document_id: string;
    similarity: number;
  }>(sql`
    SELECT
      dc.content AS content,
      d.title AS document_title,
      d.id AS document_id,
      1 - (dc.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM document_chunks dc
    INNER JOIN documents d ON d.id = dc.document_id
    WHERE d.status = 'ready'
    ORDER BY dc.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `);

  return result.rows.map((r) => ({
    content: r.content,
    documentTitle: r.document_title,
    documentId: r.document_id,
    similarity: Number(r.similarity),
  }));
}
