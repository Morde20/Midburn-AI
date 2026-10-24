/**
 * app/api/admin/users/[id]/route.ts
 *
 * DELETE — admin-only, and deliberately restricted further: admins can only
 * delete accounts with role "volunteer". Deleting another admin account
 * isn't allowed through this endpoint at all (avoids accidentally locking
 * everyone out, and avoids one admin removing another without a separate,
 * more deliberate process). messages/documents.uploadedBy reference the
 * user with cascade/set-null already defined in drizzle/schema.ts.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  if (target.role !== "volunteer") {
    return Response.json(
      { error: "Only volunteer accounts can be deleted here" },
      { status: 403 }
    );
  }

  await db.delete(users).where(eq(users.id, id));
  return Response.json({ deleted: id });
}
