/**
 * lib/format-text.ts
 *
 * Display helpers for text that comes out of the RAG pipeline:
 *   - parseAnswer(): turns the model's answer (which may still contain light
 *     Markdown such as "## heading", "**bold**", "- item") into structured
 *     blocks, so the UI can show it cleanly without any raw symbols.
 *   - formatSourceText(): turns a raw document chunk (PDF-extracted text with
 *     hard line breaks, detached list numbers and flattened tables) into
 *     tidy paragraphs.
 */

export type AnswerBlock =
  | { kind: "heading"; text: string }
  | { kind: "bullet"; marker: string; text: string }
  | { kind: "paragraph"; text: string };

/** Removes inline Markdown markers (bold, italics, code) from a line. */
export function stripInlineMarkdown(line: string): string {
  return line
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s).,:;!?])/g, "$1$2")
    .replace(/`+/g, "")
    .replace(/\*\*/g, "");
}

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,6}\s*(.+)$/);
    if (heading) {
      blocks.push({ kind: "heading", text: stripInlineMarkdown(heading[1]).trim() });
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      blocks.push({ kind: "bullet", marker: "•", text: stripInlineMarkdown(bullet[1]).trim() });
      continue;
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push({
        kind: "bullet",
        marker: `${numbered[1]}.`,
        text: stripInlineMarkdown(numbered[2]).trim(),
      });
      continue;
    }
    // A line that is entirely bold ("**Title:**") reads as a heading.
    const boldOnly = line.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldOnly) {
      blocks.push({ kind: "heading", text: boldOnly[1].trim() });
      continue;
    }
    blocks.push({ kind: "paragraph", text: stripInlineMarkdown(line) });
  }
  return blocks;
}

const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;

/** Collapses runs of 3+ identical consecutive words ("15:00 15:00 15:00") to one. */
function collapseRepeats(text: string): string {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let j = i;
    while (j + 1 < words.length && words[j + 1] === words[i]) j++;
    out.push(words[i]);
    if (j - i + 1 === 2) out.push(words[i]); // keep a genuine pair
    i = j + 1;
  }
  return out.join(" ");
}

export function formatSourceText(raw: string): string[] {
  const lines = raw
    .replace(BIDI_MARKS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .split("\n")
    .map((l) => l.trim());

  const paragraphs: string[] = [];
  let current = "";
  let pendingNumber = "";

  const flush = () => {
    if (current.trim()) paragraphs.push(current.trim());
    current = "";
  };

  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    // A list number extracted on its own line ("3." / ".3") belongs to the next line.
    if (/^\d+\.?$|^\.\d+$/.test(line)) {
      flush();
      pendingNumber = line.replace(/\./g, "") + ".";
      continue;
    }
    const startsItem = /^([-•*]|\d+[.)])\s/.test(line) || pendingNumber !== "";
    if (startsItem) flush();
    const text = pendingNumber ? `${pendingNumber} ${line}` : line;
    pendingNumber = "";
    current = current ? `${current} ${text}` : text;
  }
  flush();

  const cleaned = paragraphs.map(collapseRepeats).filter(Boolean);
  if (cleaned.length === 0) return cleaned;

  // Chunks end wherever the 1000-character window ended: signal an excerpt.
  const last = cleaned.length - 1;
  if (!/[.!?:;"”״)\]]$/.test(cleaned[last])) cleaned[last] += " …";
  if (/^[a-z),.;:]/.test(cleaned[0])) cleaned[0] = "… " + cleaned[0];
  return cleaned;
}
