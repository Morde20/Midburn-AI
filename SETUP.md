# Local setup guide — accounts & keys

**Before you start:** if a `node_modules` folder already exists in this project, delete it first (`rm -rf node_modules`) — an earlier automated install attempt left it in a partially-broken state. `npm install` on your own machine will rebuild it cleanly.

You need four things in your `.env.local` before the app can run locally: a Neon Postgres connection string, an Anthropic API key, a Voyage AI API key, and an Auth.js secret. File storage (Vercel Blob) is **not** needed for local testing — uploads fall back to local disk in dev.

## 1. Neon Postgres (database + vector store)

1. Go to [neon.tech](https://neon.tech) and sign up (email, GitHub, or Google).
2. Create your first project (any name/region is fine — pick one close to you).
3. On the project dashboard, click **Connect** and copy the connection string. It looks like:
   `postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require`
4. Paste it into `.env.local` as `DATABASE_URL`.

Free tier: 10 projects, 0.5 GiB storage — more than enough for this.

## 2. Anthropic API key (the chat model)

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up / log in.
2. **You'll need to add a card**: Settings → Billing → add payment method. There's no free tier here, but usage is metered and this app deliberately uses the cheapest model (Haiku) with a similarity gate that avoids most wasted calls — testing locally will cost cents, not dollars.
3. Go to Settings → API Keys → **Create Key**. Name it something like "habak-local-dev".
4. Copy the key (starts with `sk-ant-...`) — it's only shown once. Paste into `.env.local` as `ANTHROPIC_API_KEY`.

## 3. Voyage AI API key (embeddings)

1. Go to [dash.voyageai.com](https://dash.voyageai.com) and sign up.
2. Grab your API key from the dashboard (starts with `pa-...`).
3. Paste into `.env.local` as `VOYAGE_API_KEY`.

Free tier: the first 200 million tokens on `voyage-4-lite` (the model this app uses) are free on every account — you will not hit this limit during testing.

## 4. Auth secret

This one you generate yourself, no account needed. Once dependencies are installed (see below), run:

```bash
npx auth secret
```

This prints a value and can also write it directly into `.env.local` — paste the value in as `AUTH_SECRET` if it doesn't do so automatically.

## 5. Fill in `.env.local`

Copy `.env.local.example` to `.env.local` and fill in the four values above. `BLOB_READ_WRITE_TOKEN` can stay empty for local dev — see the file-storage fallback note in the README.

## 6. Set up the database schema

The `document_chunks` table uses a `vector` column type, so the `pgvector` extension must be enabled **before** the tables are created — otherwise `drizzle-kit push` fails with `type "vector" does not exist`.

1. In the Neon console, open your project's **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. Once `.env.local` is filled in and `npm install` has been run, create the tables:
   ```bash
   npx drizzle-kit push
   ```
   This creates the `users`, `documents`, and `document_chunks` tables from `drizzle/schema.ts`.
3. Now that the tables exist, create the search index — run the rest of the migration once against the same database (Neon's SQL editor, or `psql "$DATABASE_URL" -f drizzle/migrations/0001_vector_setup.sql`). It's safe to run the whole file even though it also re-enables the extension — it uses `IF NOT EXISTS`.
4. **Verify it worked** rather than guessing from the SQL Editor output:
   ```bash
   npm run db:verify
   ```
   This checks (against your real Neon database) that the `vector` extension is enabled, all three tables exist, and the HNSW search index was created — printing a ✓ or ✗ for each. Fix anything marked ✗ before moving on to step 7.

## 7. Create your first admin account

```bash
npx tsx scripts/seed-admin.ts <username> <password>
```

Use that username/password to log in once the app is running — from there you can create more accounts (admin or volunteer) through the admin UI.

## 8. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it redirects to `/login` since nothing is authenticated yet.

## 9. What to test

- **Log in** with the admin account from step 7. Page and labels should be in Hebrew, RTL, by default.
- **Language toggle** (top-right of the header) — switch to English and back; layout should flip LTR/RTL.
- **Create a user**: go to the "משתמשים" / "Users" admin page, create a `volunteer` account.
- **Upload a document**: go to "מסמכים" / "Documents", upload a small `.pdf`/`.txt`/`.md` file with a title. Status should move from "מעבד"/Processing to "מוכן"/Ready within a few seconds (it polls automatically). Since `BLOB_READ_WRITE_TOKEN` is unset, the file is saved under `./local-uploads` on your machine, not Vercel.
- **Ask a question** on the main chat page about something in the uploaded document — should stream back an answer grounded in it. Ask something unrelated — should get the "no documented procedure" fallback instead of a guess.
- **Log out, log in as the volunteer account** — confirm the admin pages (`/admin/users`, `/admin/documents`) redirect away/aren't linked in the header, but chat still works.

Once all of that checks out locally, that's the green light to start uploading the real Habak procedure documents.
