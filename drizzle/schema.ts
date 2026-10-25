/**
 * drizzle/schema.ts
 *
 * Single Postgres (Neon) database holding both relational data and vector
 * embeddings (via pgvector). Keeping everything in one database — rather
 * than a separate vector DB like Pinecone — is deliberate: it removes a
 * network hop per query, removes a second bill, and is more than fast
 * enough at Habak's scale (a few hundred documents, single-digit thousands
 * of chunks).
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  pgEnum,
  index,
  customType,
} from "drizzle-orm/pg-core";

// --- custom pgvector column type -------------------------------------------------
// Dimensions must match whatever embedding model you configure in lib/embeddings.ts.
// voyage-4-lite defaults to 1024 dims (Matryoshka-truncatable down to 256/512 if you
// want to shrink storage/cost further at a small recall cost).
const VECTOR_DIMENSIONS = 1024;

export const vector = (dimensions: number = VECTOR_DIMENSIONS) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .slice(1, -1)
        .split(",")
        .map(Number);
    },
  });

// --- enums -------------------------------------------------------------------------

export const documentStatusEnum = pgEnum("document_status", [
  "processing",
  "ready",
  "failed",
]);

// --- documents -----------------------------------------------------------------------

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  blobUrl: text("blob_url").notNull(),
  // "file": an uploaded PDF/txt/md, ingested once.
  // "url": a Google Drive/Docs link that is re-read whenever questions are
  // asked (see lib/urlDocuments.ts). For these, `blobUrl` holds the link too.
  sourceType: varchar("source_type", { length: 16 }).notNull().default("file"),
  sourceUrl: text("source_url"),
  // SHA-256 of the last text we embedded — lets a re-read skip re-embedding
  // when the Drive document has not changed.
  contentHash: varchar("content_hash", { length: 64 }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  status: documentStatusEnum("status").notNull().default("processing"),
  errorMessage: text("error_message"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- document_chunks -------------------------------------------------------------------

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector(VECTOR_DIMENSIONS)("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // HNSW index for fast approximate cosine search. Created via raw SQL
    // because drizzle-kit's declarative vector-index support varies by
    // version — see migrations/0001_vector_setup.sql for the guaranteed
    // way to create this.
    documentIdIdx: index("document_chunks_document_id_idx").on(
      table.documentId
    ),
  })
);

export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
