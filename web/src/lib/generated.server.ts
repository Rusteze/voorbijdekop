import fs from "node:fs";
import path from "node:path";

export type GeneratedStory = {
  slug: string;
  generatedAt: string;
  shortHeadline?: string;
  [k: string]: any;
};

export type GeneratedStoryWithHeadline = GeneratedStory & { shortHeadline?: string };

function loadStoriesFromFs(): GeneratedStoryWithHeadline[] {
  const filePath = path.join(process.cwd(), "data/generated/stories.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as GeneratedStoryWithHeadline[];
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
