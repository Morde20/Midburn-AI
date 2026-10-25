import "./globals.css";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Providers } from "./providers";

// One font for the whole app (IBM Plex Sans Hebrew, SIL Open Font License —
// see app/fonts/OFL-LICENSE.txt). Bundled locally (Hebrew + Latin merged per
// weight) instead of next/font/google so the production build never needs
// internet access to fonts.googleapis.com.
const plex = localFont({
  src: [
    { path: "./fonts/IBMPlexSansHebrew-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSansHebrew-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSansHebrew-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexSansHebrew-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-plex",
  display: "swap",
});

export const metadata = {
  title: "מידברן AI | Midburn AI",
  description: "Procedures assistant for Midburn 2026",
};

// viewportFit: "cover" lets content extend under the iPhone notch/home
// indicator safe areas so env(safe-area-inset-*) (used near the input bar in
// app/page.tsx) resolves to real values instead of 0.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Hebrew/RTL by default so the initial server-rendered HTML matches
// DEFAULT_LOCALE in lib/i18n/dictionary.ts — no flash of English/LTR before
// LanguageProvider mounts. LanguageProvider flips these on the client only
// if the user has previously toggled to English (see localStorage restore).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={plex.variable}>
      <body className="bg-ctl-night text-ctl-text font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
