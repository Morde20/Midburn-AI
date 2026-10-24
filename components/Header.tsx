"use client";

/**
 * components/Header.tsx
 *
 * Shared top bar for every authenticated page ("control room" look): logo +
 * app name, nav links (Chat always; Users / Documents only for admins), the
 * Hebrew/English toggle, and logout. Session comes from NextAuth's
 * SessionProvider (see app/providers.tsx); language from LanguageProvider.
 *
 * `onMenu` (optional): when given, a hamburger button is shown on phones
 * (used by the chat page to open its conversations drawer).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Logo } from "@/components/Logo";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
        active
          ? "bg-ctl-panel2 text-ctl-amber"
          : "text-ctl-muted hover:text-ctl-text hover:bg-ctl-panel2"
      }`}
    >
      {children}
    </Link>
  );
}

export function Header({ onMenu }: { onMenu?: () => void }) {
  const { data: session } = useSession();
  const { t, toggleLocale } = useLanguage();
  const role = session?.user?.role;

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

      {/* On narrow screens this row wraps to its own full-width line below
          the app name / actions instead of squeezing links into nothing. */}
      <nav className="order-3 w-full flex items-center gap-1 flex-wrap sm:order-none sm:w-auto">
        <NavLink href="/">{t.nav.chat}</NavLink>
        {role === "admin" && (
          <>
            <NavLink href="/admin/users">{t.nav.adminUsers}</NavLink>
            <NavLink href="/admin/documents">{t.nav.adminDocuments}</NavLink>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleLocale}
          className="text-xs border border-ctl-line rounded-full px-3 py-1.5 text-ctl-muted hover:text-ctl-text hover:bg-ctl-panel2"
        >
          {t.common.langToggle}
        </button>
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs border border-ctl-line rounded-full px-3 py-1.5 text-ctl-muted hover:text-ctl-text hover:bg-ctl-panel2"
          >
            {t.nav.logout}
          </button>
        )}
      </div>
    </header>
  );
}
