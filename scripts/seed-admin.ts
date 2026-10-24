/**
 * scripts/seed-admin.ts
 *
 * Bootstraps the very first admin account. There's no self-service signup
 * (by design — see app/api/admin/users/route.ts), so the first admin has
 * to be created directly against the database once, before anyone can log
 * in and create further accounts through the UI.
 *
 * Usage (reads DATABASE_URL from .env.local automatically):
 *   npx tsx scripts/seed-admin.ts <username> <password>
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as schema from "../drizzle/schema";

config({ path: ".env.local" });

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: npx tsx scripts/seed-admin.ts <username> <password>");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(schema.users)
    .values({ username, passwordHash, role: "admin" })
    .returning();

  console.log(`Created admin user: ${user.username} (${user.id})`);
}

main().then(() => process.exit(0));
