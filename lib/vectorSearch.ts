/**
 * lib/vectorSearch.ts
 *
 * Cosine-similarity search over document_chunks using pgvector's `<=>`
 * (cosine distance) operator. Returns similarity (1 - distance) so callers
 * can apply a simple, intuitive threshold.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { isSynonymWord } from "@/lib/glossary";

export type RetrievedChunk = {
  content: string;
  documentTitle: string;
  documentId: string;
  similarity: number;
  /** Set only for chunks found by keyword search: how many question terms they contain. */
  keywordScore?: number;
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

// ---------------------------------------------------------------------------
// Keyword search
//
// Embedding similarity alone can miss a passage that plainly contains the
// answer: a long chunk that covers several topics gets a diluted score, and
// the answer sentence may be a small part of it. This is a cheap second
// path: pull the content words out of the question and count how many of
// them each chunk contains. Chunks that contain most of the question's
// words are returned even when their embedding score is low.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "איפה", "אני", "אנחנו", "יכול", "יכולה", "יכולים", "מה", "מי", "איך", "מתי", "למה", "האם", "כמה",
  "לאן", "מהו", "מהי", "את", "של", "על", "עם", "או", "אם", "כל", "זה", "זאת", "זו", "לי", "לא",
  "יש", "אין", "ניתן", "אפשר", "צריך", "צריכה", "צריכים", "כדי", "גם", "הוא", "היא", "הם", "הן",
  "אל", "מן", "אבל", "כמו", "רק", "עוד", "אחר", "אחרי", "לפני", "תוך", "בין", "כאשר", "היכן",
  "לגבי", "בבקשה", "שלי", "שלנו", "הזה", "הזאת", "אותו", "אותה", "אצל",
]);

const HEBREW_PREFIXES = "והבכלמש";
const MAX_TERMS = 8;

/** Content words of a question, with one Hebrew prefix letter stripped. */
export function extractKeywordTerms(question: string): string[] {
  const words = question
    .replace(/[^\u05D0-\u05EAa-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const terms: string[] = [];
  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    const stripped =
      word.length >= 4 && !isSynonymWord(word) && HEBREW_PREFIXES.includes(word[0])
        ? word.slice(1)
        : word;
    if (STOPWORDS.has(stripped) || terms.includes(stripped)) continue;
    terms.push(stripped);
  }
  return terms.slice(0, MAX_TERMS);
}

/** Minimum number of matching terms for a chunk to count as a keyword hit. */
function minimumScore(termCount: number): number {
  return Math.max(2, Math.ceil(termCount * 0.6));
}

export async function searchKeywordChunks(
  question: string,
  limit: number = 3
): Promise<RetrievedChunk[]> {
  const terms = extractKeywordTerms(question);
  if (terms.length < 2) return [];
  const minScore = minimumScore(terms.length);

  const scoreExpr = sql.join(
    terms.map((t) => {
      const pattern = `%${t.replace(/[\\%_]/g, "\\$&")}%`;
      return sql`(CASE WHEN dc.content ILIKE ${pattern} THEN 1 ELSE 0 END)`;
    }),
    sql` + `
  );

  const result = await db.execute<{
    content: string;
    document_title: string;
    document_id: string;
    score: number;
  }>(sql`
    SELECT * FROM (
      SELECT
        dc.content AS content,
        d.title AS document_title,
        d.id AS document_id,
        (${scoreExpr}) AS score
      FROM document_chunks dc
      INNER JOIN documents d ON d.id = dc.document_id
      WHERE d.status = 'ready'
    ) scored
    WHERE score >= ${minScore}
    ORDER BY score DESC
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    content: r.content,
    documentTitle: r.document_title,
    documentId: r.document_id,
    similarity: 0,
    keywordScore: Number(r.score),
  }));
}
