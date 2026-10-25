/**
 * app/api/documents/route.ts
 * GET — list all documents with status, for the admin management UI.
 * (Requires the admin key; enforced by middleware.ts.)
 */

import { db } from "@/lib/db";
import { documents } from "@/drizzle/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(documents)
    .orderBy(desc(documents.createdAt));

  return Response.json(rows);
}
