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

  // SSR pad voor client component pre-rendering zonder statische JSON import.
  const req = (0, eval)("require") as NodeRequire;
  const fs = req("node:fs") as typeof import("node:fs");
  const path = req("node:path") as typeof import("node:path");
  const filePath = path.join(process.cwd(), "data/generated/stories.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as GeneratedStoryWithHeadline[];
  return sortByGeneratedAtDesc(parsed);
}

export function getAllStories() {
  return loadStoriesRuntime();
}

export function getStoryBySlug(slug: string) {
  return loadStoriesRuntime().find((s) => s.slug === slug) ?? null;
}

