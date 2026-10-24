/**
 * app/api/conversations/route.ts
 *
 * GET  — list the current user's conversation threads (id, title,
 *        updatedAt), newest-first, for the sidebar.
 * POST — create a new conversation. Body: { firstMessage: string }. The
 *        title is derived from the first message (truncated to a short,
 *        readable length) rather than a separate LLM call — keeps starting
 *        a chat instant and free, consistent with this app's cost-conscious
 *        design elsewhere (see README "Token optimization").
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";

const MAX_TITLE_LENGTH = 48;

function titleFromFirstMessage(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  // Cut at the last space before the limit so we don't chop mid-word.
  const cut = trimmed.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 10 ? cut.slice(0, lastSpace) : cut) + "…";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(desc(conversations.updatedAt));

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const firstMessage = typeof body.firstMessage === "string" ? body.firstMessage : "";
  if (!firstMessage.trim()) {
    return Response.json({ error: "firstMessage is required" }, { status: 400 });
  }

  const [conversation] = await db
    .insert(conversations)
    .values({ userId: session.user.id, title: titleFromFirstMessage(firstMessage) })
    .returning({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt });

  return Response.json(conversation, { status: 201 });
}
