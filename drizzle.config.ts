import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit (unlike `next dev`) doesn't auto-load .env.local, so load it
// explicitly here — otherwise DATABASE_URL is undefined when running
// `npx drizzle-kit push` etc. directly from the CLI.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
