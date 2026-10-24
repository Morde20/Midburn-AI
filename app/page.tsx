"use client";

/**
 * app/page.tsx — "control room" chat interface with a conversation sidebar,
 * FAQ chips and a sources panel.
 *
 * Behavior (per Morde's spec):
 *   - The page ALWAYS lands on the empty-state homepage (photo banner +
 *     greeting + input + FAQ chips) on load — it never auto-resumes the
 *     last conversation.
 *   - Past conversations are listed in a sidebar. Clicking one loads its
 *     full history. (Sources are only available for answers streamed live
 *     in this session — stored history rows have text only.)
 *   - Sending a message from the homepage creates a new conversation
 *     (title derived from that first message) and switches to it.
 *   - Clicking a FAQ chip on the homepage sends that question to the
 *     assistant like any typed question (real RAG answer + sources). The
 *     sidebar FAQ accordion shows the static answers from lib/faq.ts.
 *   - After 5 minutes of no new messages in the active conversation, the
 *     view automatically resets to the homepage — the conversation itself
 *     is already persisted (every message is written server-side as it
 *     happens), this just stops it being the "active" view.
 *   - Sources: the server attaches the retrieved passages as message
 *     metadata (see app/api/chat/route.ts). On lg+ screens they are shown
 *     in a side panel for the latest answer; on smaller screens each
 *     answer has a collapsible "מקורות (n)" list underneath.
 *
 * conversationId travels to /api/chat as a query param (not the JSON body)
 * — see app/api/chat/route.ts for why.
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { SourceCard, type SourceItem } from "@/components/SourceCard";
import { AnswerText } from "@/components/AnswerText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { FAQ_ITEMS } from "@/lib/faq";

type HistoryRow = { id: string; role: "user" | "assistant"; content: string };
type ConversationRow = { id: string; title: string; updatedAt: string };
type HabakMessage = UIMessage<{ sources?: SourceItem[] }>;

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

// Amber duotone treatment for the Midburn photo.
const PHOTO_FILTER =
  "sepia(1) saturate(2.4) hue-rotate(-14deg) brightness(.66) contrast(1.15)";

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [faqOpen, setFaqOpen] = useState(false);
  // True while a reopened (historical) conversation is shown: no sources panel.
  const [isHistorical, setIsHistorical] = useState(false);
  const [openSourcesFor, setOpenSourcesFor] = useState<string | null>(null);
  // Sidebar is an always-visible column on md+ screens, but an off-canvas
  // drawer on phones (closed by default so the homepage isn't obstructed).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t, dir, locale } = useLanguage();

  const transport = useMemo(
    () =>
      new DefaultChatTransport<HabakMessage>({
        api: activeConversationId
          ? `/api/chat?conversationId=${activeConversationId}`
          : "/api/chat",
      }),
    [activeConversationId]
  );
  const { messages, sendMessage, status, setMessages } = useChat<HabakMessage>({ transport });
  // "Busy" covers both the pre-first-token phase (status "submitted" — the
  // server is still doing retrieval/translation work before any text
  // streams back) and active streaming ("streaming"). Checking only for
  // "streaming" left the UI looking frozen during that first phase, since
  // nothing was shown until the model's first token arrived.
  const isBusy = status === "submitted" || status === "streaming";

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setConversations(await res.json());
    setConversationsLoaded(true);
  }, []);

  // Always start at the homepage on mount — just load the sidebar list,
  // never auto-hydrate a past conversation into the active view.
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Once a brand-new conversation's id lands (see startNewConversation
  // below) and the transport above has re-memoized to point at it, send
  // the message that was waiting on that. Doing this in an effect (rather
  // than right after setActiveConversationId) guarantees `sendMessage`
  // here is bound to the already-updated transport.
  useEffect(() => {
    if (pendingFirstMessage && activeConversationId) {
      sendMessage({ text: pendingFirstMessage });
      setPendingFirstMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, pendingFirstMessage]);

  // 5-minute inactivity timer: resets to the homepage view if nothing new
  // has been sent/received in a while. The conversation is already fully
  // persisted server-side per message, so this only affects what's shown.
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (messages.length === 0) return;
    inactivityTimer.current = setTimeout(() => {
      setActiveConversationId(null);
      setIsHistorical(false);
      setMessages([]);
      loadConversations();
    }, INACTIVITY_TIMEOUT_MS);
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [messages, setMessages, loadConversations]);

  function goToHomepage() {
    setActiveConversationId(null);
    setIsHistorical(false);
    setMessages([]);
    setSidebarOpen(false); // no-op on desktop, closes the mobile drawer
  }

  async function openConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}/messages`);
    if (!res.ok) return;
    const rows: HistoryRow[] = await res.json();
    setMessages(
      rows.map((r) => ({
        id: r.id,
        role: r.role,
        parts: [{ type: "text" as const, text: r.content }],
      }))
    );
    setActiveConversationId(id);
    setIsHistorical(true);
    setSidebarOpen(false);
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation(); // don't also trigger openConversation on the row
    if (!confirm(t.chat.deleteConversationConfirm)) return;
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeConversationId) {
      goToHomepage();
    }
  }

  async function startNewConversation(text: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstMessage: text }),
    });
    if (!res.ok) return;
    const conversation: ConversationRow = await res.json();
    setConversations((prev) => [conversation, ...prev]);
    setPendingFirstMessage(text);
    setIsHistorical(false);
    setActiveConversationId(conversation.id);
  }

  // Shared by the input form and the FAQ chips: sends into the active
  // conversation, or starts a new one from the homepage.
  function sendQuestion(text: string) {
    if (!text.trim() || isBusy) return;
    if (activeConversationId) {
      setIsHistorical(false);
      sendMessage({ text });
    } else {
      startNewConversation(text);
    }
  }

  // FAQ questions (homepage chips + sidebar list): always open a NEW
  // conversation and send the question, so the user gets a real answer.
  function askFaq(text: string) {
    if (isBusy) return;
    setMessages([]);
    setSidebarOpen(false);
    startNewConversation(text);
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

  // Off-canvas drawer positioning on mobile: fixed to the side that matches
  // the sidebar's normal (dir-mirrored) position, slid fully offscreen when
  // closed. md+ overrides all of that back to a normal static column.
  const mobileDrawerPosition = dir === "rtl" ? "right-0" : "left-0";
  const mobileDrawerHidden = dir === "rtl" ? "translate-x-full" : "-translate-x-full";

  const sidebar = (
    <aside
      dir={dir}
      className={`absolute inset-y-0 ${mobileDrawerPosition} z-40 w-72 border-e border-ctl-line flex flex-col bg-ctl-panel shadow-2xl transition-transform duration-200 ease-in-out ${
        sidebarOpen ? "translate-x-0" : mobileDrawerHidden
      } md:static md:z-auto md:w-64 md:shadow-none md:translate-x-0 md:shrink-0`}
    >
      <div className="p-3 border-b border-ctl-line flex items-center gap-2">
        <button
          onClick={goToHomepage}
          className="flex-1 text-sm bg-ctl-panel2 border border-ctl-line text-ctl-amber rounded-xl px-4 py-2 hover:border-ctl-amber"
        >
          + {t.chat.newChat}
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label={t.chat.closeMenu}
          className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-ctl-line bg-ctl-panel2 text-ctl-muted hover:text-ctl-text"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <p className="px-4 pt-1 pb-2 text-xs text-ctl-muted">{t.chat.recent}</p>
        {!conversationsLoaded ? null : conversations.length === 0 ? (
          <p className="text-xs text-ctl-muted px-4 py-2">{t.chat.noConversations}</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`group w-full flex items-center gap-1 px-4 py-2 cursor-pointer hover:bg-ctl-panel2 ${
                c.id === activeConversationId ? "bg-ctl-panel2" : ""
              }`}
            >
              <span
                className={`flex-1 min-w-0 truncate text-sm ${
                  c.id === activeConversationId
                    ? "font-medium text-ctl-amber"
                    : "text-ctl-text/80"
                }`}
                title={c.title}
              >
                {c.title}
              </span>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                aria-label={t.chat.deleteConversation}
                title={t.chat.deleteConversation}
                className="shrink-0 text-ctl-muted hover:text-ctl-bad opacity-0 group-hover:opacity-100 text-xs px-1"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
      {/* FAQ accordion, pinned below the (scrollable) conversation list.
          Content is rendered above the toggle button so opening it grows
          the panel upward, shrinking the conversation list rather than
          pushing the button off the bottom of the sidebar. Static answers —
          see lib/faq.ts. */}
      <div className="border-t border-ctl-line shrink-0">
        {faqOpen && (
          <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3 border-b border-ctl-line">
            {FAQ_ITEMS.length === 0 ? (
              <p className="text-xs text-ctl-muted">{t.chat.faqEmpty}</p>
            ) : (
              FAQ_ITEMS.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isBusy}
                  onClick={() => askFaq(item.question[locale])}
                  className="block w-full text-start text-sm text-ctl-text/90 hover:text-ctl-amber disabled:opacity-50"
                >
                  {item.question[locale]}
                </button>
              ))
            )}
          </div>
        )}
        <button
          onClick={() => setFaqOpen((open) => !open)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-ctl-text/80 hover:bg-ctl-panel2"
        >
          <span>{t.chat.faq}</span>
          <span
            className={`text-xs text-ctl-muted transition-transform duration-200 ${
              faqOpen ? "rotate-180" : ""
            }`}
          >
            ▲
          </span>
        </button>
      </div>
    </aside>
  );

  const homeView = (
    <div className="flex-1 overflow-y-auto">
      {/* Photo banner with amber duotone, fading into the page. */}
      <div className="relative h-[clamp(13rem,28vw,24rem)] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/midburn-hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
          style={{ filter: PHOTO_FILTER }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ctl-night via-ctl-night/40 to-transparent" />
      </div>
      <div className="relative -mt-14 sm:-mt-12 px-4 pb-10 max-w-2xl w-full mx-auto flex flex-col items-center gap-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-ctl-text text-center">
          {t.chat.greeting}
        </h1>
        <div className="w-full pb-[env(safe-area-inset-bottom)]">{inputBar}</div>
        {FAQ_ITEMS.length > 0 && (
          <div className="w-full flex flex-wrap justify-center gap-2">
            {FAQ_ITEMS.map((item, i) => (
              <button
                key={i}
                type="button"
                disabled={isBusy}
                onClick={() => askFaq(item.question[locale])}
                className="text-[13px] text-ctl-text/90 bg-ctl-panel border border-ctl-line rounded-full px-4 py-2 hover:border-ctl-amber hover:text-ctl-amber disabled:opacity-50"
              >
                {item.question[locale]}
              </button>
            ))}
          </div>
        )}
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
        <div className="border-t border-ctl-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl w-full mx-auto">{inputBar}</div>
        </div>
      </div>

      {/* Desktop sources panel (end side) — live conversations only. */}
      {!isHistorical && (
      <aside
        dir={dir}
        className="hidden lg:flex lg:w-80 xl:w-96 shrink-0 flex-col border-s border-ctl-line bg-ctl-panel"
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
      )}
    </div>
  );

  // Backdrop behind the mobile drawer — clicking it closes the sidebar,
  // same as selecting a conversation or starting a new chat does. Hidden at
  // md+ where the sidebar is a static column, not an overlay.
  const mobileBackdrop = sidebarOpen ? (
    <div
      onClick={() => setSidebarOpen(false)}
      className="absolute inset-0 z-30 bg-black/50 md:hidden"
      aria-hidden="true"
    />
  ) : null;

  return (
    <div className="flex flex-col h-dvh bg-ctl-night">
      <Header onMenu={() => setSidebarOpen(true)} />
      {/* `relative` here is what the sidebar/backdrop's `absolute inset-*`
          position against — keeps the mobile drawer scoped to the area
          below the header instead of a `fixed` overlay covering it.
          DOM order is always sidebar-then-content: the `dir` attribute
          below makes the browser mirror the flex row automatically (start
          = left in ltr, right in rtl), so this one order already renders
          the sidebar on the left for English and the right for Hebrew —
          no manual swapping needed. */}
      <div className="relative flex flex-1 min-h-0" dir={dir}>
        {mobileBackdrop}
        {sidebar}
        <main className="flex flex-col flex-1 min-w-0">
          {isEmpty ? homeView : chatView}
        </main>
      </div>
    </div>
  );
}
