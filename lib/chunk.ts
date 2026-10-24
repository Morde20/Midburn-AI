/**
 * lib/chunk.ts
 *
 * Lightweight recursive text splitter. Deliberately dependency-free
 * (no langchain) to keep the serverless bundle small and cold starts fast.
 *
 * Strategy: try to split on paragraph breaks first, then sentences, then
 * hard character limits — so chunks stay semantically coherent instead of
 * cutting mid-sentence, which matters for retrieval quality.
 */

export type Chunk = {
  content: string;
  index: number;
};

const DEFAULT_CHUNK_SIZE = 1000; // characters, roughly ~250-300 tokens
const DEFAULT_OVERLAP = 150;

function splitOn(text: string, separator: string): string[] {
  return text.split(separator).filter((s) => s.trim().length > 0);
}

export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): Chunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  // Build up chunks greedily from paragraphs so we rarely need to hard-cut.
  const paragraphs = splitOn(normalized, "\n\n");
  const rawChunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    // A single paragraph longer than chunkSize gets split on sentences.
    const piece = para.trim();
    if (piece.length > chunkSize) {
      if (current) {
        rawChunks.push(current);
        current = "";
      }
      const sentences = piece.match(/[^.!?]+[.!?]+|\S+$/g) ?? [piece];
      let sentenceBuffer = "";
      for (const sentence of sentences) {
        if ((sentenceBuffer + sentence).length > chunkSize && sentenceBuffer) {
          rawChunks.push(sentenceBuffer.trim());
          sentenceBuffer = "";
        }
        sentenceBuffer += sentence;
      }
      if (sentenceBuffer.trim()) rawChunks.push(sentenceBuffer.trim());
      continue;
    }

    if ((current + "\n\n" + piece).length > chunkSize) {
      rawChunks.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) rawChunks.push(current);

  // Apply a small trailing overlap between consecutive chunks so answers
  // that straddle a chunk boundary still retrieve cleanly.
  const withOverlap: string[] = rawChunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prevTail = rawChunks[i - 1].slice(-overlap);
    return `${prevTail}\n\n${chunk}`;
  });

  return withOverlap.map((content, index) => ({ content, index }));
}

/** Very rough token estimate (chars / 4) — good enough for budgeting, not billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
