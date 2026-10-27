/**
 * lib/vectorSearch.ts
 *
 * Cosine-similarity search over document_chunks using pgvector's `<=>`
 * (cosine distance) operator. Returns similarity (1 - distance) so callers
 * can apply a simple, intuitive threshold.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { synonymGroupOf } from "@/lib/glossary";

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
  "אתה", "אתם", "אתן", "יודע", "יודעת", "יודעים", "יודעות", "איזה", "איזו", "אילו", "תוכל", "תוכלי", "תוכלו",
  "ספר", "ספרי", "תספר", "תספרי", "הסבר", "הסבירי", "תסביר", "תסבירי", "מידע", "נושא", "בנושא", "מהם", "מהן",
  "כלשהו", "כלשהי", "דברים", "משהו", "הכל", "תגיד", "תגידי", "רוצה", "רוצים", "צריכות",
]);

const HEBREW_PREFIXES = "והבכלמש";
const MAX_TERMS = 8;

/**
 * Word roots whose forms look different in text ("להחליף", "יוחלף",
 * "החלפה"): any question word matching `test` is searched as any of `alts`.
 */
const ROOT_GROUPS: { test: RegExp; alts: string[] }[] = [
  { test: /חליפ|חליף|חלפ|חלף/, alts: ["חליפ", "חליף", "חלפ", "חלף"] },
];

/**
 * Content words of a question. Each term is a list of alternatives (a word
 * and its synonyms or other forms); a chunk matches the term if it contains
 * any of them. One Hebrew prefix letter is stripped from each word.
 */
export function extractKeywordTerms(question: string): string[][] {
  const words = question
    .replace(/[^\u05D0-\u05EAa-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const terms: string[][] = [];
  const addTerm = (alts: string[]) => {
    if (terms.some((t) => t.some((x) => alts.includes(x)))) return;
    terms.push(alts);
  };

  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    const group = synonymGroupOf(word);
    if (group) {
      addTerm(group);
      continue;
    }
    const stripped =
      word.length >= 4 && HEBREW_PREFIXES.includes(word[0]) ? word.slice(1) : word;
    if (STOPWORDS.has(stripped)) continue;
    const root = ROOT_GROUPS.find((g) => g.test.test(stripped));
    addTerm(root ? root.alts : [stripped]);
  }
  return terms.slice(0, MAX_TERMS);
}

/**
 * Minimum number of matching terms for a chunk to count as a keyword hit.
 * Deliberately lenient (about 40% of the question's content words, at least
 * one): a short or general question is still a legitimate question, and the
 * model is instructed to refuse when the retrieved text is not on topic.
 */
export function minimumScore(termCount: number): number {
  return Math.max(1, Math.ceil(termCount * 0.4));
}

export async function searchKeywordChunks(
  question: string,
  limit: number = 4
): Promise<RetrievedChunk[]> {
  const terms = extractKeywordTerms(question);
  if (terms.length < 1) return [];
  const minScore = minimumScore(terms.length);

  const scoreExpr = sql.join(
    terms.map((alts) => {
      const conditions = sql.join(
        alts.map((a) => {
          const pattern = `%${a.replace(/[\\%_]/g, "\\$&")}%`;
          return sql`dc.content ILIKE ${pattern}`;
        }),
        sql` OR `
      );
      return sql`(CASE WHEN ${conditions} THEN 1 ELSE 0 END)`;
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
