"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Logo } from "@/components/Logo";

// Amber duotone treatment for the Midburn photo (same look as the chat home).
const PHOTO_FILTER =
  "sepia(1) saturate(2.4) hue-rotate(-14deg) brightness(.66) contrast(1.15)";

// useSearchParams() opts the page out of static rendering unless wrapped in
// a Suspense boundary — without this, `next build`'s prerender step for
// /login fails outright (not something `next dev` surfaces).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, dir } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setSubmitting(false);
    if (res?.error) {
      setError(t.login.error);
      return;
    }
    router.push(params.get("callbackUrl") || "/");
  }

  const inputCls =
    "w-full bg-ctl-panel border border-ctl-line rounded-xl px-4 py-3 text-sm text-ctl-text placeholder:text-ctl-muted focus:outline-none focus:border-ctl-amber";

  return (
    <main dir={dir} className="min-h-dvh bg-ctl-night flex flex-col md:flex-row">
      {/* Form side (first in DOM = right in Hebrew, left in English). */}
      <section className="relative z-10 flex flex-1 flex-col justify-center px-6 py-10 md:max-w-[480px] md:px-12 order-2 md:order-1">
        <div className="absolute top-4 end-4 md:top-6 md:end-6">
          <LanguageToggle />
        </div>
        <form onSubmit={onSubmit} className="w-full max-w-sm mx-auto space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <Logo className="w-9 text-ctl-amber" />
            <span className="text-xl font-semibold text-ctl-text">{t.app.name}</span>
          </div>
          <h1 className="text-lg font-semibold text-ctl-text">{t.login.title}</h1>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.login.username}
            autoComplete="username"
            dir={dir}
            className={inputCls}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.login.password}
            autoComplete="current-password"
            dir={dir}
            className={inputCls}
          />
          {error && <p className="text-xs text-ctl-bad">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ctl-amber text-ctl-night font-semibold rounded-xl py-3 text-sm disabled:opacity-50 hover:brightness-110"
          >
            {submitting ? t.login.submitting : t.login.submit}
          </button>
        </form>
      </section>

      {/* Photo side: banner on top on phones, a full-height panel on desktop.
          It fades toward the form side so the two blend into one surface. */}
      <section className="relative h-44 md:h-auto md:flex-1 overflow-hidden order-1 md:order-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/midburn-hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: PHOTO_FILTER }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ctl-night via-transparent to-transparent md:hidden" />
        <div className="absolute inset-0 hidden md:block bg-gradient-to-l rtl:bg-gradient-to-l ltr:bg-gradient-to-r from-ctl-night via-ctl-night/10 to-transparent" />
      </section>
    </main>
  );
}

function LanguageToggle() {
  const { t, toggleLocale } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="text-xs border border-ctl-line bg-ctl-panel/70 rounded-full px-3 py-1.5 text-ctl-muted hover:text-ctl-text"
    >
      {t.common.langToggle}
    </button>
  );
}
