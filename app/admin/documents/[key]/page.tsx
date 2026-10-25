/**
 * app/admin/documents/[key]/page.tsx
 *
 * Secret document-management page. The URL segment must equal the
 * DOCUMENTS_ADMIN_KEY env var, otherwise the page 404s (it looks like the
 * route doesn't exist). There is deliberately no link to this page anywhere
 * in the UI. The API routes it calls are protected by the same key in
 * middleware.ts, so knowing the page URL is the only way to upload.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentsClient } from "./DocumentsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DocumentsAdminPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const expected = process.env.DOCUMENTS_ADMIN_KEY;
  if (!expected || key !== expected) notFound();
  return <DocumentsClient adminKey={key} />;
}
