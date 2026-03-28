import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { VoorbijDekopHeader } from "./voorbijdekop-header";
import { VoorbijDekopProvider } from "./voorbijdekop-state";
import { ThemeSettingsOverlay } from "./theme-settings-overlay";
import { SearchOverlay } from "./search-overlay";
import { AiInfoOverlay } from "./ai-info-overlay";
import { StorySwipeNav } from "./story-swipe-nav";
import { readStoriesJsonRaw } from "@/lib/readStoriesJson";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://voorbijdekop.pages.dev"),
  title: "voorbijdekop",
  description: "Statisch gebouwde, analytische nieuwsverhalen met onderzoekslaag.",
  openGraph: {
    title: "voorbijdekop",
    description: "Statisch gebouwde, analytische nieuwsverhalen met onderzoekslaag.",
    type: "website"
  }
};
// Let op: `revalidate = 0` markeert routes als "dynamic" en breekt static export.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const storiesRaw = readStoriesJsonRaw();
  const storiesJson = storiesRaw.replace(/</g, "\\u003c");

  return (
    <html lang="nl" className="light" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script
          // Voorkom flash: class op <html> (Tailwind darkMode: class + CSS-variabelen).
          // De site-keuze is leidend (licht/donker), niet de OS-instelling.
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var key = "theme";
                  var saved = localStorage.getItem(key);
                  // Oude waarde "system" migreren naar "light" zodat mobiel OS-thema niet override.
                  if (saved === "system") {
                    saved = "light";
                    localStorage.setItem(key, "light");
                  }
                  var mode = saved === "dark" ? "dark" : "light";
                  var el = document.documentElement;
                  el.classList.remove("light", "dark");
                  el.classList.add(mode);
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
          <StorySwipeNav />
          {children}
        </VoorbijDekopProvider>
      </body>
    </html>
  );
}
