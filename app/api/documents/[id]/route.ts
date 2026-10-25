/**
 * app/api/documents/[id]/route.ts
 * DELETE — remove a document and its chunks (protected by the admin key in middleware.ts).
 * document_chunks has ON DELETE CASCADE on document_id, so deleting the
 * parent row is enough to remove its embeddings too.
 */

import { db } from "@/lib/db";
import { documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(documents).where(eq(documents.id, id));
  return Response.json({ deleted: id });
}
