/**
 * types/pdf-parse.d.ts
 *
 * `pdf-parse` ships no bundled types and has no @types package, which only
 * surfaces as a build failure under `next build`'s type-check (not under
 * `next dev`, which is why this wasn't caught locally). Minimal ambient
 * declaration covering the one call shape used in
 * app/api/documents/upload/route.ts: `pdfParse(buffer)` resolving to an
 * object with extracted `.text`.
 */

declare module "pdf-parse" {
  interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<PDFParseResult>;

  export default pdfParse;
}
