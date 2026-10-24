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

export const roleEnum = pgEnum("role", ["admin", "volunteer"]);
export const documentStatusEnum = pgEnum("document_status", [
  "processing",
  "ready",
  "failed",
]);

// --- users ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("volunteer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- documents -----------------------------------------------------------------------

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  blobUrl: text("blob_url").notNull(),
  // Nullable + ON DELETE SET NULL: a document should survive the admin
  // account that uploaded it being removed later.
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
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

// --- conversations ---------------------------------------------------------------------
// One row per chat thread (ChatGPT/Claude-style), listed in the sidebar.
// `updatedAt` is bumped on every new message and drives sidebar ordering and
// the client's 5-minute-inactivity "return to homepage" behavior.

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("conversations_user_id_idx").on(table.userId),
  })
);

// --- messages --------------------------------------------------------------------------
// Persists each user question and assistant answer, grouped into
// conversation threads so a volunteer can revisit any past thread from the
// sidebar, ChatGPT/Claude-style.

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("messages_user_id_idx").on(table.userId),
    conversationIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type Message = typeof messages.$inferSelect;
