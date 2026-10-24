/**
 * lib/hebrewPdfFix.ts — DEPRECATED, unused, kept only for history.
 *
 * This was written to fix a suspected Hebrew/RTL text reversal bug in
 * pdf-parse's output. That diagnosis turned out to be wrong: pdf-parse
 * already extracts Hebrew text in correct logical reading order (verified
 * directly against real extracted text, character by character). Applying
 * this transform was actively scrambling correctly-ordered text.
 *
 * Not imported anywhere — app/api/documents/upload/route.ts uses
 * `parsed.text` directly. Left in place rather than deleted only because
 * this sandbox's mounted filesystem couldn't remove the file; safe to
 * delete by hand if you want it gone.
 */

export function fixHebrewPdfText(text: string): string {
  return text;
}
