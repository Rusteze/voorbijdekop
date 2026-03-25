import "dotenv/config";
import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";
import { fetchRssArticles } from "./fetch-rss.js";
import { clusterArticlesToStories } from "./cluster.js";
import { enrichStoriesWithAi } from "./ai-enrich.js";
import type { AiStory, Article, Story } from "./types.js";
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
    generatedAt: primary?.publishedAt ?? new Date().toISOString(),
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

function pickTopArticlesForAi(story: Story, max: number) {
  const depthRank = (d: string) => (d === "very-high" ? 3 : d === "high" ? 2 : 1);
  const typeRank = (t: string) => (t === "investigative" ? 3 : t === "analysis" ? 2 : 1);

  return [...story.articles]
    .sort((a, b) => {
      const wa = depthRank(a.source.depth) * 10 + typeRank(a.source.type);
      const wb = depthRank(b.source.depth) * 10 + typeRank(b.source.type);
      return wb - wa || b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, max);
}

function storyCacheKey(story: Story, selectedIds: string[]) {
  const payload = {
    storyId: story.storyId,
    ids: selectedIds
  };
  return sha256Hex(JSON.stringify(payload)).slice(0, 24);
}

function storyCanonicalGeneratedAt(story: Story, fallbackIso: string) {
  const latestArticleMs = Math.max(
    ...story.articles.map((a) => new Date(a.publishedAt).getTime()).filter((x) => Number.isFinite(x)),
    0
  );
  if (latestArticleMs > 0) return new Date(latestArticleMs).toISOString();
  const currentMs = new Date((story as any).generatedAt ?? "").getTime();
  if (Number.isFinite(currentMs) && currentMs > 0) return new Date(currentMs).toISOString();
  return fallbackIso;
}

async function main() {
  const generatedAt = new Date().toISOString();
  console.log(`[build-data] start ${generatedAt}`);

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
  const webPublicDataDir = path.resolve("web/public/data");
  await fs.mkdir(generatedDir, { recursive: true });
  await fs.mkdir(webPublicDataDir, { recursive: true });
  await writeJson(path.join(generatedDir, "articles.json"), articlesOut);
  await writeJson(path.join(webPublicDataDir, "articles.json"), articlesOut);

  // Output 2: stories.json (na clustering)
  // 72–96 uur window voor “zelfde event, andere woorden”
  let stories = clusterArticlesToStories(deduped, { maxDaysWindow: 4 });
  stories = ensureAtLeastOneMultiSourceStory(stories);

  // Allowed topics moeten overeenkomen met `StoryTopic` (anders worden AI-ok verhalen alsnog gefilterd weg).
  // Dit bepaalt ook welke verhalen überhaupt in `stories.json` terechtkomen.
  const allowedTopics = new Set<string>([
    "geopolitiek",
    "conflict",
    "oorlog",
    "spionage",
    "inlichtingen",
    "diplomatie",
    "internationale betrekkingen",
    "sancties",
    "handelsconflict",
    "energiepolitiek",
    "grondstoffen",
    "economische machtsstrijd",
    "defensie",
    "militaire strategie",
    "cyberoorlog",
    "hybride oorlog",
    "propaganda",
    "desinformatie",
    "beïnvloeding",
    "technologische macht",
    "surveillance",
    "politieke instabiliteit",
    "machtsverschuiving",
    "overig"
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
      generatedAt: storyCanonicalGeneratedAt(s as Story, generatedAt),
      category: s.category ?? "overig",
      topic: (s as any).topic ?? heuristicTopic(s)
    }))
    .filter((s: any) => allowedTopics.has((s.topic ?? "overig") as string));

  // AI enrichment: alleen voor nieuwe stories (bestaande cache = direct trust).
  const maxArticlesPerStory = 3;
  const cacheDir = path.resolve("data/ai");
  await fs.mkdir(cacheDir, { recursive: true });

  type CacheTask = { index: number; story: Story; cacheKey: string; cachePath: string };

  const cachedSlots: (Story | undefined)[] = new Array(stories.length);
  const cachedTasks: CacheTask[] = [];
  const newStories: Story[] = [];
  const newStoryIndices: number[] = [];

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    const selected = pickTopArticlesForAi(story, maxArticlesPerStory);
    const selectedIds = selected.map((a) => a.id);
    const cacheKey = storyCacheKey(story, selectedIds);
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);

    if (fsSync.existsSync(cachePath)) {
      cachedTasks.push({ index: i, story, cacheKey, cachePath });
    } else {
      newStoryIndices.push(i);
      newStories.push(story);
    }
  }

  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  const AI_CACHE_READ_CONCURRENCY = 20;

  // 1) Cache lezen voor cachedTasks; bij parse-fout behandelen we als cache-miss.
  const loadCached = async (task: CacheTask): Promise<{ index: number; ok: true; story: Story } | { index: number; ok: false; story: Story }> => {
    try {
      const cached = await fs.readFile(task.cachePath, "utf8");
      const parsed = JSON.parse(cached) as { category?: string; topic?: string; shortHeadline?: string } & Partial<AiStory> & Record<string, unknown>;
      const { category, topic, shortHeadline, ...rawAi } = parsed;
      const aiStory = rawAi as AiStory;

      return {
        index: task.index,
        ok: true,
        story: {
          ...task.story,
          category: (category as any) ?? "overig",
          topic: (topic as any) ?? "overig",
          shortHeadline: shortHeadline ?? task.story.shortHeadline,
          ai: aiStory,
          aiStatus: "ok",
          aiCacheKey: task.cacheKey
        }
      };
    } catch {
      return { index: task.index, ok: false, story: task.story };
    }
  };

  if (cachedTasks.length > 0) {
    for (const chunk of chunkArray(cachedTasks, AI_CACHE_READ_CONCURRENCY)) {
      const results = await Promise.all(chunk.map((t) => loadCached(t)));
      for (const r of results) {
        if (r.ok) cachedSlots[r.index] = r.story;
        else {
          newStoryIndices.push(r.index);
          newStories.push(r.story);
        }
      }
    }
  }

  // 2) AI ONLY voor newStories
  let enrichedNew: Story[] = [];
  if (newStories.length === 0) {
    console.log("[ai] no new stories at build level");
  } else {
    enrichedNew = await enrichStoriesWithAi(newStories, { maxArticlesPerStory });
  }

  // 3) Merge terug in input-volgorde
  if (newStories.length > 0) {
    for (let j = 0; j < enrichedNew.length; j++) {
      const idx = newStoryIndices[j];
      cachedSlots[idx] = enrichedNew[j];
    }
  }

  stories = cachedSlots as Story[];

  // Transparantie: generatedAt overal + defaults (AI kan topic/category overrulen)
  const storiesWithDefaults = (stories as any[])
    .map((s, index) => {
      if (!s) {
        console.error("[build-data] invalid story detected", { index });
        return undefined;
      }
      return {
        ...s,
        generatedAt: storyCanonicalGeneratedAt(s as Story, generatedAt),
        buildAt: generatedAt,
        category: s.category ?? "overig",
        topic: (s as any).topic ?? heuristicTopic(s)
      };
    })
    .filter(Boolean)
    ;

  const stats = (arr: any[]) => {
    const counts: Record<string, number> = { ok: 0, fallback: 0, skipped: 0, other: 0 };
    for (const s of arr) {
      const st = s?.aiStatus;
      if (st === "ok") counts.ok++;
      else if (st === "fallback") counts.fallback++;
      else if (st === "skipped") counts.skipped++;
      else counts.other++;
    }
    return counts;
  };

  const beforeTopicFilter = storiesWithDefaults as any[];
  console.log("[build-data] aiStatus before topic filter:", stats(beforeTopicFilter), "stories=", beforeTopicFilter.length);

  stories = beforeTopicFilter
    .filter((s: any) => allowedTopics.has((s.topic ?? "overig") as string)) as Story[];

  console.log("[build-data] aiStatus after topic filter:", stats(stories as any[]), "stories=", stories.length);

  // Specifieke image voorkeur:
  // - Als `thecipherbrief.com` in de bronnen zit: gebruik een image van een andere bron waar mogelijk.
  // - Als cipherbrief de enige bron is (of alle andere missen image): zet `imageUrl` op undefined,
  //   zodat de UI een category-based fallback image toont.
  stories = stories.map((s) => applyCipherbriefImageRules(s));
  stories = stories.map((s) => applyRijksoverheidImageRules(s));
  stories.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

  await writeJson(path.join(generatedDir, "stories.json"), stories);
  await writeJson(path.join(webPublicDataDir, "stories.json"), stories);

  console.log(
    `[build-data] done: articles=${articlesOut.length} stories=${stories.length} multiSource=${stories.filter((s) => new Set(s.articles.map((a) => a.sourceDomain)).size >= 2).length}`
  );
}

main().catch((e) => {
  console.error("[build-data] fatal", e);
  process.exit(1);
});

