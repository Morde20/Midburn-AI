/**
 * lib/translate.ts
 *
 * The Habak knowledge base is entirely Hebrew source material, but
 * volunteers can ask in English. Cross-lingual embedding similarity
 * (English question vs. Hebrew passage) is measurably weaker than
 * same-language matching, even for genuinely relevant chunks — that's why
 * English questions were hitting the no-match fallback even when the
 * answer clearly exists in the manual.
 *
 * Fix: translate non-Hebrew questions to Hebrew before embedding them for
 * retrieval only. The original question (in its original language) is
 * still what gets sent to the answer-generating model and is still what
 * the no-match fallback's language detection uses — only the retrieval
 * step operates on the Hebrew translation, so it's matching like-for-like
 * against the Hebrew corpus.
 *
 * Uses Haiku with a short, deterministic prompt — cheap and fast; only
 * runs for non-Hebrew questions (the majority-language case, Hebrew,
 * skips this entirely at zero extra cost/latency).
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export async function translateToHebrew(text: string): Promise<string> {
  const { text: translated } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    maxOutputTokens: 200,
    instructions: {
      role: "system",
      content:
        "Translate the user's message to Hebrew. Respond with ONLY the Hebrew translation, no quotes, no commentary, no explanation.",
    },
    messages: [{ role: "user", content: text }],
  });
  return translated.trim();
}
