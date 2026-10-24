"use client";

/**
 * app/providers.tsx
 *
 * Single client-side wrapper combining NextAuth's SessionProvider (so any
 * client component can call useSession()/signOut() without prop-drilling
 * the session down from a server component) and LanguageProvider (i18n).
 */

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
