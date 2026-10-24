/**
 * app/api/documents/[id]/route.ts
 * DELETE — remove a document and its chunks (admin-only).
 * document_chunks has ON DELETE CASCADE on document_id, so deleting the
 * parent row is enough to remove its embeddings too.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Defense in depth — middleware.ts already blocks non-admins from this
  // prefix, but re-check here too (same pattern as upload/route.ts and
  // admin/users/route.ts).
  const session = await auth();
  if (session?.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(documents).where(eq(documents.id, id));
  return Response.json({ deleted: id });
}
