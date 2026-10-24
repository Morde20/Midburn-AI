/**
 * scripts/inspect-chunks.ts
 *
 * Prints a few real stored chunks for a document so we can see exactly
 * what got embedded — e.g. to check whether Hebrew text extraction is
 * actually clean or still garbled.
 *
 * Usage: npx tsx scripts/inspect-chunks.ts [search-text-in-title]
 * With no argument, shows chunks from the most recently uploaded document.
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const titleFilter = process.argv[2];

  const docs = titleFilter
    ? await sql`SELECT id, title, status, chunk_count, created_at FROM documents WHERE title ILIKE ${"%" + titleFilter + "%"} ORDER BY created_at DESC LIMIT 1`
    : await sql`SELECT id, title, status, chunk_count, created_at FROM documents ORDER BY created_at DESC LIMIT 1`;

  if (docs.length === 0) {
    console.log("No matching document found.");
    process.exit(0);
  }

  const doc = docs[0];
  console.log(`Document: "${doc.title}" — status: ${doc.status}, chunks: ${doc.chunk_count}, uploaded: ${doc.created_at}`);
  console.log("");

  const chunks = await sql`
    SELECT chunk_index, content
    FROM document_chunks
    WHERE document_id = ${doc.id}
    ORDER BY chunk_index ASC
    LIMIT 3
  `;

  for (const c of chunks) {
    console.log(`--- chunk ${c.chunk_index} ---`);
    console.log(c.content.slice(0, 500));
    console.log("");
  }
}

main().catch((err) => {
  console.error("Script errored:", err);
  process.exit(1);
});
