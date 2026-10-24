/**
 * scripts/test-retrieval.ts
 *
 * Runs the exact same retrieval step app/api/chat/route.ts uses (embed the
 * question, cosine search over document_chunks) and prints the top matches
 * with their similarity scores — so we can see directly whether a bad
 * answer is a similarity-threshold problem (scores just under 0.55) or
 * something more fundamental (scores near zero), without going through the
 * whole chat UI each time.
 *
 * Usage: npx tsx scripts/test-retrieval.ts "your question here"
 *
 * Uses dynamic imports for anything that touches lib/db.ts on purpose:
 * that module reads DATABASE_URL the moment it's imported, and static
 * imports are hoisted above dotenv's config() call regardless of source
 * order, so a static import here would fail with "DATABASE_URL is not
 * set" even though config() appears first in the file.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { embedQuery } = await import("../lib/embeddings");
  const { searchSimilarChunks } = await import("../lib/vectorSearch");
  const { SIMILARITY_THRESHOLD } = await import("../lib/system-prompt");

  const question = process.argv.slice(2).join(" ");
  if (!question) {
    console.error('Usage: npx tsx scripts/test-retrieval.ts "your question"');
    process.exit(1);
  }

  console.log(`Question: ${question}`);
  console.log(`Similarity threshold in use: ${SIMILARITY_THRESHOLD}`);
  console.log("");

  const embedding = await embedQuery(question);
  const chunks = await searchSimilarChunks(embedding, 6);

  if (chunks.length === 0) {
    console.log("No chunks returned at all — is any document status='ready'?");
    process.exit(0);
  }

  for (const [i, c] of chunks.entries()) {
    const passes = c.similarity >= SIMILARITY_THRESHOLD ? "PASSES" : "below threshold";
    console.log(`--- match ${i + 1} (similarity: ${c.similarity.toFixed(3)}, ${passes}) ---`);
    console.log(`source: ${c.documentTitle}`);
    console.log(c.content.slice(0, 300));
    console.log("");
  }
}

main().catch((err) => {
  console.error("Script errored:", err);
  process.exit(1);
});
