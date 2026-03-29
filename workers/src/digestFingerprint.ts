import type { StoryJson } from "./digestSend.js";

/** Stabiele handtekening van de inhoud van één digest (volgorde + slug). */
export function storyListFingerprint(stories: StoryJson[]): string {
  return stories.map((s) => s.slug).join("|");
}
