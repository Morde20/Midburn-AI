"use client";

/**
 * components/Header.tsx
 *
 * Shared top bar ("control room" look): logo + app name and the
 * Hebrew/English toggle. No nav links — the documents page is reachable
 * only through its secret URL.
 *
 * `onMenu` (optional): when given, a hamburger button is shown on phones
 * (used by the chat page to open its menu drawer).
 */

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Logo } from "@/components/Logo";

export function Header({ onMenu }: { onMenu?: () => void }) {
  const { t, toggleLocale } = useLanguage();

  return (
    <header className="border-b border-ctl-line px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 bg-ctl-panel">
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label={t.chat.openMenu}
            className="md:hidden p-2 -m-1 shrink-0"
          >
            <span className="block w-5 h-0.5 bg-ctl-text mb-1.5" />
            <span className="block w-5 h-0.5 bg-ctl-text mb-1.5" />
            <span className="block w-5 h-0.5 bg-ctl-text" />
          </button>
        )}
        <Logo className="w-5 text-ctl-amber" />
        <span className="font-semibold text-ctl-text text-sm truncate">{t.app.name}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleLocale}
          className="text-xs border border-ctl-line rounded-full px-3 py-1.5 text-ctl-muted hover:text-ctl-text hover:bg-ctl-panel2"
        >
          {t.common.langToggle}
        </button>
      </div>
    </header>
  );
}
