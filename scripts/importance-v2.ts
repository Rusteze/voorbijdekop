import type { Story } from "./types.js";

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function canonicalDomain(d: string | null | undefined) {
  const s = String(d ?? "").toLowerCase().trim();
  if (!s) return "";
  if (s.endsWith(".nrc.nl")) return "nrc.nl";
  if (s === "reutersbest.com") return "reuters.com";
  if (s === "bbc.com") return "bbc.co.uk";
  if (s.startsWith("feeds.rijksoverheid.nl")) return "rijksoverheid.nl";
  return s;
}

const TIER1 = new Set([
  "reuters.com",
  "bbc.co.uk",
  "ft.com",
  "theguardian.com",
  "nos.nl",
  "nrc.nl",
  "volkskrant.nl",
  "trouw.nl",
  "apnews.com",
  "dw.com",
  "france24.com"
]);

const TIER2 = new Set([
  "warontherocks.com",
  "thecipherbrief.com",
  "defence-blog.com",
  "globalissues.org",
  "rijksoverheid.nl",
  "aljazeera.com",
  "politico.com",
  "arsstechnica.com",
  "arstechnica.com"
]);

function sourceCredibilityScore(domains: string[]) {
  if (domains.length === 0) return 0;
  let sum = 0;
  for (const d of domains) {
    const cd = canonicalDomain(d);
    if (!cd) continue;
    if (TIER1.has(cd)) sum += 1;
    else if (TIER2.has(cd)) sum += 0.65;
    else sum += 0.4;
  }
  const avg = sum / domains.length;
  // 0..1 → 0..30
  return Math.round(avg * 30);
}

function topicCriticalityScore(topic: string | undefined) {
  const t = String(topic ?? "overig").toLowerCase();
  // Higher for oorlog/defensie/energie/economie/technologie in deze vocabulaire.
  const high = new Set(["oorlog", "conflict", "defensie", "militaire strategie", "cyberoorlog", "hybride oorlog"]);
  const mediumHigh = new Set([
    "energiepolitiek",
    "grondstoffen",
    "handelsconflict",
    "sancties",
    "economische machtsstrijd",
    "desinformatie",
    "beïnvloeding",
    "technologische macht",
    "surveillance",
    "propaganda"
  ]);
  const medium = new Set(["geopolitiek", "diplomatie", "internationale betrekkingen", "politieke instabiliteit", "machtsverschuiving", "inlichtingen", "spionage"]);

  if (high.has(t)) return 30;
  if (mediumHigh.has(t)) return 20;
  if (medium.has(t)) return 12;
  return 6;
}

function recencyScore(nowMs: number, story: Story) {
  let latest = 0;
  for (const a of story.articles ?? []) {
    const ms = new Date(a.publishedAt ?? 0).getTime();
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  if (!latest) return 0;

  const ageHours = (nowMs - latest) / (1000 * 60 * 60);
  if (ageHours <= 12) return 30;
  if (ageHours <= 24) return 26;
  if (ageHours <= 48) return 20;
  if (ageHours <= 96) return 14;
  if (ageHours <= 240) return 9;
  if (ageHours <= 720) return 4;
  return 1;
}

function multiSourceBonus(story: Story) {
  const domains = new Set((story.articles ?? []).map((a) => canonicalDomain(a.sourceDomain)).filter(Boolean));
  const n = domains.size;
  if (n <= 1) return 2;
  if (n === 2) return 10;
  if (n === 3) return 16;
  return 20;
}

function entitySignificanceScore(story: Story) {
  const majorCountrySet = new Set(
    [
      "verenigde staten",
      "rusland",
      "oekraine",
      "oekraïne",
      "china",
      "iran",
      "israel",
      "gaza",
      "palestin",
      "hamas",
      "hezbollah",
      "iran",
      "nato",
      "eu",
      "verenigde staten",
      "verenigde staten van amerika",
      "ukraine",
      "verenigde koninkrijk",
      "saoedi-arabië",
      "saoe?di"
    ]
      .map((x) => x.toLowerCase())
      .filter(Boolean)
  );

  const ents = new Set<string>();
  for (const a of story.articles ?? []) {
    for (const e of a.entities ?? []) {
      const s = String(e ?? "").trim();
      if (!s) continue;
      ents.add(s);
    }
  }

  if (ents.size === 0) return 8;

  let majorHits = 0;
  let total = 0;
  for (const e of ents) {
    total += 1;
    const v = e.toLowerCase();
    if ([...majorCountrySet].some((c) => c && v.includes(c.replace(/\?.+$/, "")))) {
      majorHits += 1;
    } else if (v.includes("nato") || v.includes("eu") || v.includes("un")) {
      majorHits += 1;
    }
  }

  // Maak het 0..25 afhankelijk van aantal hits; log schaal om outliers te temmen.
  const ratio = total ? majorHits / total : 0;
  const raw = 25 * Math.log2(1 + 6 * ratio);
  return Math.round(clamp(raw, 0, 25));
}

export function computeImportanceV2(story: Story, nowMs: number = Date.now()): number {
  // Deterministische multi-factor score voor story-importantie.
  const domains = Array.from(new Set((story.articles ?? []).map((a) => a.sourceDomain).filter(Boolean)));
  const sourceScore = sourceCredibilityScore(domains);
  const topicScore = topicCriticalityScore(story.topic);
  const entityScore = entitySignificanceScore(story);
  const urgencyScore = recencyScore(nowMs, story);
  const multiScore = multiSourceBonus(story);

  // Weights: balance tussen "kwaliteit", "relevantie", "urgentie" en "consensus".
  const total =
    0.28 * sourceScore +
    0.26 * topicScore +
    0.22 * entityScore +
    0.18 * urgencyScore +
    0.26 * multiScore;

  // Normalizeer naar 0..100 op basis van theoretische max.
  const maxTotal =
    0.28 * 30 + // sourceScore
    0.26 * 30 + // topicScore
    0.22 * 25 + // entityScore
    0.18 * 30 + // urgencyScore
    0.26 * 20; // multiScore

  const normalized = clamp(Math.round((total / maxTotal) * 100), 0, 100);
  return normalized;
}

export type ImportanceBreakdownV2 = {
  score: number;
  factors: {
    sourceScore: number;
    topicScore: number;
    entityScore: number;
    urgencyScore: number;
    multiSourceScore: number;
  };
};

export function computeImportanceBreakdownV2(
  story: Story,
  nowMs: number = Date.now()
): ImportanceBreakdownV2 {
  const domains = Array.from(new Set((story.articles ?? []).map((a) => a.sourceDomain).filter(Boolean)));
  const sourceScore = sourceCredibilityScore(domains);
  const topicScore = topicCriticalityScore(story.topic);
  const entityScore = entitySignificanceScore(story);
  const urgencyScore = recencyScore(nowMs, story);
  const multiSourceScore = multiSourceBonus(story);

  const total =
    0.28 * sourceScore +
    0.26 * topicScore +
    0.22 * entityScore +
    0.18 * urgencyScore +
    0.26 * multiSourceScore;

  const maxTotal =
    0.28 * 30 + // sourceScore
    0.26 * 30 + // topicScore
    0.22 * 25 + // entityScore
    0.18 * 30 + // urgencyScore
    0.26 * 20; // multiScore

  const normalized = clamp(Math.round((total / maxTotal) * 100), 0, 100);

  return {
    score: normalized,
    factors: {
      sourceScore,
      topicScore,
      entityScore,
      urgencyScore,
      multiSourceScore
    }
  };
}

