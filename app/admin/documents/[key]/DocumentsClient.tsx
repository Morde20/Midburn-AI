"use client";

/**
 * app/admin/documents/page.tsx
 *
 * Client UI for uploading/managing knowledge-base documents. Only reachable
 * through the secret URL /admin/documents/<DOCUMENTS_ADMIN_KEY> (see
 * page.tsx next to this file). The key is sent with every API call as an
 * x-admin-key header (or a ?key= param for the Blob client upload), which
 * is what middleware.ts checks.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { Header } from "@/components/Header";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type DocStatus = "processing" | "ready" | "failed";
type DocRow = {
  id: string;
  title: string;
  filename: string;
  status: DocStatus;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
};

const inputCls =
  "w-full bg-ctl-night border border-ctl-line rounded-xl px-3.5 py-2.5 text-sm text-ctl-text placeholder:text-ctl-muted focus:outline-none focus:border-ctl-amber";

function StatusBadge({ status }: { status: DocStatus }) {
  const { t } = useLanguage();
  const label =
    status === "ready"
      ? t.admin.documents.statusReady
      : status === "processing"
        ? t.admin.documents.statusProcessing
        : t.admin.documents.statusFailed;
  const color =
    status === "ready"
      ? "border-ctl-ok/50 text-ctl-ok"
      : status === "processing"
        ? "border-ctl-amber/50 text-ctl-amber"
        : "border-ctl-bad/50 text-ctl-bad";
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full border whitespace-nowrap ${color}`}>
      {label}
    </span>
  );
}

export function DocumentsClient({ adminKey }: { adminKey: string }) {
  const authHeaders = { "x-admin-key": adminKey };
  const { t, dir, locale } = useLanguage();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/documents", { headers: authHeaders });
    if (res.ok) {
      setDocs(await res.json());
    }
    setLoading(false);
  }, [adminKey]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Poll while any document is still "processing" so status flips to
  // ready/failed without a manual refresh.
  useEffect(() => {
    if (!docs.some((d) => d.status === "processing")) return;
    const id = setInterval(loadDocs, 3000);
    return () => clearInterval(id);
  }, [docs, loadDocs]);

  function finishUpload(ok: boolean, body?: { error?: string } | null) {
    if (ok) {
      setMessage({ kind: "ok", text: t.admin.documents.uploaded });
      setTitle("");
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadDocs();
    } else {
      setMessage({ kind: "err", text: body?.error ?? t.admin.documents.error });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || !title.trim()) return;

    setUploading(true);
    setMessage(null);

    try {
      // Upload straight from the browser to Vercel Blob, bypassing this
      // app's own serverless functions for the raw bytes — Vercel Functions
      // hard-cap request bodies at 4.5MB, which real SOP PDFs (scanned
      // pages, images) blow past easily. Falls through to the legacy
      // server-multipart route below when this isn't available (local dev,
      // where no Blob store is configured).
      // multipart upload deliberately not used here — it hit a 400 from
      // Vercel Blob's `mpu` (multipart) endpoint in testing, and isn't
      // needed anyway for SOP-manual-sized PDFs. A single-request upload
      // handles files well past our 20MB app-level cap.
      const blob = await upload(`habak-docs/${file.name}`, file, {
        access: "public",
        handleUploadUrl: `/api/documents/upload-token?key=${encodeURIComponent(adminKey)}`,
      });

      const res = await fetch("/api/documents/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          title: title.trim(),
          blobUrl: blob.url,
          filename: file.name,
          mimeType: file.type,
        }),
      });
      const body = res.ok ? null : await res.json().catch(() => null);
      finishUpload(res.ok, body);
    } catch {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      const body = res.ok ? null : await res.json().catch(() => null);
      finishUpload(res.ok, body);
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t.admin.documents.deleteConfirm)) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE", headers: authHeaders });
    loadDocs();
  }

  return (
    <main className="flex flex-col h-dvh bg-ctl-night">
      <Header />
      <div dir={dir} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl w-full mx-auto space-y-5">
          <h1 className="text-xl font-semibold text-ctl-text">{t.admin.documents.title}</h1>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
            {/* Existing documents */}
            <section className="bg-ctl-panel border border-ctl-line rounded-2xl overflow-hidden">
              <h2 className="px-5 py-3.5 text-sm font-medium text-ctl-muted border-b border-ctl-line">
                {t.admin.documents.existing}
              </h2>
              {loading ? (
                <p className="px-5 py-4 text-sm text-ctl-muted">…</p>
              ) : docs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ctl-muted">{t.admin.documents.noDocuments}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-ctl-muted">
                        <th className="px-5 py-2.5 font-medium text-start">{t.admin.documents.docTitle}</th>
                        <th className="px-3 py-2.5 font-medium text-start">{t.admin.documents.status}</th>
                        <th className="px-5 py-2.5 font-medium text-start">{t.admin.documents.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id} className="border-t border-ctl-line">
                          <td className="px-5 py-3 min-w-0">
                            <p className="text-ctl-text">{d.title}</p>
                            <p className="text-ctl-muted text-xs mt-0.5">
                              {d.status === "ready" && `${d.chunkCount} ${t.admin.documents.chunks} · `}
                              {new Date(d.createdAt).toLocaleDateString(
                                locale === "he" ? "he-IL" : "en-US"
                              )}
                              {d.status === "failed" && d.errorMessage ? ` · ${d.errorMessage}` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => onDelete(d.id)}
                              className="text-xs text-ctl-bad hover:underline"
                            >
                              {t.admin.documents.delete}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Upload form */}
            <form
              onSubmit={onSubmit}
              className="bg-ctl-panel border border-ctl-line rounded-2xl p-5 space-y-3"
            >
              <h2 className="text-sm font-medium text-ctl-muted mb-1">{t.admin.documents.newDoc}</h2>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.admin.documents.docTitle}
                required
                className={inputCls}
              />
              {/* The native file input stays in the DOM (hidden) so the
                  existing ref-based upload logic is unchanged; the visible
                  button just opens it. */}
              <input
                ref={fileInputRef}
                id="doc-file"
                type="file"
                accept=".pdf,.txt,.md"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="sr-only"
              />
              <label
                htmlFor="doc-file"
                className="flex items-center gap-3 border border-dashed border-ctl-line rounded-xl px-3.5 py-2.5 text-sm cursor-pointer hover:border-ctl-amber"
              >
                <span className="text-ctl-amber shrink-0">{t.admin.documents.chooseFile}</span>
                <span className="text-ctl-muted truncate" dir="auto">
                  {fileName}
                </span>
              </label>
              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-ctl-amber text-ctl-night font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110"
              >
                {uploading ? t.admin.documents.uploading : t.admin.documents.upload}
              </button>
              {message && (
                <p className={`text-xs ${message.kind === "ok" ? "text-ctl-ok" : "text-ctl-bad"}`}>
                  {message.text}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
