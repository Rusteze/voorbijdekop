import { readStoriesJsonRaw } from "@/lib/readStoriesJson";

export type GeneratedStory = {
  slug: string;
  generatedAt: string;
  shortHeadline?: string;
  [k: string]: any;
};

export type GeneratedStoryWithHeadline = GeneratedStory & { shortHeadline?: string };

function loadStoriesFromFs(): GeneratedStoryWithHeadline[] {
  const raw = readStoriesJsonRaw().trim();
  if (!raw) return [];
  let parsed: GeneratedStoryWithHeadline[];
  try {
    parsed = JSON.parse(raw) as GeneratedStoryWithHeadline[];
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return [...parsed].sort(
    (a, b) => new Date(String(b.generatedAt ?? "")).getTime() - new Date(String(a.generatedAt ?? "")).getTime()
  );
}

export function getAllStories() {
  return loadStoriesFromFs();
}

export function getStoryBySlug(slug: string) {
  return loadStoriesFromFs().find((s) => s.slug === slug) ?? null;
}
