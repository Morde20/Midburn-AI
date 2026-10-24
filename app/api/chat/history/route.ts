/**
 * app/api/chat/history/route.ts
 *
 * GET — returns the current user's full chat history (oldest first), used
 * by app/page.tsx to restore the conversation on mount so navigating away
 * and back (or refreshing) doesn't lose it. Any authenticated user may read
 * their own history (auth enforced by middleware.ts).
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { messages } from "@/drizzle/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.userId, session.user.id))
    .orderBy(asc(messages.createdAt));

  return Response.json(
    rows.map((r) => ({ id: r.id, role: r.role, content: r.content }))
  );
}
