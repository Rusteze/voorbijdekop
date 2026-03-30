import fs from "node:fs";
import path from "node:path";
import type { Story, StoryTopic } from "./types.js";
import { inferTopicFromText } from "./topicRegistry.js";

function storyLastUpdated(story: Story): number {
  const a = new Date(story.generatedAt ?? "").getTime();
  if (Number.isFinite(a) && a > 0) return a;
  const b = Math.max(
    ...((story.articles ?? []) as any[]).map((x) => new Date(x?.publishedAt ?? 0).getTime()).filter((t) => Number.isFinite(t))
  );
  return Number.isFinite(b) && b > 0 ? b : 0;
}

function storyTextForTopic(story: Story): string {
  const firstArticles = (story.articles ?? []).slice(0, 6);
  const articlesText = firstArticles
    .map((a: any) => `${a.titleNl ?? a.title ?? ""}\n${a.summaryNl ?? a.excerpt ?? ""}`)
    .join("\n");
  return `${story.title ?? ""}\n${story.summary ?? ""}\n${articlesText}`.trim();
}

function topKeywords(story: Story, max = 10): string[] {
  const freq = new Map<string, number>();
  for (const a of story.articles ?? []) {
    const ks: unknown = (a as any)?.keywords;
    if (!Array.isArray(ks)) continue;
    for (const k0 of ks) {
      const k = String(k0 ?? "").trim();
      if (!k) continue;
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, max)
    .map(([k]) => k);
}

function uniqueCount(arr: string[]) {
  return new Set(arr).size;
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

type MissingDomainFlags = {
  energyMissing: boolean;
  defenseMissing: boolean;
  economyMissing: boolean;
  techMissing: boolean;
};

function computeMissingDomainFlags(story: Story, assignedTopic: StoryTopic): MissingDomainFlags {
  const text = storyTextForTopic(story).toLowerCase();
  const hasEnergy =
    /\b(energie|energy|olie|oil|gas|lng|opec|pijplijn|pipeline|pipeline|commodity|commodities|grondstof|resources?|erts|mining)\b/i.test(text) ||
    story.articles.some((a: any) => (a.keywords ?? []).includes("oil") || (a.keywords ?? []).includes("gas"));

  const hasDefense =
    /\b(defensie|defense|leger|army|nato|navo|wapen|munitie|munition|drone|drone|wargame|military|munitie|drone)\b/i.test(text);

  const hasEconomy =
    /\b(trade war|tarief|tarieven|tariffs|importheffing|exportverbod|sanctie|sanctions|embargo|tarief|economische machtsstrijd|rivaliteit)\b/i.test(text);

  const hasTech =
    /\b(chips|semiconductor|exportcontrole|export control|cyber|hack|ransomware|phishing|surveillance|monitoring|technologische macht|cyberoorlog)\b/i.test(
      text
    );

  const energySet: StoryTopic[] = ["energiepolitiek", "grondstoffen"];
  const defenseSet: StoryTopic[] = ["defensie", "militaire strategie", "oorlog", "conflict", "hybride oorlog"];
  const economySet: StoryTopic[] = ["handelsconflict", "economische machtsstrijd", "sancties"];
  const techSet: StoryTopic[] = ["technologische macht", "cyberoorlog", "surveillance", "desinformatie", "beïnvloeding", "propaganda"];

  return {
    energyMissing: hasEnergy ? !energySet.includes(assignedTopic) : false,
    defenseMissing: hasDefense ? !defenseSet.includes(assignedTopic) : false,
    economyMissing: hasEconomy ? !economySet.includes(assignedTopic) : false,
    techMissing: hasTech ? !techSet.includes(assignedTopic) : false
  };
}

async function main() {
  const storiesPath = path.join(process.cwd(), "data", "generated", "stories.json");
  const raw = fs.readFileSync(storiesPath, "utf8");
  const stories = JSON.parse(raw) as Story[];
  if (!Array.isArray(stories) || stories.length === 0) {
    console.error("No stories found at", storiesPath);
    process.exit(1);
  }

  const limit = 50;
  const sample = [...stories]
    .sort((a, b) => storyLastUpdated(b) - storyLastUpdated(a))
    .slice(0, limit);

  let mismatchCount = 0;
  let genericAssignedOverig = 0;
  let genericButExpectedOther = 0;

  let energyMissingCount = 0;
  let defenseMissingCount = 0;
  let economyMissingCount = 0;
  let techMissingCount = 0;

  const lines: string[] = [];
  lines.push(`Topic assignment audit (latest ${limit} stories)`);
  lines.push(`GeneratedAt in dataset may differ from "now"; ordering based on story.generatedAt (fallback: max article publishedAt).`);
  lines.push("");

  for (const s of sample) {
    const assigned = (s.topic ?? "overig") as StoryTopic;
    const combinedText = storyTextForTopic(s);
    const expected = inferTopicFromText(combinedText) as StoryTopic;
    const mismatch = assigned !== expected;

    const ks = topKeywords(s, 10);
    const missingFlags = computeMissingDomainFlags(s, assigned);

    mismatchCount += mismatch ? 1 : 0;

    if (assigned === "overig") {
      genericAssignedOverig++;
      if (expected !== "overig") genericButExpectedOther++;
    }

    energyMissingCount += missingFlags.energyMissing ? 1 : 0;
    defenseMissingCount += missingFlags.defenseMissing ? 1 : 0;
    economyMissingCount += missingFlags.economyMissing ? 1 : 0;
    techMissingCount += missingFlags.techMissing ? 1 : 0;

    lines.push(`Story: ${s.slug}`);
    lines.push(`Title: ${String(s.title ?? "").slice(0, 140)}`);
    lines.push(`Assigned topic: ${assigned}`);
    lines.push(`Expected (rule): ${expected}`);
    lines.push(`Mismatch: ${mismatch ? "YES" : "NO"}`);
    lines.push(`Keywords(top): ${ks.join(", ")}`);
    lines.push(`Keywords(unique count): ${uniqueCount(ks)}/${ks.length}`);
    lines.push(
      `Missing domain flags: energy=${missingFlags.energyMissing ? "YES" : "NO"}, defense=${missingFlags.defenseMissing ? "YES" : "NO"}, economy=${
        missingFlags.economyMissing ? "YES" : "NO"
      }, tech=${missingFlags.techMissing ? "YES" : "NO"}`
    );
    lines.push("");
  }

  const mismatchRate = clamp01(mismatchCount / sample.length);
  const overigRate = clamp01(genericAssignedOverig / sample.length);
  const overigButShouldNot = clamp01(genericButExpectedOther / Math.max(1, genericAssignedOverig));

  lines.push("==== Summary ====");
  lines.push(`Sample size: ${sample.length}`);
  lines.push(`Mismatches (assigned != rule expected): ${mismatchCount}/${sample.length} (${(mismatchRate * 100).toFixed(1)}%)`);
  lines.push(`Assigned "overig": ${genericAssignedOverig}/${sample.length} (${(overigRate * 100).toFixed(1)}%)`);
  lines.push(`Overig but expected != overig: ${genericButExpectedOther}/${Math.max(1, genericAssignedOverig)} (${(overigButShouldNot * 100).toFixed(1)}% of "overig" cases)`);
  lines.push("");
  lines.push(`Missing domain signals (assigned topic not in that domain's topic set):`);
  lines.push(`- energy missing: ${energyMissingCount}`);
  lines.push(`- defense missing: ${defenseMissingCount}`);
  lines.push(`- economy missing: ${economyMissingCount}`);
  lines.push(`- tech missing: ${techMissingCount}`);

  const outPath = path.join(process.cwd(), "data", "topic-assignment-audit.txt");
  await fs.promises.writeFile(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote report: ${outPath}`);
  console.log(lines.slice(-12).join("\n"));
}

main().catch((e) => {
  console.error("audit-topic-assignment failed", e);
  process.exit(1);
});

