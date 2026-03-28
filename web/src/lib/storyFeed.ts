import { getStoryLastUpdated } from "@/lib/storyUtils";

/** Zelfde canon als op de voorpagina (bron-chips / filter). */
export function canonicalizeSourceDomain(domain: string) {
  const d = (domain ?? "").toLowerCase().trim();
  if (!d) return d;
  if (d === "ipad.nrc.nl" || d === "vorige.nrc.nl") return "nrc.nl";
  if (d.endsWith(".nrc.nl")) return "nrc.nl";
  if (d === "reutersbest.com") return "reuters.com";
  if (d === "bbc.com") return "bbc.co.uk";
  if (d === "feeds.rijksoverheid.nl") return "rijksoverheid.nl";
  return d;
}

export type StoryFeedOpts = {
  topic: string;
  query: string;
  sourceFilter: string;
};

/**
 * Zelfde volgorde en filters als `storiesAllFiltered` op de voorpagina:
 * importance ↓, daarna laatst bijgewerkt ↓; gefilterd op topic, zoekterm en bron.
 */
export function buildStoryFeed(stories: any[], opts: StoryFeedOpts): any[] {
  const q = opts.query.trim().toLowerCase();
  const base = [...stories].sort((a, b) => {
    const imp = (b.importance ?? 0) - (a.importance ?? 0);
    if (imp !== 0) return imp;
    return getStoryLastUpdated(b) - getStoryLastUpdated(a);
  });

  const matchQuery = (s: any) => {
    if (!q) return true;
    const hay = [s.title ?? "", s.summary ?? "", s.ai?.narrative ?? ""].join("\n").toLowerCase();
    return hay.includes(q);
  };

  const matchSource = (s: any) => {
    if (opts.sourceFilter === "alle") return true;
    const canon = opts.sourceFilter;
    const arts: any[] = Array.isArray(s?.articles) ? s.articles : [];
    return arts.some((a) => canonicalizeSourceDomain(a?.sourceDomain ?? "") === canon);
  };

  return base.filter((s: any) => {
    if (opts.topic !== "alle" && (s.topic ?? "overig") !== opts.topic) return false;
    if (!matchQuery(s)) return false;
    if (!matchSource(s)) return false;
    return true;
  });
}
