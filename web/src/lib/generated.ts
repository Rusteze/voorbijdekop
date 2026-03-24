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

  // SSR: zelfde paden als readStoriesJson (cwd is meestal web/ op Cloudflare).
  const req = (0, eval)("require") as NodeRequire;
  const fs = req("node:fs") as typeof import("node:fs");
  const path = req("node:path") as typeof import("node:path");
  const candidates = [
    path.join(process.cwd(), "public", "data", "stories.json"),
    path.join(process.cwd(), "data", "generated", "stories.json"),
    path.join(process.cwd(), "..", "data", "generated", "stories.json")
  ];
  let raw = "[]";
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      raw = fs.readFileSync(p, "utf8");
      break;
    }
  }
  let parsed: GeneratedStoryWithHeadline[];
  try {
    parsed = JSON.parse(raw) as GeneratedStoryWithHeadline[];
  } catch {
    return [];
  }
  return sortByGeneratedAtDesc(Array.isArray(parsed) ? parsed : []);
}

export function getAllStories() {
  return loadStoriesRuntime();
}

export function getStoryBySlug(slug: string) {
  return loadStoriesRuntime().find((s) => s.slug === slug) ?? null;
}

