import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { VoorbijDekopHeader } from "./voorbijdekop-header";
import { VoorbijDekopProvider } from "./voorbijdekop-state";
import { ThemeSettingsOverlay } from "./theme-settings-overlay";
import { SearchOverlay } from "./search-overlay";
import { AiInfoOverlay } from "./ai-info-overlay";
import fs from "node:fs";
import path from "node:path";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "voorbijdekop",
  description: "Statisch gebouwde, analytische nieuwsverhalen met onderzoekslaag.",
};
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const storiesPath = path.join(process.cwd(), "data/generated/stories.json");
  const storiesRaw = fs.existsSync(storiesPath) ? fs.readFileSync(storiesPath, "utf8") : "[]";
  const storiesJson = storiesRaw.replace(/</g, "\\u003c");

  return (
    <html lang="nl" className="light" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script
          // Voorkom flash: class op <html> (Tailwind darkMode: class + CSS-variabelen). Systeem alleen als modus "system".
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var key = "theme";
                  var saved = localStorage.getItem(key);
                  var mode = saved || "system";
                  var mql = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
                  function resolve() {
                    if (mode === "dark") return "dark";
                    if (mode === "light") return "light";
                    return mql && mql.matches ? "dark" : "light";
                  }
                  var r = resolve();
                  var el = document.documentElement;
                  el.classList.remove("light", "dark");
                  el.classList.add(r);
                } catch (e) {}
              })();
            `
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__VOORBIJDEKOP_STORIES__ = ${storiesJson};`
          }}
        />
        <VoorbijDekopProvider>
          <VoorbijDekopHeader />
          <ThemeSettingsOverlay />
          <SearchOverlay />
          <AiInfoOverlay />
          {children}
        </VoorbijDekopProvider>
      </body>
    </html>
  );
}
