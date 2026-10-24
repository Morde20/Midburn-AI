/**
 * lib/embeddings.ts
 *
 * Thin wrapper around the Voyage AI embeddings API. Anthropic does not run
 * its own embedding model and officially recommends Voyage for RAG use
 * cases alongside Claude, so we use it here instead of pulling in a whole
 * second AI SDK provider.
 *
 * We use voyage-4-lite: cheap, fast, 1024-dim by default, and (like all
 * Voyage-4-series models) supports `input_type` so queries and documents
 * are embedded asymmetrically for better retrieval — at no extra token cost.
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-4-lite";

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
};

async function callVoyage(
  input: string[],
  inputType: "query" | "document"
): Promise<number[][]> {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not set");
  }

  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      input_type: inputType,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings request failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as VoyageResponse;
  // Voyage returns results in input order but index is authoritative — sort defensively.
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Embed a single user question. Uses input_type: "query". */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await callVoyage([text], "query");
  return embedding;
}

/**
 * Embed document chunks for storage. Uses input_type: "document" and
 * batches requests (Voyage accepts up to 128 inputs per call).
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 128;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await callVoyage(batch, "document");
    results.push(...embeddings);
  }

  return results;
}
