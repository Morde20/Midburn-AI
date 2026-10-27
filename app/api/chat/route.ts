/**
 * app/api/chat/route.ts
 *
 * The core RAG query endpoint. Public (no login) and stateless: nothing
 * about the conversation is stored server-side.
 *
 * Wire format: the client (`useChat` + `DefaultChatTransport`, see
 * app/page.tsx) POSTs `{ messages: UIMessage[] }` and expects back a
 * UI-message stream (`toUIMessageStreamResponse`), which is what makes
 * `useChat`'s streaming + message state management work with zero glue code.
 *
 * Token-optimization decisions made here (see README.md "Cost efficiency"
 * section for the full rationale):
 *   1. Sliding window: only the last MAX_HISTORY_TURNS messages are sent to
 *      the model — old turns are dropped, not summarized (summarizing costs
 *      tokens too).
 *   2. Similarity gate: if retrieval comes back weak, we skip the LLM call
 *      entirely and return the canned "no answer" response. Most cost in a
 *      procedural-Q&A bot comes from confidently-wrong answers to
 *      out-of-scope questions, not from correct ones — this cuts that
 *      class of call to zero tokens.
 *   3. claude-haiku-4-5: the cheapest current Claude model, more than
 *      capable of "answer strictly from this text" tasks.
 *   4. Anthropic prompt caching on the static system prompt (see
 *      providerOptions below) — the instructions block is reused on every
 *      request, so only the first request per cache window pays full price.
 *   5. max output tokens capped — these are operational answers, not essays.
 */

import { embedQuery } from "@/lib/embeddings";
import { searchSimilarChunks, searchKeywordChunks } from "@/lib/vectorSearch";
import {
  SYSTEM_PROMPT,
  buildContextBlock,
  SIMILARITY_THRESHOLD,
  getNoMatchResponse,
  detectQuestionLocale,
  getTodayLine,
  getAnswerLanguageLine,
} from "@/lib/system-prompt";
import { translateToHebrew } from "@/lib/translate";
import { applyGlossary, expandSynonyms } from "@/lib/glossary";
import { refreshStaleUrlDocuments } from "@/lib/urlDocuments";
import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_HISTORY_TURNS = 4; // user+assistant pairs kept, beyond the current question
const TOP_K = 8;
const MAX_SOURCES = 4; // passages sent to the client for the sources panel
const MAX_SOURCE_CHARS = 3000;

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };
  if (!messages?.length) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const lastMessage = messages[messages.length - 1];
  const question = getMessageText(lastMessage);

  if (!question.trim()) {
    return Response.json({ error: "Empty question" }, { status: 400 });
  }

  // --- Sliding window: keep only the most recent turns, drop the rest ----
  const trimmedHistory = messages.slice(
    Math.max(0, messages.length - 1 - MAX_HISTORY_TURNS * 2),
    messages.length - 1
  );

  // --- Retrieval ----------------------------------------------------------
  // Midburn/Habak-specific jargon (e.g. "Habak" -> חב״ק) gets normalized
  // first — deterministic, so it doesn't depend on the translation step
  // guessing a made-up term correctly. See lib/glossary.ts to add more.
  const glossaryNormalized = applyGlossary(question);
  // Google Drive link documents change over time: re-read any that are due
  // (see lib/urlDocuments.ts) while the question is being embedded below,
  // so the search that follows sees the current version. A failed refresh
  // never blocks the answer — the last good content keeps being served.
  const refreshing = refreshStaleUrlDocuments().catch((err) =>
    console.error("URL document refresh failed:", err)
  );
  // The knowledge base is entirely Hebrew source material. Cross-lingual
  // embedding similarity (English question vs. Hebrew passage) is
  // measurably weaker than same-language matching, so non-Hebrew questions
  // are translated to Hebrew before embedding — retrieval only, the
  // original question (and its language) is still what the model answers
  // with and what the no-match fallback below is phrased in.
  const retrievalQuery =
    detectQuestionLocale(question) === "he"
      ? glossaryNormalized
      : await translateToHebrew(glossaryNormalized);
  // Words that mean the same thing (e.g. סוללה / בטריה) are both added to
  // the retrieval text, so the question finds the passage whichever one the
  // document happens to use. See lib/glossary.ts.
  const expandedQuery = expandSynonyms(retrievalQuery);
  const queryEmbedding = await embedQuery(expandedQuery);
  await refreshing;
  // Two retrieval paths: embedding similarity, plus a keyword match that
  // rescues passages containing the question's words but scoring low on
  // similarity (long chunks that cover several topics).
  const [vectorChunks, keywordChunks] = await Promise.all([
    searchSimilarChunks(queryEmbedding, TOP_K),
    searchKeywordChunks(expandedQuery),
  ]);

  const topSimilarity = vectorChunks[0]?.similarity ?? 0;
  const vectorIsRelevant = topSimilarity >= SIMILARITY_THRESHOLD;
  // Keyword hits go first: they contain the question's own words. Vector
  // results follow only when they cleared the similarity bar.
  const chunks = [
    ...keywordChunks,
    ...(vectorIsRelevant ? vectorChunks.filter((v) => !keywordChunks.some((k) => k.content === v.content)) : []),
  ];

  // --- Cost-saving early exit: nothing relevant enough, skip the LLM -----
  // No model call happens on this path — that's the entire point, it's the
  // single biggest cost lever in this route (see file header). But the
  // client (`useChat` + `DefaultChatTransport`) always expects a
  // UI-message-stream response, so we still have to answer in that protocol
  // — a plain Response.json() here would leave the chat UI unable to parse
  // the reply. createUIMessageStream lets us emit the canned response
  // through the same wire format without touching the model.
  if (chunks.length === 0) {
    const noMatchText = getNoMatchResponse(question);
    const stream = createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: "text-start", id: "no-match" });
        writer.write({ type: "text-delta", id: "no-match", delta: noMatchText });
        writer.write({ type: "text-end", id: "no-match" });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  const contextBlock = buildContextBlock(chunks);

  // convertToModelMessages returns a Promise in the installed ai@7 version
  // (older versions returned a plain array synchronously) — await it before
  // spreading, since spreading a Promise directly throws.
  const historyModelMessages = await convertToModelMessages(trimmedHistory);

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    // NOTE: as of ai@7, a `role: "system"` entry inside `messages` throws
    // ("System messages are not allowed in the prompt or messages fields").
    // The exact same SystemModelMessage object now goes in the separate
    // top-level `instructions` option instead — providerOptions still works
    // the same way it did as a message-array entry.
    instructions: {
      role: "system",
      content: SYSTEM_PROMPT,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    messages: [
      ...historyModelMessages,
      {
        role: "user",
        content: `${getTodayLine()}\n${getAnswerLanguageLine(question)}\n\n${contextBlock}\n\nQUESTION: ${question}`,
      },
    ],
  });

  // The system prompt (rule 6) already instructs the model to cite source
  // document titles inline, which is what app/page.tsx's default UI relies
  // on. We also expose the raw retrieved titles as a header for any future
  // custom client that wants to render citations as separate UI (e.g. a
  // sidebar) instead of parsing them out of the model's text.
  //
  // HTTP header values must be Latin1/ASCII — Hebrew document titles (or any
  // non-Latin1 text) throw when set directly, so this is percent-encoded.
  // Not currently read by the client; decodeURIComponent() it if you add a
  // reader later.
  const sourceTitles = Array.from(new Set(chunks.map((c) => c.documentTitle)));
  // The retrieved passages themselves are also sent to the client as message
  // metadata (on the stream's "start" part) so the chat UI can show a
  // sources panel next to the answer. Only passages that cleared the
  // similarity threshold are included, capped in number and length.
  const sources = chunks
    .filter((c) => c.similarity >= SIMILARITY_THRESHOLD || c.keywordScore !== undefined)
    .slice(0, MAX_SOURCES)
    .map((c) => ({
      title: c.documentTitle,
      content: c.content.trim().slice(0, MAX_SOURCE_CHARS),
    }));
  const response = result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => (part.type === "start" ? { sources } : undefined),
  });
  response.headers.set(
    "X-Midburn-Sources",
    encodeURIComponent(JSON.stringify(sourceTitles))
  );
  return response;
}
