import fs from "node:fs";
import path from "node:path";
import type { Story, StoryTopic } from "./types.js";
import { inferTopicFromText } from "./topicRegistry.js";

function storyLastUpdated(story: Story): number {
  const g = new Date(story.generatedAt ?? "").getTime();
  if (Number.isFinite(g) && g > 0) return g;
  let latest = 0;
  for (const a of story.articles ?? []) {
    const ms = new Date((a as any).publishedAt ?? 0).getTime();
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest;
}

function storyTextForTopic(story: Story): string {
  const firstArticles = (story.articles ?? []).slice(0, 6) as any[];
  const articlesText = firstArticles
    .map((a) => `${a.titleNl ?? a.title ?? ""}\n${a.summaryNl ?? a.excerpt ?? ""}`)
    .join("\n");
  return `${story.title ?? ""}\n${story.summary ?? ""}\n${articlesText}`.trim();
}

async function main() {
  const storiesPath = path.join(process.cwd(), "data", "generated", "stories.json");
  const raw = fs.readFileSync(storiesPath, "utf8");
  const stories = JSON.parse(raw) as Story[];
  if (!Array.isArray(stories) || stories.length === 0) {
    console.error("No stories at", storiesPath);
    process.exit(1);
  }

  const limit = 50;
  const sample = [...stories].sort((a, b) => storyLastUpdated(b) - storyLastUpdated(a)).slice(0, limit);

  const dir = new Map<string, number>();

  let mismatch = 0;
  for (const s of sample) {
    const assigned = (s.topic ?? "overig") as StoryTopic;
    const expected = inferTopicFromText(storyTextForTopic(s)) as StoryTopic;
    if (assigned !== expected) mismatch++;

    const key = `${assigned}->${expected}`;
    dir.set(key, (dir.get(key) ?? 0) + 1);
  }

  console.log(`Mismatch: ${mismatch}/${sample.length}`);
  console.log("Directionality (top):");
  const entries = [...dir.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of entries.slice(0, 20)) {
    console.log(`${k}: ${v}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

