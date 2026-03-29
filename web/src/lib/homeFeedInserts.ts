/**
 * Optionele invoegingen tussen verhalen in "Overige verhalen" (mobiel).
 * - `afterRestIndex`: na het verhaal op die positie (0 = na het eerste verhaal in de lijst `rest`).
 * - Standaard wordt op één plek nog het AI-uitlegkaartje getoond (zie logica hieronder),
 *   tenzij je op dezelfde index al `kind: "ai-info"` uit deze lijst zet.
 *
 * Tip: niet te veel tegelijk (max. 1 extra promo per schermlengte), lage visuele druk
 * (zelfde kaartstijl als artikelen), duidelijke CTA — dan blijft het minder irritant dan klassieke ads.
 */
export type FeedInsert =
  | { id: string; kind: "ai-info" }
  | {
      id: string;
      kind: "promo";
      title: string;
      body: string;
      cta: string;
      href: string;
      external?: boolean;
    };

export const mobileRestFeedInserts: { afterRestIndex: number; insert: FeedInsert }[] = [
  // Voorbeeld (uit comment halen om te gebruiken):
  // {
  //   afterRestIndex: 6,
  //   insert: {
  //     id: "digest-teaser",
  //     kind: "promo",
  //     title: "Dagelijkse e-mailupdate",
  //     body: "Kort het belangrijkste nieuws in je inbox. Eén klik om je aan te melden.",
  //     cta: "Meer info",
  //     href: "/#digest",
  //     external: false,
  //   },
  // },
  // {
  //   afterRestIndex: 4,
  //   insert: {
  //     id: "quiz-teaser",
  //     kind: "promo",
  //     title: "Quiz van de dag",
  //     body: "Test je kennis op basis van de verhalen in deze editie.",
  //     cta: "Naar de quiz",
  //     href: "/#quiz-van-de-dag",
  //     external: false,
  //   },
  // },
];

/** Zelfde regels als voorheen: na 3e item, of na laatste als er < 3 items zijn. */
export function shouldSlotDefaultAiCard(restLen: number, index: number): boolean {
  if (restLen === 0) return false;
  if (restLen >= 3) return index === 2;
  return index === restLen - 1;
}

export function getMobileInsertsAfterStory(restLen: number, storyIndex: number): FeedInsert[] {
  const fromConfig = mobileRestFeedInserts
    .filter((x) => x.afterRestIndex === storyIndex)
    .map((x) => x.insert);
  const hasAiInConfig = fromConfig.some((i) => i.kind === "ai-info");
  const defaultAi: FeedInsert[] =
    !hasAiInConfig && shouldSlotDefaultAiCard(restLen, storyIndex)
      ? [{ id: "ai-uitleg", kind: "ai-info" }]
      : [];
  return [...fromConfig, ...defaultAi];
}
