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
  const first = (story.articles ?? []).slice(0, 6) as any[];
  const articlesText = first
    .map((a) => `${a.titleNl ?? a.title ?? ""}\n${a.summaryNl ?? a.excerpt ?? ""}`)
    .join("\n");
  return `${story.title ?? ""}\n${story.summary ?? ""}\n${articlesText}`.trim();
}

async function main() {
  const storiesPath = path.join(process.cwd(), "data", "generated", "stories.json");
  const stories = JSON.parse(fs.readFileSync(storiesPath, "utf8")) as Story[];
  const limit = 50;
  const sample = [...stories].sort((a, b) => storyLastUpdated(b) - storyLastUpdated(a)).slice(0, limit);

  let mismatch = 0;
  let mismatchAfter = 0;

  for (const s of sample) {
    const assigned = (s.topic ?? "overig") as StoryTopic;
    const rule = inferTopicFromText(storyTextForTopic(s)) as StoryTopic;
    if (assigned !== rule) mismatch++;

    const corrected = rule === "overig" && assigned !== "overig" ? "overig" : assigned;
    if (corrected !== rule) mismatchAfter++;
  }

  console.log(`Original mismatch vs rule: ${mismatch}/${limit}`);
  console.log(`After overig-correction mismatch vs rule: ${mismatchAfter}/${limit}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

