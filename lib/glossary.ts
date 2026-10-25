/**
 * lib/glossary.ts
 *
 * Midburn-specific terms that get typed in Latin transliteration but
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

/**
 * Words that mean the same thing to people but not to a search engine.
 * The documents may use either one, while a question may use the other, so
 * whenever a question contains one member of a group the other members are
 * appended to the text used for retrieval (the original question is still
 * what the model sees and answers). Appending instead of replacing keeps
 * both spellings in play for the embedding and for keyword matching.
 *
 * To add another pair: add a group below. Each member is a regex for the
 * word with its plural forms; Hebrew one-letter prefixes (ה/ו/ב/כ/ל/מ/ש)
 * are handled automatically.
 */
const HE = "\\u05D0-\\u05EA";
const PREFIX = `(?<![${HE}])[והבכלמש]{0,3}`;
const SUFFIX = `(?![${HE}])`;

const SYNONYM_GROUPS: { word: string; pattern: string }[][] = [
  [
    { word: "סוללה", pattern: "סוללה|סוללות" },
    { word: "בטריה", pattern: "בטריה|בטריות" },
  ],
];

const toRegex = (pattern: string) => new RegExp(`${PREFIX}(?:${pattern})${SUFFIX}`);

/** True when the word is a member of any synonym group (used by keyword search). */
export function isSynonymWord(word: string): boolean {
  return SYNONYM_GROUPS.some((group) => group.some((m) => toRegex(m.pattern).test(word)));
}

export function expandSynonyms(text: string): string {
  const additions: string[] = [];
  for (const group of SYNONYM_GROUPS) {
    const present = group.filter((m) => toRegex(m.pattern).test(text));
    if (present.length === 0) continue;
    for (const m of group) {
      if (!present.includes(m)) additions.push(m.word);
    }
  }
  return additions.length ? `${text} ${additions.join(" ")}` : text;
}
