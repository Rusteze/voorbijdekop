import type { Article, Story } from "./types.js";
import { jaccard, tokenizeNlLike } from "./utils/text.js";
import { sha256Hex } from "./utils/hash.js";

function daysBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

function slugifyNl(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
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

function primaryArticleScore(a: Article) {
  const recency = new Date(a.publishedAt).getTime();
  const depth = depthWeight(a.source.depth);
  const type = typeWeight(a.source.type);
  // depth/type wegen zwaarder dan recency; recency breekt ties
  return depth * 100 + type * 10 + (Number.isFinite(recency) ? recency / 1e13 : 0);
}

function pickPrimaryArticle(items: Article[]) {
  return [...items].sort((a, b) => primaryArticleScore(b) - primaryArticleScore(a))[0] ?? items[0];
}

export function computeImportance(articles: Article[]) {
  const sourceCount = new Set(articles.map((a) => a.sourceDomain)).size;
  const regions = new Set(articles.map((a) => a.source.region ?? "intl"));
  const regionSpread = regions.size;

  const depthSum = articles.reduce((acc, a) => acc + depthWeight(a.source.depth), 0);
  const typeSum = articles.reduce((acc, a) => acc + typeWeight(a.source.type), 0);

  // schaal naar ~0..100
  const score =
    10 * Math.log2(1 + sourceCount) +
    8 * Math.log2(1 + regionSpread) +
    6 * (depthSum / Math.max(1, articles.length)) +
    6 * (typeSum / Math.max(1, articles.length));

  return Math.round(Math.min(100, score * 6));
}

type ClusterNode = {
  articleIds: string[];
  tokenSet: Set<string>;
  entitySet: Set<string>;
  firstSeen: string;
  lastSeen: string;
};

function nlTextForClustering(a: Article) {
  const t = (a.titleNl ?? a.title ?? "").toString();
  const x = (a.summaryNl ?? a.excerpt ?? "").toString();
  return `${t} ${x}`.trim();
}

const COUNTRY_CANON = new Set(
  [
    "Verenigde Staten",
    "Rusland",
    "Oekraïne",
    "China",
    "Iran",
    "Israël",
    "Turkije",
    "Saoedi-Arabië",
    "Verenigd Koninkrijk",
    "Frankrijk",
    "Duitsland",
    "Polen",
    "India",
    "Pakistan",
    "Taiwan",
    "Japan",
    "Noord-Korea",
    "Zuid-Korea",
    "Syrië",
    "Irak",
    "Libanon",
    "Jemen",
    "Egypte"
  ].map((x) => x.toLowerCase())
);

function scoreSimilarity(a: Article, node: ClusterNode) {
  const aTokens = new Set(tokenizeNlLike(nlTextForClustering(a)));
  const tokenOverlap = jaccard(aTokens, node.tokenSet);

  const aEntities = new Set(a.entities.map((e) => e.toLowerCase()));
  const nodeEntities = new Set([...node.entitySet].map((e) => e.toLowerCase()));
  const entityOverlap = jaccard(aEntities, nodeEntities);

  const timePenalty = Math.min(1, daysBetween(a.publishedAt, node.lastSeen) / 4); // 0..1 over 96 uur

  // Combineer token + entity; entity overlap helpt “net-niet” matches
  let base = 0.62 * tokenOverlap + 0.38 * entityOverlap;

  // Boost: gedeeld land of “key entity” is vaak hetzelfde event met andere bewoording.
  let sharedAnyEntity = false;
  let sharedCountry = false;
  for (const e of aEntities) {
    if (nodeEntities.has(e)) {
      sharedAnyEntity = true;
      if (COUNTRY_CANON.has(e)) sharedCountry = true;
      if (sharedCountry) break;
    }
  }
  if (sharedCountry) base += 0.09;
  else if (sharedAnyEntity) base += 0.05;

  base = Math.min(1, Math.max(0, base));
  return base * (1 - 0.15 * timePenalty);
}

export function clusterArticlesToStories(articles: Article[], opts?: { maxDaysWindow?: number }) {
  // 72–96 uur is vaak genoeg om “zelfde event, andere woorden” te vangen zonder te veel te blenden.
  const maxDaysWindow = opts?.maxDaysWindow ?? 4;

  const sorted = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const clusters: ClusterNode[] = [];

  const byId = new Map(sorted.map((a) => [a.id, a]));

  for (const a of sorted) {
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      if (daysBetween(a.publishedAt, c.lastSeen) > maxDaysWindow) continue;
      const s = scoreSimilarity(a, c);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }

    // drempel: maak cluster iets “ruimer” door entity overlap
    const threshold = 0.19;
    if (bestIdx >= 0 && bestScore >= threshold) {
      const c = clusters[bestIdx];
      c.articleIds.push(a.id);
      for (const t of tokenizeNlLike(nlTextForClustering(a))) c.tokenSet.add(t);
      for (const e of a.entities) c.entitySet.add(e);
      c.firstSeen = a.publishedAt < c.firstSeen ? a.publishedAt : c.firstSeen;
      c.lastSeen = a.publishedAt > c.lastSeen ? a.publishedAt : c.lastSeen;
    } else {
      clusters.push({
        articleIds: [a.id],
        tokenSet: new Set(tokenizeNlLike(nlTextForClustering(a))),
        entitySet: new Set(a.entities),
        firstSeen: a.publishedAt,
        lastSeen: a.publishedAt
      });
    }
  }

  const buildAt = new Date().toISOString();

  const stories: Story[] = clusters.map((c) => {
    const items = c.articleIds.map((id) => byId.get(id)!).filter(Boolean);
    const storyId = sha256Hex(items.map((x) => x.canonicalUrl).sort().join("|")).slice(0, 24);

    const primary = pickPrimaryArticle(items);
    const title = primary?.titleNl ?? primary?.title ?? items[0]?.titleNl ?? items[0]?.title ?? "Verhaal";
    const slug = `${slugifyNl(title)}-${storyId.slice(0, 6)}`;

    const importance = computeImportance(items);
    const summary = (primary?.summaryNl?.trim() || primary?.excerpt?.trim() || primary?.titleNl || primary?.title || "")
      .toString()
      .slice(0, 260);

    return {
      storyId,
      slug,
      title,
      summary,
      imageUrl: primary?.imageUrl,
      importance,
      topics: [],
      buildAt,
      articles: items.map((a) => ({
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
  });

  // sorteer op importance en recency
  stories.sort((a, b) => b.importance - a.importance || b.buildAt.localeCompare(a.buildAt));

  return stories;
}

