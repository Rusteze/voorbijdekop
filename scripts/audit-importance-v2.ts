import fs from "node:fs";
import path from "node:path";
import type { Story } from "./types.js";
import { computeImportanceBreakdownV2, computeImportanceV2 } from "./importance-v2.js";

function bucket(n: number) {
  if (n <= 20) return "0–20";
  if (n <= 40) return "20–40";
  if (n <= 60) return "40–60";
  if (n <= 80) return "60–80";
  return "80–100";
}

function storyLastUpdated(story: Story): number {
  const g = new Date(story.generatedAt ?? "").getTime();
  if (Number.isFinite(g) && g > 0) return g;
  let latest = 0;
  for (const a of story.articles ?? []) {
    const ms = new Date(a.publishedAt ?? 0).getTime();
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest;
}

async function main() {
  const storiesPath = path.join(process.cwd(), "data", "generated", "stories.json");
  const storiesRaw = fs.readFileSync(storiesPath, "utf8");
  const stories = JSON.parse(storiesRaw) as Story[];
  if (!Array.isArray(stories) || stories.length === 0) {
    console.error("No stories in", storiesPath);
    process.exit(1);
  }

  const nowMs = Date.now();

  const recomputed = stories.map((s) => {
    const v2 = computeImportanceV2(s, nowMs);
    return { slug: s.slug, title: s.title, old: s.importance, v2, topic: s.topic };
  });

  const dist: Record<string, number> = { "0–20": 0, "20–40": 0, "40–60": 0, "60–80": 0, "80–100": 0 };
  for (const r of recomputed) dist[bucket(r.v2)]++;

  console.log("Importance distribution (v2 recomputed):");
  for (const k of Object.keys(dist)) {
    const pct = (dist[k] / recomputed.length) * 100;
    console.log(`- ${k}: ${dist[k]} (${pct.toFixed(1)}%)`);
  }

  const top10 = [...recomputed].sort((a, b) => b.v2 - a.v2 || storyLastUpdated(b as any) - storyLastUpdated(a as any)).slice(0, 10);
  const bottom10 = [...recomputed].sort((a, b) => a.v2 - b.v2).slice(0, 10);

  console.log("\nTop 10 importance (v2):");
  for (const r of top10) console.log(`- ${r.v2} | ${r.topic} | ${r.slug} | old=${r.old}`);

  console.log("\nBottom 10 importance (v2):");
  for (const r of bottom10) console.log(`- ${r.v2} | ${r.topic} | ${r.slug} | old=${r.old}`);

  console.log("\nTop 3 breakdown:");
  for (const r of top10.slice(0, 3)) {
    const story = stories.find((x) => x.slug === r.slug);
    if (!story) continue;
    const b = computeImportanceBreakdownV2(story, nowMs);
    console.log(
      `- ${r.v2} | ${r.topic} | ${r.slug} | factors: source=${b.factors.sourceScore}, topic=${b.factors.topicScore}, entity=${b.factors.entityScore}, urgency=${b.factors.urgencyScore}, multi=${b.factors.multiSourceScore}`
    );
  }

  console.log("\nBottom 3 breakdown:");
  for (const r of bottom10.slice(0, 3)) {
    const story = stories.find((x) => x.slug === r.slug);
    if (!story) continue;
    const b = computeImportanceBreakdownV2(story, nowMs);
    console.log(
      `- ${r.v2} | ${r.topic} | ${r.slug} | factors: source=${b.factors.sourceScore}, topic=${b.factors.topicScore}, entity=${b.factors.entityScore}, urgency=${b.factors.urgencyScore}, multi=${b.factors.multiSourceScore}`
    );
  }

  const outPath = path.join(process.cwd(), "data", "importance-audit-v2.json");
  fs.writeFileSync(outPath, JSON.stringify(recomputed, null, 2), "utf8");
  console.log(`\nWrote: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

