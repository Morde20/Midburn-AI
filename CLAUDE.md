# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Habak AI Assistant — a closed, internal Hebrew-first RAG chatbot for Habak (חב״ק, the control room) volunteers at the Midburn festival. Admins upload SOP/procedure documents through the UI; volunteers ask questions and get answers grounded strictly in those documents (the model refuses to guess when the answer isn't in the retrieved context). Hebrew is the default UI language (RTL) with an English toggle.

`README.md` is the original design spec/build prompt and is still mostly accurate for the stack rationale (§1), but has drifted from the implementation in a few places — see "Where the code has moved past README.md" below before trusting it as ground truth.

## Commands

```bash
npm run dev              # start the Next.js dev server (localhost:3000)
npm run build             # production build
npm run start              # run a production build

npm run db:generate        # generate a drizzle migration from schema.ts changes
npm run db:push            # push drizzle/schema.ts to the database directly (no migration file)
npm run db:studio          # Drizzle Studio (browse/edit the DB)
npm run db:verify          # scripts/verify-db-setup.ts — checks pgvector extension + all 3 core tables + HNSW index exist

npx tsx scripts/test-retrieval.ts "some question"      # run the real retrieval step and print similarity scores, without going through the chat UI
npx tsx scripts/inspect-chunks.ts [title-substring]     # print stored chunks for a document (defaults to most recent upload)
```

There is no lint script and no test framework configured in `package.json` — don't invent `npm run lint` or `npm test` commands.

**First-time setup:** `SETUP.md` has the full walkthrough (Neon, Anthropic, Voyage, documents admin key). One easy-to-miss step: `npx drizzle-kit push` creates the tables but **not** the HNSW vector index — that comes from running `drizzle/migrations/0001_vector_setup.sql` separately against the same database (it also enables the `vector` extension, which must exist before `db:push` runs or that command fails with `type "vector" does not exist`).

**Local dev needs no Vercel account.** File uploads fall back to local disk (`./local-uploads`, gitignored, served via `app/api/documents/local/[filename]/route.ts`) whenever `BLOB_READ_WRITE_TOKEN` is unset in `.env.local` — see `lib/storage.ts`. Copy `.env.local.example`, not `.env.example` (the latter is a stale duplicate).

## Architecture

### Request flow / access control

There is **no login and no user accounts**. The chat page (`/`) and `/api/chat` are public. The only protected surface is document management: `middleware.ts` matches `/api/documents/*` and returns `403` unless the request carries the secret `DOCUMENTS_ADMIN_KEY` env var, as an `x-admin-key` header or a `?key=` query param (the Vercel Blob client upload can only pass it on the URL). If the env var is unset, everything under `/api/documents` is locked (fail closed).

The management UI lives at `/admin/documents/<DOCUMENTS_ADMIN_KEY>` (`app/admin/documents/[key]/page.tsx` 404s on a wrong key; `DocumentsClient.tsx` sends the key with every API call). It is not linked anywhere in the UI by design. Because `/api/documents/local/[filename]` is nested under `/api/documents`, it is key-protected too.

### Data model (`drizzle/schema.ts`)

Single Neon Postgres database, no separate vector DB: `documents`, `document_chunks` (has a custom `vector(1024)` pgvector column type + HNSW cosine index, see migration file above). Chat is stateless — no conversations/messages are stored. Deleting a `document` cascades to its `document_chunks`.

### RAG pipeline

**Ingestion** requires the admin key and has two entry points that share a common core (`lib/ingest.ts`: extract → `lib/chunk.ts` paragraph/sentence-aware splitting with trailing overlap → `lib/embeddings.ts` batch-embeds via Voyage (`voyage-4-lite`, `input_type: "document"`) → insert `document_chunks` → flip `documents.status` to `ready`/`failed`, with the document row inserted as `processing` *before* extraction starts so the admin UI can show progress immediately):

- `app/api/documents/upload/route.ts` — legacy path, receives raw file bytes in the request body via `lib/storage.ts`. Only safe under Vercel's hard **4.5MB serverless function request-body cap** (platform-level, not raisable via `vercel.json` or any app code). Used as the local-dev fallback (no Blob store there) and for small files.
- `app/api/documents/upload-token/route.ts` + `app/api/documents/ingest/route.ts` — production path for anything bigger. The browser uploads the raw file directly to Vercel Blob (`upload()` from `@vercel/blob/client` in `app/admin/documents/page.tsx`, authorized via a short-lived token from `upload-token`), bypassing the function body-size cap entirely, then calls `ingest` with just the resulting blob URL (tiny JSON body) to run the actual extract/chunk/embed pipeline. `app/admin/documents/page.tsx`'s `onSubmit` tries this path first and falls back to the legacy multipart route on failure (e.g. local dev, where Blob isn't configured). Deliberately **not** using multipart upload (`multipart: true` on the client `upload()` call) — it 400'd against Vercel Blob's `mpu` endpoint in testing and isn't needed for SOP-manual-sized PDFs anyway.

**Query** (`app/api/chat/route.ts`, public):
1. Glossary normalization (`lib/glossary.ts`) — deterministic regex substitution for Midburn/Habak jargon typed in Latin transliteration (`habak`→`חב״ק`, `sahbak`→`סחב״ק`) before it ever reaches embedding or translation, because an LLM can't reliably be trusted to "remember" a glossary term-for-term.
2. Cross-lingual retrieval fix (`lib/translate.ts`): the knowledge base is entirely Hebrew, and cross-lingual embedding similarity (English question vs. Hebrew passage) is measurably weaker than same-language matching. Non-Hebrew questions get translated to Hebrew via Haiku *for retrieval only* — the original question/language is still what's sent to the answer-generating model and what the no-match fallback is phrased in.
3. Embed the (possibly translated) query (`input_type: "query"`) and cosine-search `document_chunks` (`lib/vectorSearch.ts`, joined to `documents`, filtered to `status = 'ready'`).
4. **Grounding/cost gate**: if the top similarity is below `SIMILARITY_THRESHOLD` (`lib/system-prompt.ts`, currently **0.4** — lowered from an initial 0.55 after real-data testing with `scripts/test-retrieval.ts` showed genuinely correct matches scoring ~0.40–0.45), skip the LLM entirely and stream back a canned "no documented procedure" response in the question's detected language. This is the single biggest cost lever — most wasted spend in a bot like this comes from confidently answering out-of-scope questions.
5. Otherwise stream a completion from `claude-haiku-4-5-20251001` with the static system prompt passed via the top-level `instructions` option (not `messages` — see gotcha below) and Anthropic prompt caching (`cacheControl: { type: "ephemeral" }`) enabled on it.

The system prompt (`lib/system-prompt.ts`) currently instructs the model to **not** cite source document names in answers (this was rule 6; it originally asked the model to cite sources — changed because there's typically only one active document, making citations redundant noise). Retrieved source titles are still exposed via an `X-Habak-Sources` response header (percent-encoded — see gotcha below) for any client that wants them.

Full optimization rationale (Haiku vs. Sonnet, sliding window, top-K vs. whole-document context, capped output tokens) is in README.md §5 and still accurate.

### Chat UI state (`app/page.tsx`)

Single-session chat: the conversation lives only in browser memory (`useChat`), nothing is persisted and there is no history list. There is **no sidebar**: the page lands on a wide homepage (full-bleed photo with a glass card holding the Midburn and Past Forward 2026 logos, the intro text from `t.home` in `lib/i18n/dictionary.ts`, greeting + input, FAQ chips from `lib/faq.ts`). While a conversation is open, the header shows a "+ New chat" button that returns to the homepage; a 5-minute inactivity timer does the same. Midburn assets live in `public/` (`midburn-logo.png`, `midburn-photo.jpg`, `past-forward-2026.png`, a transparent recolored version of the logo for dark backgrounds).

### Google Drive link documents (`lib/googleDrive.ts`, `lib/urlDocuments.ts`)

Besides file uploads, the documents admin page can add a **Google Drive link** (Doc, Sheet, Slides, or a PDF/txt in Drive, shared as "Anyone with the link – Viewer"; no Google credentials). These rows have `documents.source_type = 'url'`. `app/api/chat/route.ts` calls `refreshStaleUrlDocuments()` on every question: any link document not checked in the last `URL_DOC_REFRESH_SECONDS` (default 60) is re-read, and re-chunked/re-embedded only if its SHA-256 changed, so answers follow edits to the Drive document. A failed re-read keeps serving the last good content and shows the error in the admin list. New columns need `npm run db:push` (or `drizzle/migrations/0002_document_url_sources.sql`).

### i18n / RTL

`lib/i18n/dictionary.ts` + `lib/i18n/LanguageProvider.tsx` — a plain nested-object dictionary with dot-path-typed lookups (no i18n library; two languages, one audience). `useLanguage()` exposes `{ locale, t, dir, toggleLocale }`. Hebrew is default and persisted via `localStorage`; `app/layout.tsx` server-renders `<html lang="he" dir="rtl">` to match so there's no flash of the wrong direction before the provider mounts on the client. Components that need physically-mirrored layout (not just text direction) read `dir` and branch on it explicitly (e.g. message bubble alignment in `app/page.tsx`) — this is different from the sidebar-ordering case above, where relying on native flex+dir mirroring was the right call instead.

### Styling

Tailwind with a custom `desert` color scale (`tailwind.config.js`, `50`–`900`, built from brand color `#BF754B`) used throughout instead of Tailwind's default grays — sand/cream backgrounds, clay accent buttons/active states, umber text. `tailwind.config.js`'s `content` glob covers `app/`, `components/`, and `lib/`; if you add Tailwind classes in a new top-level directory, add it here too, or those classes will silently not generate (this already bit `components/Header.tsx` once).

## Known gotchas

- **ESM import hoisting vs. dotenv**: any script that imports `lib/db.ts` (even transitively) reads `process.env.DATABASE_URL` at import time, and static imports are hoisted above `dotenv.config()` regardless of source order — so a static top-level import of anything touching `lib/db.ts` in a standalone script will fail with "DATABASE_URL is not set" even if `config({ path: ".env.local" })` appears first in the file. Existing scripts (`scripts/test-retrieval.ts`) work around this with a dynamic `await import()` inside `main()`. `drizzle.config.ts` and `scripts/seed-admin.ts` load dotenv directly since `next dev` is the only context that auto-loads `.env.local`.
- **`ai` SDK v7 API surface**: this project pins `ai@^7`, which changed some APIs from what older examples/docs show: `convertToModelMessages()` returns a `Promise` (must be awaited), and a `role: "system"` entry is rejected from the `messages` array — the system prompt goes in a separate top-level `instructions` option instead (same `{ role: "system", content, providerOptions }` shape, just relocated).
- **HTTP header encoding**: header values must be Latin1/ASCII. The `X-Habak-Sources` header (Hebrew document titles) is `encodeURIComponent`-ed before being set; decode it if you consume it client-side.
- **PDF extraction is already correct** — `pdf-parse`'s output for Hebrew/RTL PDFs is in correct logical reading order as shipped; don't reintroduce character-reversal "fixes" here. `lib/hebrewPdfFix.ts` is a deliberately inert no-op stub left in place documenting an earlier misdiagnosis (a different Python library used for one-off inspection, not the actual extraction path, appeared to show reversed text) — it's dead code kept only for the comment, not something to build on.
- `public/midburn-bg.png` is an unused leftover from a full-app background-photo treatment that was tried and then reverted in favor of the desert color theme; nothing references it. It's excluded from the GitHub upload (too large, triggered a web-uploader bug) but still sits in the local working tree.
- **`next build` type-checks things `next dev` never blocks on** — every one of these passed local dev for a long time and only broke the first production build: `pdf-parse` has no bundled types (fixed with an ambient `declare module "pdf-parse"` in `types/pdf-parse.d.ts`); `next-auth/jwt`'s `JWT` interface is just a re-export of `@auth/core/jwt`'s, so augmenting `next-auth/jwt` alone (as `types/next-auth.d.ts` originally did) doesn't merge into what Auth.js's callbacks actually reference — augment `@auth/core/jwt` too; `lib/i18n/dictionary.ts`'s `Dictionary` type must be `(typeof dictionaries)[Locale]` (a union across both locales), not `typeof dictionaries.he` (only matches the Hebrew literal types, so returning the English variant failed type-checking); and `app/login/page.tsx`'s `useSearchParams()` needs a `<Suspense>` boundary around the component that calls it or the `/login` prerender fails outright. Run `npm run build` (or at minimum `npx tsc --noEmit`) locally before pushing/deploying, not just `npm run dev`.
- **Vercel serverless functions hard-cap request bodies at 4.5MB** — not configurable via `vercel.json`, env vars, or any app-level setting. This is why ingestion has two entry points (see RAG pipeline above); don't try to raise `MAX_FILE_BYTES` past this for the direct-upload route and expect it to work in production.
- **Vercel Blob store must be created with public access.** The project's `habak-ai-agent-blob` store was originally created as private by default in the dashboard's "Create Database" flow; every upload requests `access: "public"` (both `lib/storage.ts`'s server-side `put()` and the client-side `upload()` in `app/admin/documents/page.tsx`), and a private store rejects that outright with `"Cannot use public access on a private store"` — a 400 that Chrome DevTools reports as a CORS failure (no `Access-Control-Allow-Origin` header on the error response), which is misleading when debugging. If Blob uploads start failing again, check the store's access level before assuming it's a token/auth problem.
- **Vercel Blob's newer "Connect Database" flow doesn't reliably auto-inject `BLOB_READ_WRITE_TOKEN`** — connecting the store to the project added `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` but not the token itself, even though the `@vercel/blob@^0.27.0` pinned here has no OIDC/store-ID-based auth path and needs the literal env var (`getTokenFromOptionsOrEnv` in the SDK just does `process.env.BLOB_READ_WRITE_TOKEN`, nothing fancier). Get the token from the store's own Quickstart/.env.local tab and add it explicitly (`vercel env add BLOB_READ_WRITE_TOKEN production` — CLI is more reliable than pasting into the dashboard, which is easy to corrupt with stray quotes from the `KEY="value"` snippet format).

## Deployment

Live at the `habak-ai-agent` Vercel project (team `3-dogs`). Two things about this setup are non-standard and worth knowing before touching either:

- **GitHub isn't wired to Vercel for auto-deploy.** The GitHub repo (`habak-tech/midburn-habak-ai`) is org-owned and the org restricts both personal access token creation and installing/authorizing Vercel's GitHub App for anyone below owner — so this project deploys via `vercel --prod` from a local clone instead of git-push-to-deploy. Practically: **the GitHub repo, the local working copy, and the live deployment are three independently-updated things.** Deploying (`vercel --prod`) does not push to GitHub, and pushing to GitHub does not deploy. After any code change meant to ship, both have to happen separately.
- **Code lives in a `Habak AI Agent/` subfolder of the repo, not the repo root** (the repo has other content at top level). When deploying via `vercel --prod` from the actual project folder, this doesn't matter since the CLI deploys whatever directory you're in. It only matters if this project ever switches to git-based Vercel deploys — the project's Root Directory setting would need to be `Habak AI Agent`.
- Since GitHub sync is manual, it's done by copying the current project folder's contents over the `Habak AI Agent/` subfolder in a separate GitHub Desktop clone and committing from there, rather than running git directly against the working copy.

Environment variables live only in Vercel (Project → Settings → Environment Variables) and in each developer's own `.env.local` — never committed. Production uses its own Neon project (separate from local dev's), its own `AUTH_SECRET`, and Vercel Blob for file storage (see the Blob gotchas above if uploads start failing after any storage/env changes).

## Where the code has moved past README.md

README.md is the original design doc and is still accurate on stack choices and cost-optimization rationale, but a few specifics have changed since it was written: it says "no conversation-history table" (there now is one — `conversations` + `messages`, see above); its quoted system prompt still tells the model to cite sources (the live prompt in `lib/system-prompt.ts` says the opposite); and it states `SIMILARITY_THRESHOLD = 0.55` (live value is `0.4`). Treat `lib/system-prompt.ts` and `drizzle/schema.ts` as ground truth over the README's code excerpts.
