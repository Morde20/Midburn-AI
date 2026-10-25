/**
 * app/api/documents/ingest-url/route.ts
 *
 * Admin-only (middleware.ts). Adds a knowledge-base document by Google
 * Drive link instead of a file upload. The link must be shared as
 * "Anyone with the link can view". The document is read and embedded now,
 * and re-read automatically when questions are asked — see
 * lib/urlDocuments.ts.
 */

import { parseGoogleLink } from "@/lib/googleDrive";
import { ingestUrlDocument } from "@/lib/urlDocuments";

export const runtime = "nodejs"; // pdf-parse (Drive PDFs) needs Node APIs
export const maxDuration = 60;

export async function POST(req: Request) {
  const { title, url } = (await req.json()) as { title?: string; url?: string };

  if (!title?.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!url || !parseGoogleLink(url)) {
    return Response.json(
      { error: "url must be a Google Drive / Docs / Sheets / Slides link" },
      { status: 400 }
    );
  }

  try {
    const result = await ingestUrlDocument({ title: title.trim(), url: url.trim() });
    if (result.status === "failed") {
      return Response.json(result, { status: 500 });
    }
    return Response.json(result);
  } catch (err) {
    // Surface the real cause (e.g. a missing DB column) instead of a generic error.
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("ingest-url failed:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
