import fs from "node:fs";
import path from "node:path";
import type { Story } from "./types.js";
import { classifyTopicsV2 } from "./topic-classify-v2.js";

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
  const raw = fs.readFileSync(storiesPath, "utf8");
  const stories = JSON.parse(raw) as Story[];
  if (!Array.isArray(stories) || stories.length === 0) {
    console.error("No stories at", storiesPath);
    process.exit(1);
  }

  const limit = 50;
  const sample = [...stories].sort((a, b) => storyLastUpdated(b) - storyLastUpdated(a)).slice(0, limit);

  let mismatches = 0;
  let overigCount = 0;
  const lines: string[] = [];
  lines.push(`Topic classify v2 audit (sample ${limit})`);
  lines.push("");

  for (const s of sample) {
    const assigned = (s.topic ?? "overig") as string;
    const res = classifyTopicsV2(s);
    const predicted = res.topics[0] ?? "overig";
    const mismatch = assigned !== predicted;
    if (mismatch) mismatches++;
    if (predicted === "overig") overigCount++;

    if (mismatch) {
      lines.push(`Story: ${s.slug}`);
      lines.push(`Title: ${String(s.title ?? "").slice(0, 140)}`);
      lines.push(`Assigned: ${assigned}`);
      lines.push(`Predicted(top): ${predicted} (confidence=${res.confidence.toFixed(2)})`);
      lines.push(
        `Why(top): ${(res.reasons[predicted] ?? []).slice(0, 5).join(", ")}`
      );
      lines.push("");
    }
  }

  lines.push("==== Summary ====");
  lines.push(`Mismatches assigned vs predicted(top): ${mismatches}/${sample.length} (${((mismatches / sample.length) * 100).toFixed(1)}%)`);
  lines.push(`Predicted overig count: ${overigCount}/${sample.length} (${((overigCount / sample.length) * 100).toFixed(1)}%)`);

  const outPath = path.join(process.cwd(), "data", "topic-classify-v2-audit.txt");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log("Wrote:", outPath);
  console.log(lines.slice(-4).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

