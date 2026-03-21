import stories from "../../../data/generated/stories.json";

export type GeneratedStory = (typeof stories)[number];
// Laat JSON zich ook uitbreiden met nieuwe velden (bv. shortHeadline)
// zonder dat we meteen data/generated/stories.json hoeven te regenereren.
export type GeneratedStoryWithHeadline = GeneratedStory & { shortHeadline?: string };

export function getAllStories() {
  return stories as GeneratedStoryWithHeadline[];
}

export function getStoryBySlug(slug: string) {
  return (stories as GeneratedStoryWithHeadline[]).find((s) => s.slug === slug) ?? null;
}

