"use client";

/**
 * components/SourceCard.tsx
 *
 * One retrieved source passage shown next to (desktop) or under (mobile) an
 * assistant answer. The raw chunk text (PDF-extracted, hard-wrapped) is
 * tidied into paragraphs first. Collapsed: title + the first lines.
 * Expanded: the full passage, scrollable inside the card if it is long.
 */

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatSourceText } from "@/lib/format-text";

export type SourceItem = { title: string; content: string };

export function SourceCard({ source, index }: { source: SourceItem; index: number }) {
  const [open, setOpen] = useState(false);
  const { t, dir } = useLanguage();
  const paragraphs = useMemo(() => formatSourceText(source.content), [source.content]);

  return (
    <div dir={dir} className="rounded-xl border border-ctl-line bg-ctl-panel2 px-3.5 py-3 text-start">
      <p className="text-xs text-ctl-amber font-medium mb-2">
        {index + 1}. {source.title}
      </p>
      {open ? (
        <div className="space-y-2 text-[13px] leading-relaxed text-ctl-text/90 max-h-64 overflow-y-auto pe-1">
          {paragraphs.map((p, i) => (
            <p key={i} dir="auto">
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p dir="auto" className="text-[13px] leading-relaxed text-ctl-text/90 line-clamp-4">
          {paragraphs.join(" ")}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 text-xs text-ctl-muted hover:text-ctl-amber"
      >
        {open ? t.chat.showLess : t.chat.showMore}
      </button>
    </div>
  );
}
