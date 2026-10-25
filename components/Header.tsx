"use client";

/**
 * components/Header.tsx
 *
 * Shared top bar: Midburn logo + app name, an optional "New chat" button,
 * and the Hebrew/English toggle. No nav links — the documents page is
 * reachable only through its secret URL.
 *
 * `transparent` (optional): drops the bar background so it floats over the
 * homepage photo.
 *
 * `onNewChat` (optional): when given, a "+ New chat" button is shown (used
 * by the chat page while a conversation is open, to return to the homepage).
 */

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function Header({
  onNewChat,
  transparent = false,
}: {
  onNewChat?: () => void;
  transparent?: boolean;
}) {
  const { t, toggleLocale } = useLanguage();

  return (
    <header className={`border-b px-3 sm:px-6 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 ${
        transparent ? "border-transparent bg-transparent" : "border-ctl-line bg-ctl-panel/85"
      }`}>
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/midburn-logo.png" alt="Midburn" className="h-10 sm:h-12 w-auto shrink-0" />
        <span className="font-semibold text-ctl-text text-sm truncate">{t.app.name}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="text-xs sm:text-sm bg-ctl-panel2 border border-ctl-line text-ctl-amber rounded-full px-3.5 py-1.5 hover:border-ctl-amber"
          >
            + {t.chat.newChat}
          </button>
        )}
        <button
          onClick={toggleLocale}
          className="text-xs font-semibold border border-ctl-amber rounded-full px-3.5 py-1.5 bg-ctl-night/60 backdrop-blur-sm text-ctl-amber hover:bg-ctl-night/80"
        >
          {t.common.langToggle}
        </button>
      </div>
    </header>
  );
}
