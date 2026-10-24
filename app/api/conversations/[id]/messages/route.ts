/**
 * app/api/conversations/[id]/messages/route.ts
 *
 * GET — full message history for one conversation thread (oldest first),
 * used when a user clicks a past conversation in the sidebar. Scoped to
 * the current user — a conversation belonging to someone else 404s rather
 * than 403s, so as not to confirm/deny the existence of another user's
 * conversation ids.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/drizzle/schema";
import { eq, asc, and } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)))
    .limit(1);

  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json(
    rows.map((r) => ({ id: r.id, role: r.role, content: r.content }))
  );
}
