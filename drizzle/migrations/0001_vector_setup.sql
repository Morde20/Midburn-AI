-- Run once against your Neon database (via `psql`, Neon's SQL editor, or
-- `drizzle-kit push` followed by this file) before deploying.
-- This is deliberately kept as raw SQL rather than a drizzle-kit generated
-- migration because pgvector extension activation and vector indexes are
-- not consistently supported by every drizzle-kit version's diff engine.

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. HNSW index for fast approximate cosine-similarity search.
--    HNSW (vs. IVFFlat) needs no training/list-count tuning and performs
--    well from the very first row, which matters for a knowledge base that
--    grows a few documents at a time rather than in bulk.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 3. Seed the first admin account (replace the hash — generate with
--    `node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"`).
-- INSERT INTO users (username, password_hash, role)
-- VALUES ('admin', '$2a$10$REPLACE_ME', 'admin');
