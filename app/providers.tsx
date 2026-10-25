"use client";

/**
 * app/providers.tsx
 *
 * Client-side wrapper for the LanguageProvider (i18n).
 */

import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

export function Providers({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
