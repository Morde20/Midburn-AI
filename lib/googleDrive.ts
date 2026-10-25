/**
 * lib/googleDrive.ts
 *
 * Reads the text of a Google Drive / Docs link, for knowledge-base documents
 * that are added by URL instead of being uploaded (see lib/urlDocuments.ts).
 *
 * Access model: the file must be shared as "Anyone with the link can view".
 * No Google credentials are involved — we use Google's public export URLs.
 * If the file is private, Google answers with a sign-in HTML page instead
 * of the file; that is detected and reported as a clear error.
 *
 * Supported links:
 *   - Google Docs         docs.google.com/document/d/<id>/...      -> plain text
 *   - Google Slides       docs.google.com/presentation/d/<id>/...  -> plain text
 *   - Google Sheets       docs.google.com/spreadsheets/d/<id>/...  -> CSV (the tab in ?gid=, else the first)
 *   - A file in Drive     drive.google.com/file/d/<id>/...         -> PDF / txt / md
 */

import { extractTextFromBuffer } from "@/lib/ingest";

export type GoogleLinkKind = "doc" | "slides" | "sheet" | "file";
export type GoogleLink = { kind: GoogleLinkKind; id: string; gid?: string };

const ID = "([a-zA-Z0-9_-]{15,})";

export function parseGoogleLink(raw: string): GoogleLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname;

  if (host === "docs.google.com") {
    let m = url.pathname.match(new RegExp(`^/document/(?:u/\\d+/)?d/${ID}`));
    if (m) return { kind: "doc", id: m[1] };
    m = url.pathname.match(new RegExp(`^/presentation/(?:u/\\d+/)?d/${ID}`));
    if (m) return { kind: "slides", id: m[1] };
    m = url.pathname.match(new RegExp(`^/spreadsheets/(?:u/\\d+/)?d/${ID}`));
    if (m) {
      const gid =
        url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1] ?? undefined;
      return { kind: "sheet", id: m[1], gid };
    }
    return null;
  }

  if (host === "drive.google.com") {
    const m = url.pathname.match(new RegExp(`^/file/(?:u/\\d+/)?d/${ID}`));
    if (m) return { kind: "file", id: m[1] };
    const id = url.searchParams.get("id");
    if (id && new RegExp(`^${ID}$`).test(id) && ["/open", "/uc"].includes(url.pathname)) {
      return { kind: "file", id };
    }
  }
  return null;
}

function exportUrl(link: GoogleLink): string {
  switch (link.kind) {
    case "doc":
      return `https://docs.google.com/document/d/${link.id}/export?format=txt`;
    case "slides":
      return `https://docs.google.com/presentation/d/${link.id}/export?format=txt`;
    case "sheet":
      return `https://docs.google.com/spreadsheets/d/${link.id}/export?format=csv${
        link.gid ? `&gid=${link.gid}` : ""
      }`;
    case "file":
      return `https://drive.google.com/uc?export=download&id=${link.id}`;
  }
}

const NOT_SHARED_MESSAGE =
  "Could not read the file. In Google Drive, set sharing to \"Anyone with the link\" (Viewer) and try again.";

export async function fetchGoogleLinkText(
  rawUrl: string,
  opts: { timeoutMs?: number } = {}
): Promise<string> {
  const link = parseGoogleLink(rawUrl);
  if (!link) {
    throw new Error("Not a valid Google Drive / Docs link");
  }

  const res = await fetch(exportUrl(link), {
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MidburnAI/1.0)" },
  });
  if (!res.ok) {
    if ([401, 403, 404].includes(res.status)) throw new Error(NOT_SHARED_MESSAGE);
    throw new Error(`Google returned HTTP ${res.status}`);
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  // A private file redirects to an HTML sign-in page (status 200).
  if (contentType.includes("text/html")) throw new Error(NOT_SHARED_MESSAGE);

  if (contentType.includes("application/pdf")) {
    return extractTextFromBuffer(Buffer.from(await res.arrayBuffer()), "application/pdf");
  }
  if (contentType.startsWith("text/") || contentType.includes("csv")) {
    // Google prefixes its text exports with a BOM.
    return (await res.text()).replace(/^\uFEFF/, "");
  }
  throw new Error(
    `Unsupported file type in Drive (${contentType || "unknown"}). Use a Google Doc, Sheet, Slides, PDF or text file.`
  );
}
