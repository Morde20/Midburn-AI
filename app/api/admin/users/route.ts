/**
 * app/api/admin/users/route.ts
 *
 * Admin-only account management. There's no self-service signup by design —
 * Habak volunteers are a known, closed roster, so admins create accounts
 * out of band (e.g. at shift-lead onboarding) rather than exposing a public
 * registration flow.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CreateUserSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8),
  role: z.enum(["admin", "volunteer"]).default("volunteer"),
});

export async function GET() {
  const rows = await db
    .select({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt })
    .from(users);
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { username, password, role: newRole } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const [created] = await db
    .insert(users)
    .values({ username, passwordHash, role: newRole })
    .returning({ id: users.id, username: users.username, role: users.role });

  return Response.json(created, { status: 201 });
}
