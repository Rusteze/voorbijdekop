import type { Story } from "./types.js";

export type ImportanceBreakdown = {
  source: number;
  topic: number;
  entity: number;
  impact: number;
  narrative: number;
  recency: number; // 0..1
  multiSource: number;
  audience: number; // 0.7..1.5
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toLowerSafe(s: unknown) {
  return String(s ?? "").toLowerCase();
}

function latestPublishedAtHours(story: Story, nowMs: number) {
  let latest = 0;
  for (const a of story.articles ?? []) {
    const ms = new Date(a.publishedAt ?? 0).getTime();
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  if (!latest) return null;
  return (nowMs - latest) / (1000 * 60 * 60);
}

function distinct<T>(arr: T[]) {
  return Array.from(new Set(arr));
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

// Sterk/zeker qua domein (heuristisch, deterministisch).
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
  "arsstechnica.com"
]);

function computeSourceScore(story: Story): number {
  const domains = distinct((story.articles ?? []).map((a) => canonicalDomain(a.sourceDomain)).filter(Boolean));
  if (domains.length === 0) return 10;

  let sum = 0;
  for (const d of domains) {
    if (TIER1.has(d)) sum += 100;
    else if (TIER2.has(d)) sum += 70;
    else sum += 45;
  }
  const avg = sum / domains.length;
  return Math.round(avg); // 0..100
}

function computeTopicScore(story: Story): number {
  const topics = (Array.isArray(story.topics) && story.topics.length ? story.topics : [story.topic ?? "overig"]).map(String);
  const tSet = new Set(topics);

  const high = new Set(["oorlog", "defensie", "militaire strategie", "cyberoorlog", "hybride oorlog", "conflict"]);
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
  const medium = new Set([
    "geopolitiek",
    "diplomatie",
    "internationale betrekkingen",
    "politieke instabiliteit",
    "machtsverschuiving",
    "inlichtingen",
    "spionage"
  ]);

  // Neem het hoogste signaal dat past.
  let best = 15;
  for (const t of tSet) {
    if (high.has(t)) best = Math.max(best, 100);
    else if (mediumHigh.has(t)) best = Math.max(best, 75);
    else if (medium.has(t)) best = Math.max(best, 50);
    else if (t === "overig") best = Math.max(best, 25);
  }

  return clamp(best, 0, 100);
}

function computeMultiSourceScore(story: Story): number {
  const domains = distinct((story.articles ?? []).map((a) => canonicalDomain(a.sourceDomain)).filter(Boolean));
  const n = domains.length;
  if (n <= 1) return 15;
  const capped = Math.min(n, 5);
  return Math.round((capped / 5) * 100); // 20..100
}

const MAJOR_ENTITY_TOKENS = [
  "verenigde staten",
  "oekraïne",
  "ukraine",
  "rusland",
  "china",
  "iran",
  "israel",
  "nato",
  "eu",
  "europa",
  "un",
  "verenigde naties",
  "saoedi-arabië",
  "saoedi arabie",
  "turkije",
  "qatar",
  "emiraten",
  "verenigd koninkrijk",
  "uk",
  "frankrijk",
  "duitsland",
  "vatiek",
  "vatican"
];

function computeEntityScore(story: Story): number {
  const ents = distinct((story.articles ?? []).flatMap((a: any) => Array.isArray(a.entities) ? a.entities : []).map((e) => String(e)));
  if (ents.length === 0) return 20;

  let total = 0;
  let majorHits = 0;
  for (const e of ents) {
    const v = e.toLowerCase();
    if (!v.trim()) continue;
    total += 1;
    const hit = MAJOR_ENTITY_TOKENS.some((t) => {
      const tt = t.toLowerCase();
      // Loose contains match; deterministic.
      return v.includes(tt);
    });
    if (hit) majorHits += 1;
  }

  if (total === 0) return 20;
  const ratio = majorHits / total;
  // ratio 0..1 → 20..100 (sqrt voor minder harde spreiding)
  const score = 20 + 80 * Math.sqrt(ratio);
  return clamp(Math.round(score), 0, 100);
}

function computeImpactScore(story: Story): number {
  const topics = (Array.isArray(story.topics) && story.topics.length ? story.topics : [story.topic ?? "overig"]).map(String);
  const tSet = new Set(topics);

  let score = 0;

  const energy = new Set(["energiepolitiek", "grondstoffen"]);
  const economy = new Set(["economische machtsstrijd", "handelsconflict", "sancties"]);
  const war = new Set(["oorlog", "defensie", "militaire strategie", "cyberoorlog", "hybride oorlog", "conflict"]);

  if (topics.some((t) => energy.has(t))) score += 20;
  if (topics.some((t) => economy.has(t))) score += 20;
  if (topics.some((t) => war.has(t))) score += 25;

  // Detectie van vitale infrastructuur + burgerimpact via tekst.
  const text = [
    story.title,
    story.summary,
    story.ai?.narrative ?? "",
    (story.ai as any)?.facts?.join("\n") ?? "",
    ...(story.articles ?? []).slice(0, 6).map((a: any) => a.summaryNl ?? a.excerpt ?? a.title ?? "")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const criticalInfra = /\b(infrastructuur|stroomnet|power\s*grid|energiecentrale|raffinader|ontzilting|ontziltingsinstallatie|datacenter|data\s*center|netwerk|elektriciteit|electricity)\b/i.test(text);
  const civilians = /\b(burgers|civiel|gewond|doden|arbeiders|workers|ziekenhuis|hospital|slachtoffers|mensen)\b/i.test(text);

  if (criticalInfra) score += 15;
  if (civilians) score += 15;

  return clamp(Math.round(score), 0, 100);
}

function computeNarrativeScore(story: Story): number {
  // Deterministisch: hoe "breed" de story is (cluster grootte).
  const n = Math.min(10, Math.max(0, story.articles?.length ?? 0));
  const aiBoost = story.aiStatus === "ok" ? 10 : 0;
  const score = n * 10 + aiBoost;
  return clamp(score, 0, 100);
}

function computeRecencyScore(story: Story, nowMs: number): number {
  const hours = latestPublishedAtHours(story, nowMs);
  if (hours === null) return 0.05;
  // exp(-k*hours): k=0.05 → ~0.0067 na 100 uur
  return clamp(Math.exp(-0.05 * hours), 0, 1);
}

function computeAudienceScore(story: Story): number {
  const text = [
    story.title,
    story.summary,
    ...(story.articles ?? []).slice(0, 6).map((a: any) => a.summaryNl ?? a.excerpt ?? a.title ?? "")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const entitiesText = (story.articles ?? [])
    .flatMap((a: any) => Array.isArray(a.entities) ? a.entities : [])
    .map((e: any) => String(e).toLowerCase())
    .join(" ");

  const nlMention = /\b(nederland|den\s*haag|amsterdam|rotterdam|utrecht|rijksoverheid)\b/i.test(text) || /\b(nederland|den\s*haag|amsterdam|rotterdam|utrecht)\b/i.test(entitiesText);
  const euMention = /\b(eu|europa|europese\s+unie)\b/i.test(text) || /\b(eu|europa|europese\s+unie)\b/i.test(entitiesText);

  // Penalty: heel lokale buitenlandse focus zonder NL/EU signaal.
  const warEnergyEconomy = new Set(["oorlog", "defensie", "militaire strategie", "cyberoorlog", "hybride oorlog", "conflict", "energiepolitiek", "grondstoffen", "economische machtsstrijd", "handelsconflict", "sancties"]);
  const topics = (Array.isArray(story.topics) && story.topics.length ? story.topics : [story.topic ?? "overig"]).map(String);
  const hasGlobalCritical = topics.some((t) => warEnergyEconomy.has(t));

  let score = 1;
  if (nlMention) score += 0.3;
  if (euMention) score += 0.15;

  if (!nlMention && !euMention && !hasGlobalCritical) {
    // If it mentions exactly one major foreign entity, penalize a bit.
    const foreignCandidates = MAJOR_ENTITY_TOKENS.filter((t) => {
      const tt = t.toLowerCase();
      if (tt.includes("nederland") || tt.includes("den haag") || tt.includes("amsterdam")) return false;
      const m = (text.includes(tt) || entitiesText.includes(tt)) && tt.length > 2;
      return m;
    });
    if (foreignCandidates.length === 1) score -= 0.2;
  }

  return clamp(score, 0.7, 1.5);
}

function normalizeFinal(finalScore: number) {
  // max ~ base(100)*recency(1)*audience(1.5) = 150
  const normalized = clamp((finalScore / 150) * 100, 0, 100);
  return Math.round(normalized);
}

export function computeImportanceV3(story: Story, nowMs: number = Date.now()): {
  score: number;
  breakdown: ImportanceBreakdown;
} {
  const source = computeSourceScore(story);
  const topic = computeTopicScore(story);
  const entity = computeEntityScore(story);
  const impact = computeImpactScore(story);
  const narrative = computeNarrativeScore(story);
  const multiSource = computeMultiSourceScore(story);

  const recency = computeRecencyScore(story, nowMs);
  const audience = computeAudienceScore(story);

  const base = source * 0.2 + topic * 0.15 + entity * 0.1 + impact * 0.25 + narrative * 0.15 + multiSource * 0.15;
  const finalScore = base * recency * audience;

  return {
    score: normalizeFinal(finalScore),
    breakdown: {
      source,
      topic,
      entity,
      impact,
      narrative,
      recency,
      multiSource,
      audience
    }
  };
}

