/**
 * app/api/conversations/[id]/route.ts
 *
 * DELETE — remove a conversation and its messages (owner-only). messages
 * has ON DELETE CASCADE on conversation_id, so deleting the conversation
 * row is enough to remove its full history too.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)))
    .returning({ id: conversations.id });

  if (result.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ deleted: id });
}
