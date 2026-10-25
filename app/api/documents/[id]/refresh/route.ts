/**
 * app/api/documents/[id]/refresh/route.ts
 *
 * Admin-only (middleware.ts). Forces an immediate re-read + re-embed of a
 * Google Drive link document ("refresh now" in the admin list).
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/drizzle/schema";
import { syncUrlDocument } from "@/lib/urlDocuments";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  if (doc.sourceType !== "url") {
    return Response.json({ error: "Only link documents can be refreshed" }, { status: 400 });
  }

  const result = await syncUrlDocument(doc, { force: true });
  if (!result.ok) return Response.json(result, { status: 500 });
  return Response.json(result);
}
