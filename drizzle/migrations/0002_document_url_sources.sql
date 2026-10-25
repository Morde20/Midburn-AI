-- Adds Google Drive link sources to the documents table.
-- Run once against your Neon database (Neon SQL editor or psql), or just
-- run `npm run db:push`, which applies the same columns from drizzle/schema.ts.
-- Safe to re-run.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_type varchar(16) NOT NULL DEFAULT 'file';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash varchar(64);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
