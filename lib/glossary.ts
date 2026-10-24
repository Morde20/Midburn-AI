/**
 * lib/glossary.ts
 *
 * Midburn/Habak-specific terms that get typed in Latin transliteration but
 * mean a specific Hebrew acronym — general translation doesn't reliably
 * catch these (they're not real English words, so a translator either
 * leaves them as-is or guesses), which breaks retrieval since the corpus
 * only ever uses the Hebrew form.
 *
 * This is a deterministic find-and-replace, applied before embedding (and
 * before translation, for non-Hebrew questions) — more reliable for exact
 * jargon terms than hoping the LLM applies a glossary correctly on every
 * call. Free-text instructions asking a model to "remember" a glossary
 * work most of the time, but "most of the time" isn't good enough for a
 * term this central; a plain substitution can't fail to catch it.
 *
 * To add another term: just add an entry below. `pattern` should have a
 * word boundary (`\b`) on each side and the `i` flag so it's
 * case-insensitive; `hebrew` is what it gets replaced with.
 */

const GLOSSARY: { pattern: RegExp; hebrew: string }[] = [
  { pattern: /\bhabak\b/gi, hebrew: "חב״ק" },
  { pattern: /\bsahbak\b/gi, hebrew: "סחב״ק" },
];

export function applyGlossary(text: string): string {
  return GLOSSARY.reduce((acc, { pattern, hebrew }) => acc.replace(pattern, hebrew), text);
}
