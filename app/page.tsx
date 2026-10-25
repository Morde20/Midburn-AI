"use client";

/**
 * app/page.tsx — "control room" chat interface with a wide homepage (full-
 * bleed photo, glass card with both logos, intro text, FAQ chips) and a
 * sources panel. Public: no login, and
 * nothing is stored server-side.
 *
 * Behavior:
 *   - The page lands on the empty-state homepage (Midburn + Past Forward
 *     logos, intro text, input + FAQ chips on a glass card over the photo). Conversations live
 *     only in this browser tab's memory; there is no history list and no
 *     sidebar — a "New chat" button in the header returns to the homepage.
 *   - Clicking a FAQ chip sends that question to the assistant like any
 *     typed question (real RAG answer + sources).
 *   - After 5 minutes of no new messages the view resets to the homepage.
 *   - Sources: the server attaches the retrieved passages as message
 *     metadata (see app/api/chat/route.ts). On lg+ screens they are shown
 *     in a side panel for the latest answer; on smaller screens each
 *     answer has a collapsible "מקורות (n)" list underneath.
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { SourceCard, type SourceItem } from "@/components/SourceCard";
import { AnswerText } from "@/components/AnswerText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { FAQ_ITEMS } from "@/lib/faq";

type HabakMessage = UIMessage<{ sources?: SourceItem[] }>;

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [openSourcesFor, setOpenSourcesFor] = useState<string | null>(null);
  const { t, dir, locale } = useLanguage();

  const transport = useMemo(
    () => new DefaultChatTransport<HabakMessage>({ api: "/api/chat" }),
    []
  );
  const { messages, sendMessage, status, setMessages } = useChat<HabakMessage>({ transport });
  // "Busy" covers both the pre-first-token phase (status "submitted" — the
  // server is still doing retrieval/translation work before any text
  // streams back) and active streaming ("streaming"). Checking only for
  // "streaming" left the UI looking frozen during that first phase, since
  // nothing was shown until the model's first token arrived.
  const isBusy = status === "submitted" || status === "streaming";

  // 5-minute inactivity timer: resets to the homepage view if nothing new
  // has been sent/received in a while.
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (messages.length === 0) return;
    inactivityTimer.current = setTimeout(() => {
      setMessages([]);
    }, INACTIVITY_TIMEOUT_MS);
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [messages, setMessages]);

  function goToHomepage() {
    setMessages([]);
  }

  function sendQuestion(text: string) {
    if (!text.trim() || isBusy) return;
    sendMessage({ text });
  }

  // FAQ chips: start a fresh chat and send the question, so the user gets
  // a real answer.
  function askFaq(text: string) {
    if (isBusy) return;
    setMessages([]);
    sendMessage({ text });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    const text = input;
    setInput("");
    sendQuestion(text);
  }

  const inputBar = (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 w-full bg-ctl-panel border border-ctl-line rounded-2xl ps-4 pe-2 py-2 focus-within:border-ctl-amber"
    >
      <span dir="ltr" aria-hidden="true" className="text-ctl-amber font-semibold select-none">
        &gt;
      </span>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t.chat.placeholder}
        dir={dir}
        className="flex-1 min-w-0 bg-transparent text-sm text-ctl-text placeholder:text-ctl-muted py-2 focus:outline-none"
      />
      <button
        type="submit"
        disabled={isBusy || !input.trim()}
        className="bg-ctl-amber text-ctl-night font-semibold rounded-xl px-5 py-2 text-sm disabled:opacity-40 shrink-0 hover:brightness-110"
      >
        {t.chat.send}
      </button>
    </form>
  );

  // Same direction-mirrored alignment as the message bubbles: Hebrew =
  // right, English = left.
  const userAlign = dir === "rtl" ? "ml-auto" : "mr-auto";
  const assistantAlign = dir === "rtl" ? "mr-auto" : "ml-auto";
  const isEmpty = messages.length === 0;

  // Sources of the latest assistant answer (for the desktop side panel).
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const panelSources = lastAssistant?.metadata?.sources ?? [];

  const homeView = (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <section className="w-full max-w-[960px] glass-text bg-ctl-panel/25 backdrop-blur-none border border-ctl-text/15 rounded-[32px] px-6 py-8 sm:px-12 sm:py-11 shadow-2xl flex flex-col items-center gap-5 sm:gap-6">
          <h1 className="sr-only">{t.chat.greeting}</h1>

          {/* Midburn + Past Forward 2026 logos, side by side. */}
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/midburn-logo.png" alt="Midburn" className="h-20 sm:h-28 w-auto" />
            <div aria-hidden="true" className="w-px h-14 sm:h-20 bg-ctl-text/20" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/past-forward-2026.png"
              alt="Past Forward — Midburn 2026"
              className="h-16 sm:h-24 w-auto max-w-full"
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold leading-snug text-ctl-amber text-center">
            {t.home.title}
          </h2>

          <div className="max-w-[720px] text-center flex flex-col gap-3">
            <p className="text-lg sm:text-[19px] font-semibold">{t.home.p1}</p>
            <p className="text-base leading-relaxed">{t.home.p2}</p>
            <p className="text-base leading-relaxed">{t.home.p3}</p>
            <p className="text-base leading-relaxed">{t.home.p4}</p>
            <p className="text-[17px] font-semibold">{t.home.p5}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#C4AF98]">{t.home.disclaimer}</p>
          </div>

          <div className="w-full h-px bg-ctl-text/15" />

          <div className="w-full max-w-[760px] pb-[env(safe-area-inset-bottom)]">{inputBar}</div>

          {FAQ_ITEMS.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2.5">
              {FAQ_ITEMS.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isBusy}
                  onClick={() => askFaq(item.question[locale])}
                  className="text-sm text-ctl-text/90 bg-ctl-night/55 border border-[#5A4635] rounded-full px-4 py-2.5 hover:border-ctl-amber hover:text-ctl-amber disabled:opacity-50"
                >
                  {item.question[locale]}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );

  const chatView = (
    <div className="flex flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          <div className="max-w-2xl w-full mx-auto space-y-4">
            {messages.map((m) => {
              const sources = m.metadata?.sources ?? [];
              return (
                <div key={m.id} className="flex flex-col">
                  <div
                    dir={dir}
                    className={`rounded-2xl px-4 py-2.5 max-w-[88%] text-sm leading-relaxed ${
                      m.role === "user" ? "whitespace-pre-wrap" : ""
                    } ${
                      m.role === "user"
                        ? `bg-ctl-panel2 border border-ctl-line text-ctl-text ${userAlign}`
                        : `bg-ctl-panel border border-ctl-line border-s-2 border-s-ctl-amber text-ctl-text ${assistantAlign}`
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <AnswerText
                        text={m.parts
                          .map((part) => (part.type === "text" ? part.text : ""))
                          .join("")}
                      />
                    ) : (
                      m.parts.map((part, i) =>
                        part.type === "text" ? <span key={i}>{part.text}</span> : null
                      )
                    )}
                  </div>
                  {/* Phones / tablets: collapsible sources under the answer.
                      On lg+ the side panel shows them instead. */}
                  {m.role === "assistant" && sources.length > 0 && (
                    <div dir={dir} className={`lg:hidden mt-2 max-w-[88%] ${assistantAlign}`}>
                      <button
                        type="button"
                        onClick={() => setOpenSourcesFor(openSourcesFor === m.id ? null : m.id)}
                        className="text-xs text-ctl-amber border border-ctl-line rounded-full px-3 py-1 hover:border-ctl-amber"
                      >
                        {t.chat.sourcesCount} ({sources.length}){" "}
                        <span aria-hidden="true">{openSourcesFor === m.id ? "▲" : "▼"}</span>
                      </button>
                      {openSourcesFor === m.id && (
                        <div className="mt-2 space-y-2">
                          {sources.map((s, i) => (
                            <SourceCard key={`${m.id}-${i}`} source={s} index={i} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {isBusy && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-sm text-ctl-muted">
                <span className="flex gap-1">
                  <span
                    className="w-1.5 h-1.5 bg-ctl-amber rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-ctl-amber rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-ctl-amber rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
                {t.chat.thinking}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-ctl-line bg-ctl-night/70 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl w-full mx-auto">{inputBar}</div>
        </div>
      </div>

      {/* Desktop sources panel (end side). */}
      <aside
        dir={dir}
        className="hidden lg:flex lg:w-80 xl:w-96 shrink-0 flex-col border-s border-ctl-line bg-ctl-panel/90"
      >
        <div className="px-4 py-3 border-b border-ctl-line">
          <h2 className="text-sm font-medium text-ctl-text">{t.chat.sources}</h2>
          <p className="text-xs text-ctl-muted mt-0.5">{t.chat.sourcesNote}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {panelSources.length === 0 ? (
            <p className="text-xs text-ctl-muted px-1 py-2">{t.chat.noSources}</p>
          ) : (
            panelSources.map((s, i) => (
              <SourceCard key={`${lastAssistant?.id}-${i}`} source={s} index={i} />
            ))
          )}
        </div>
      </aside>
    </div>
  );

  return (
    <div className="relative flex flex-col h-dvh bg-ctl-night overflow-hidden">
      {/* Midburn photo behind everything: lightly dimmed on the homepage,
          almost fully dimmed while chatting so text stays readable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/midburn-photo.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_55%]"
      />
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${
          isEmpty
            ? "bg-gradient-to-b from-ctl-night/25 via-ctl-night/55 to-ctl-night/90"
            : "bg-ctl-night/90"
        }`}
      />
      <div className="relative flex flex-col flex-1 min-h-0">
        <Header onNewChat={isEmpty ? undefined : goToHomepage} transparent={isEmpty} />
        <main dir={dir} className="flex flex-col flex-1 min-h-0 min-w-0">
          {isEmpty ? homeView : chatView}
        </main>
      </div>
    </div>
  );
}
