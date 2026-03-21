import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fetchRssArticles } from "./fetch-rss.js";
import { clusterArticlesToStories } from "./cluster.js";
import { enrichStoriesWithAi } from "./ai-enrich.js";
import type { Article, Story } from "./types.js";
import { sha256Hex } from "./utils/hash.js";

async function writeJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function dedupeByCanonical(articles: Article[]) {
  const map = new Map<string, Article>();
  for (const a of articles) {
    const prev = map.get(a.canonicalUrl);
    if (!prev) {
      map.set(a.canonicalUrl, a);
      continue;
    }
    // behoud meest recente / met meer info
    const score = (x: Article) => (x.excerpt.length > 80 ? 2 : 0) + (x.imageUrl ? 1 : 0);
    const better =
      a.publishedAt > prev.publishedAt ? a : score(a) > score(prev) ? a : prev;
    map.set(a.canonicalUrl, better);
  }
  return [...map.values()];
}

function ensureAtLeastOneMultiSourceStory(stories: Story[]) {
  if (stories.some((s) => new Set(s.articles.map((a) => a.sourceDomain)).size >= 2)) return stories;
  // Geen multi-source clusters → probeer een “soft merge” op top entity (MVP fallback)
  const all = stories.flatMap((s) => s.articles);
  const entityCounts = new Map<string, number>();
  for (const a of all) for (const e of a.entities) entityCounts.set(e, (entityCounts.get(e) ?? 0) + 1);
  const top = [...entityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return stories;

  const picked = all.filter((a) => a.entities.includes(top));
  const byDomain = new Map<string, Article>();
  for (const a of picked) {
    if (!byDomain.has(a.sourceDomain)) byDomain.set(a.sourceDomain, a);
  }
  const merged = [...byDomain.values()].slice(0, 6);
  if (merged.length < 2) return stories;

  const primary = [...merged].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const storyId = sha256Hex(merged.map((x) => x.canonicalUrl).sort().join("|")).slice(0, 24);
  const story: Story = {
    storyId,
    slug: `${top.toLowerCase().replace(/\s+/g, "-")}-${storyId.slice(0, 6)}`,
    title: primary?.titleNl ?? primary?.title ?? merged[0]?.titleNl ?? merged[0]?.title ?? top,
    summary: (primary?.summaryNl?.trim() || primary?.excerpt?.trim() || primary?.titleNl || primary?.title || "").slice(0, 260),
    imageUrl: primary?.imageUrl,
    importance: 50,
    topics: [],
    buildAt: new Date().toISOString(),
    articles: merged.map((a) => ({
      id: a.id,
      canonicalUrl: a.canonicalUrl,
      url: a.url,
      title: a.title,
      titleNl: a.titleNl,
      excerpt: a.excerpt,
      summaryNl: a.summaryNl,
      publishedAt: a.publishedAt,
      sourceDomain: a.sourceDomain,
      source: a.source,
      imageUrl: a.imageUrl,
      keywords: a.keywords,
      entities: a.entities
    })),
    aiStatus: "skipped"
  };

  return [story, ...stories];
}

function depthWeight(depth: string) {
  if (depth === "very-high") return 1.4;
  if (depth === "high") return 1.2;
  return 1.0;
}

function typeWeight(type: string) {
  if (type === "investigative") return 1.4;
  if (type === "analysis") return 1.2;
  return 1.0;
}

function articleBestScore(a: Article) {
  const recency = new Date(a.publishedAt).getTime();
  const depth = depthWeight(a.source.depth);
  const type = typeWeight(a.source.type);
  return depth * 100 + type * 10 + (Number.isFinite(recency) ? recency / 1e13 : 0);
}

function applyCipherbriefImageRules(story: Story) {
  const CIPHER_DOMAIN = "thecipherbrief.com";

  const hasCipher = story.articles.some((a) => a.sourceDomain === CIPHER_DOMAIN);
  if (!hasCipher) return story;

  const otherWithImages = story.articles
    .filter((a) => a.sourceDomain !== CIPHER_DOMAIN && typeof a.imageUrl === "string" && a.imageUrl.trim().length > 0);

  if (otherWithImages.length === 0) {
    // cipherbrief is de enige (of alle andere bronnen hebben geen afbeelding): forceer category fallback
    return { ...story, imageUrl: undefined };
  }

  // Kies de “beste” andere bron image (depth/type recency), zodat we niet willekeurig random doen.
  const best = [...otherWithImages].sort((a, b) => articleBestScore(b as any) - articleBestScore(a as any))[0];
  return { ...story, imageUrl: best.imageUrl };
}

function applyRijksoverheidImageRules(story: Story) {
  const RIJKOVERHEID_DOMAINS = new Set(["rijksoverheid.nl", "feeds.rijksoverheid.nl"]);

  const hasRijksoverheid = story.articles.some((a) => RIJKOVERHEID_DOMAINS.has(a.sourceDomain));
  if (!hasRijksoverheid) return story;

  const otherWithImages = story.articles.filter(
    (a) => !RIJKOVERHEID_DOMAINS.has(a.sourceDomain) && typeof a.imageUrl === "string" && a.imageUrl.trim().length > 0
  );

  if (otherWithImages.length === 0) {
    // rijksoverheid is de enige (of alle andere bronnen hebben geen afbeelding): forceer category fallback
    return { ...story, imageUrl: undefined };
  }

  // Kies de “beste” andere bron image (depth/type recency), zodat we niet willekeurig random doen.
  const best = [...otherWithImages].sort((a, b) => articleBestScore(b as any) - articleBestScore(a as any))[0];
  return { ...story, imageUrl: best.imageUrl };
}

async function main() {
  const buildAt = new Date().toISOString();
  console.log(`[build-data] start ${buildAt}`);

  const raw = await fetchRssArticles({ maxPerFeed: 40 });
  const deduped = dedupeByCanonical(raw);

  // Output 1: articles.json
  const articlesOut = deduped
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((a) => ({
      id: a.id,
      url: a.url,
      canonicalUrl: a.canonicalUrl,
      title: a.title,
      titleNl: a.titleNl,
      excerpt: a.excerpt,
      summaryNl: a.summaryNl,
      publishedAt: a.publishedAt,
      sourceDomain: a.sourceDomain,
      source: a.source,
      imageUrl: a.imageUrl,
      keywords: a.keywords,
      entities: a.entities
    }));

  const generatedDir = path.resolve("data/generated");
  await fs.mkdir(generatedDir, { recursive: true });
  await writeJson(path.join(generatedDir, "articles.json"), articlesOut);

  // Output 2: stories.json (na clustering)
  // 72–96 uur window voor “zelfde event, andere woorden”
  let stories = clusterArticlesToStories(deduped, { maxDaysWindow: 4 });
  stories = ensureAtLeastOneMultiSourceStory(stories);

  const allowedTopics = new Set([
    "geopolitiek",
    "conflict",
    "oorlog",
    "spionage",
    "inlichtingen",
    "diplomatie",
    "sancties",
    "handelsconflict",
    "energiepolitiek",
    "defensie",
    "militaire strategie",
    "cyberoorlog",
    "hybride oorlog",
    "propaganda",
    "desinformatie",
    "beïnvloeding",
    "technologische macht",
    "politieke instabiliteit",
    "machtsverschuiving"
  ]);

  function heuristicTopic(story: Story) {
    const text = (
      story.title +
      "\n" +
      story.summary +
      "\n" +
      story.articles
        .slice(0, 6)
        .map((a: any) => `${a.titleNl ?? a.title}\n${a.summaryNl ?? a.excerpt}`)
        .join("\n")
    ).toLowerCase();

    const has = (re: RegExp) => re.test(text);

    if (has(/\b(spionage|spion|agent|mossad|cia|fsi|mi6|fsb|gru)\b/)) return "spionage";
    if (has(/\b(inlichtingen|inlichtingsdienst|aivd|mivd|intelligence)\b/)) return "inlichtingen";
    if (has(/\b(cyber|hack|ransomware|ddos|malware|phishing|zero-?day)\b/)) return "cyberoorlog";
    if (has(/\b(desinformatie|misinformatie|propaganda|beïnvloeding|inmenging|troll|botnet)\b/)) {
      if (has(/\bdesinformatie|misinformatie\b/)) return "desinformatie";
      if (has(/\bpropaganda\b/)) return "propaganda";
      return "beïnvloeding";
    }
    if (has(/\b(sanctie|sancties|embargo)\b/)) return "sancties";
    if (has(/\b(handelsconflict|tarief|importheffing|exportverbod|trade war)\b/)) return "handelsconflict";
    if (has(/\b(energie|gas|olie|lng|pijplijn|opec)\b/)) return "energiepolitiek";
    if (has(/\b(defensie|leger|nato|navo|wapen|wapenlevering|munitie|raket|drone)\b/)) return "defensie";
    if (has(/\b(militaire strategie|grondoffensief|frontlinie|luchtmacht|zeemacht)\b/)) return "militaire strategie";
    if (has(/\b(hybride oorlog|sabotage|ondermijning)\b/)) return "hybride oorlog";
    if (has(/\b(oorlog|invasie|aanval|bombardement|vuurwapen|raketaanval)\b/)) return "oorlog";
    if (has(/\b(conflict|gevecht|clash|escalatie)\b/)) return "conflict";
    if (has(/\b(diplomatie|gezant|ambassade|topoverleg|onderhandeling|vredesgesprek)\b/)) return "diplomatie";
    if (has(/\b(instabiliteit|staatsgreep|protest|onrust|regime)\b/)) return "politieke instabiliteit";
    if (has(/\b(machtsverschuiving|machtspolitiek|invloedssfeer)\b/)) return "machtsverschuiving";

    // Default: geopolitiek als het over staten/allianties gaat
    if (has(/\b(rusland|oekra[iï]ne|china|iran|isra[eë]l|eu|navo|verenigde staten|vs)\b/)) return "geopolitiek";

    return "overig";
  }

  // Pre-classify & pre-filter BEFORE AI to reduce cost.
  stories = stories
    .map((s) => ({
      ...s,
      category: s.category ?? "overig",
      topic: (s as any).topic ?? heuristicTopic(s)
    }))
    .filter((s: any) => allowedTopics.has((s.topic ?? "overig") as string));

  // AI enrichment (strict JSON + caching + article cap)
  stories = await enrichStoriesWithAi(stories, { maxArticlesPerStory: 8 });

  // Transparantie: buildAt overal + defaults (AI kan topic/category overrulen)
  stories = stories
    .map((s) => ({
      ...s,
      buildAt,
      category: s.category ?? "overig",
      topic: (s as any).topic ?? heuristicTopic(s)
    }))
    .filter((s: any) => allowedTopics.has((s.topic ?? "overig") as string));

  // Specifieke image voorkeur:
  // - Als `thecipherbrief.com` in de bronnen zit: gebruik een image van een andere bron waar mogelijk.
  // - Als cipherbrief de enige bron is (of alle andere missen image): zet `imageUrl` op undefined,
  //   zodat de UI een category-based fallback image toont.
  stories = stories.map((s) => applyCipherbriefImageRules(s));
  stories = stories.map((s) => applyRijksoverheidImageRules(s));

  await writeJson(path.join(generatedDir, "stories.json"), stories);

  console.log(
    `[build-data] done: articles=${articlesOut.length} stories=${stories.length} multiSource=${stories.filter((s) => new Set(s.articles.map((a) => a.sourceDomain)).size >= 2).length}`
  );
}

main().catch((e) => {
  console.error("[build-data] fatal", e);
  process.exit(1);
});

