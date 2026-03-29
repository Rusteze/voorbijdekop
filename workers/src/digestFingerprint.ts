import type { StoryJson } from "./digestSend.js";

/** Stabiele handtekening van de inhoud van één digest (volgorde + slug). */
export function storyListFingerprint(stories: StoryJson[]): string {
  return stories.map((s) => s.slug).join("|");
}

export async function digestSubscriberKvKey(email: string): Promise<string> {
  const enc = new TextEncoder().encode(email.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `digest:lastfp:${hex.slice(0, 40)}`;
}
