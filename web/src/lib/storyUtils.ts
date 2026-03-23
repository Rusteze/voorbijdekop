export function getStoryLastUpdated(story: any): number {
  const articles = Array.isArray(story?.articles) ? (story.articles as any[]) : [];
  const times = articles
    .map((a) => {
      const t = new Date(a?.publishedAt ?? "").getTime();
      return Number.isFinite(t) ? t : null;
    })
    .filter((x): x is number => typeof x === "number");

  return times.length > 0 ? Math.max(...times) : 0;
}

export function formatRelativeStoryTime(ms: number, referenceTimeMs?: number): string {
  const ref =
    referenceTimeMs !== undefined && Number.isFinite(referenceTimeMs) ? referenceTimeMs : Date.now();

  if (!Number.isFinite(ms) || ms <= 0) return "Onbekend";

  const diff = ref - ms;
  if (!Number.isFinite(diff)) return "Onbekend";
  if (diff < 0) return "net";

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return "1 min geleden";
  if (min < 60) return `${Math.max(1, min)} min geleden`;
  if (hr < 24) return `${hr} uur geleden`;
  return `${day} dagen geleden`;
}

export function formatAbsoluteDateTimeNl(value: unknown): string {
  const d = new Date(typeof value === "string" || typeof value === "number" ? value : "");
  if (!Number.isFinite(d.getTime())) return "Onbekend";
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Backward compatible aliases
export const storyRecencyMs = getStoryLastUpdated;
export const timeAgoFromMs = formatRelativeStoryTime;

export function prettySourceDomain(domain: string) {
  const d = (domain ?? "").toLowerCase();
  if (!d) return "bron";
  if (d === "nos.nl") return "NOS";
  if (d === "bbc.com" || d === "bbc.co.uk") return "BBC";
  if (d === "theguardian.com") return "The Guardian";
  if (d === "reuters.com" || d === "reutersbest.com") return "Reuters";
  if (d.endsWith("nrc.nl")) return "NRC";
  if (d === "volkskrant.nl") return "De Volkskrant";
  if (d === "trouw.nl") return "Trouw";
  if (d === "apnews.com") return "AP News";
  if (d === "aljazeera.com") return "Al Jazeera";
  if (d === "dw.com") return "DW";
  if (d === "france24.com") return "France 24";
  if (d === "ft.com") return "Financial Times";
  if (d === "feeds.rijksoverheid.nl" || d === "rijksoverheid.nl") return "Rijksoverheid";
  return domain;
}

export function storySourceLabel(story: any): string {
  const domains = Array.from(
    new Set(((story?.articles ?? []) as any[]).map((a: any) => a?.sourceDomain).filter(Boolean))
  );
  if (domains.length === 1) return prettySourceDomain(domains[0] as string);
  return `${domains.length} bronnen`;
}

export function topicLabel(tp?: string | null) {
  switch (tp) {
    case "geopolitiek":
      return "Geopolitiek";
    case "conflict":
      return "Conflict";
    case "oorlog":
      return "Oorlog";
    case "spionage":
      return "Spionage";
    case "inlichtingen":
      return "Inlichtingen";
    case "diplomatie":
      return "Diplomatie";
    case "sancties":
      return "Sancties";
    case "handelsconflict":
      return "Handelsconflict";
    case "energiepolitiek":
      return "Energiepolitiek";
    case "defensie":
      return "Defensie";
    case "militaire strategie":
      return "Militaire strategie";
    case "cyberoorlog":
      return "Cyberoorlog";
    case "hybride oorlog":
      return "Hybride oorlog";
    case "propaganda":
      return "Propaganda";
    case "desinformatie":
      return "Desinformatie";
    case "beïnvloeding":
      return "Beïnvloeding";
    case "technologische macht":
      return "Technologische macht";
    case "politieke instabiliteit":
      return "Politieke instabiliteit";
    case "machtsverschuiving":
      return "Machtsverschuiving";
    default:
      return "Overig";
  }
}

