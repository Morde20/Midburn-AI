/**
 * components/AnswerText.tsx
 *
 * Renders an assistant answer as clean text. The model sometimes still emits
 * light Markdown ("## heading", "**bold**", "- item"); instead of showing
 * those symbols we turn them into simple headings, bullets and paragraphs.
 * Works on partial (streaming) text too.
 */

import { parseAnswer } from "@/lib/format-text";

export function AnswerText({ text }: { text: string }) {
  const blocks = parseAnswer(text);
  return (
    <div className="space-y-1.5">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p key={i} className="font-semibold text-ctl-amber pt-1.5 first:pt-0">
              {block.text}
            </p>
          );
        }
        if (block.kind === "bullet") {
          return (
            <p key={i} className="flex gap-2">
              <span className="shrink-0 text-ctl-amber" aria-hidden="true">
                {block.marker}
              </span>
              <span className="min-w-0">{block.text}</span>
            </p>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
