type GeneratedStoryBase = {
  slug: string;
  generatedAt: string;
  shortHeadline?: string;
  [k: string]: any;
};

declare global {
  interface Window {
    __VOORBIJDEKOP_STORIES__?: GeneratedStoryBase[];
  }
}

export type GeneratedStory = GeneratedStoryBase;
export type GeneratedStoryWithHeadline = GeneratedStory & { shortHeadline?: string };

function sortByGeneratedAtDesc(items: GeneratedStoryWithHeadline[]) {
  return [...items].sort(
    (a, b) => new Date(String(b.generatedAt ?? "")).getTime() - new Date(String(a.generatedAt ?? "")).getTime()
  );
}

function loadStoriesRuntime(): GeneratedStoryWithHeadline[] {
  if (typeof window !== "undefined") {
    const fromWindow = Array.isArray(window.__VOORBIJDEKOP_STORIES__) ? window.__VOORBIJDEKOP_STORIES__ : [];
    return sortByGeneratedAtDesc(fromWindow as GeneratedStoryWithHeadline[]);
  }

  // Tijdens static export/prerender is `require` niet beschikbaar (Edge-achtige runtime).
  // Client pages krijgen hun data via `window.__VOORBIJDEKOP_STORIES__` of runtime fetch.
  return [];
}

export function getAllStories() {
  return loadStoriesRuntime();
}

export function getStoryBySlug(slug: string) {
  return loadStoriesRuntime().find((s) => s.slug === slug) ?? null;
}

