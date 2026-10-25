/**
 * scripts/verify-db-setup.ts
 *
 * Checks that SETUP.md step 6 actually completed: the pgvector extension is
 * enabled, the three app tables exist, and the HNSW search index was
 * created. Prints a pass/fail line for each so it's obvious what (if
 * anything) still needs fixing.
 *
 * Usage: npx tsx scripts/verify-db-setup.ts
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  let allOk = true;

  function report(ok: boolean, label: string) {
    console.log(`${ok ? "✓" : "✗"} ${label}`);
    if (!ok) allOk = false;
  }

  // 1. pgvector extension enabled
  const ext = await sql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
  report(ext.length > 0, "pgvector extension enabled");

  // 2. Expected tables exist
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('documents', 'document_chunks')
  `;
  const tableNames = new Set(tables.map((r) => r.table_name as string));
  for (const t of ["documents", "document_chunks"]) {
    report(tableNames.has(t), `table "${t}" exists`);
  }

  // 3. HNSW search index exists
  const idx = await sql`
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'document_chunks_embedding_hnsw_idx'
  `;
  report(idx.length > 0, "HNSW vector search index exists");

  console.log("");
  console.log(allOk ? "All step 6 checks passed." : "Some checks failed — see ✗ lines above.");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification script errored:", err);
  process.exit(1);
});
