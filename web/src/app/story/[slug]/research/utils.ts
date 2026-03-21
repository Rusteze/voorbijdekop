import type { InvestigationResourceLink, InvestigationToolPill, QuickSourceLink, ToolListItem } from "./types";

export function safeExternalUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export function mergeActionLinks(
  aiLinks: InvestigationResourceLink[] | undefined,
  fallbacks: QuickSourceLink[],
  max = 12
): InvestigationResourceLink[] {
  const out: InvestigationResourceLink[] = [];
  const seen = new Set<string>();
  const push = (label: string, url: string, note?: string) => {
    const href = safeExternalUrl(url);
    if (!href || seen.has(href)) return false;
    seen.add(href);
    out.push({ label: label.trim() || href, url: href, note });
    return out.length >= max;
  };
  for (const L of aiLinks ?? []) {
    if (push(L.label, L.url, L.note)) break;
  }
  for (const L of fallbacks) {
    if (push(L.label, L.url)) break;
  }
  return out;
}

export function normalizeToolPill(raw: string | InvestigationToolPill | null | undefined): InvestigationToolPill | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const label = raw.trim();
    return label ? { label } : null;
  }
  const label = (raw.label ?? "").trim();
  if (!label) return null;
  const href = raw.url != null && String(raw.url).trim() !== "" ? safeExternalUrl(String(raw.url)) : null;
  return href ? { label, url: href } : { label };
}

/** Groepeer tools/links voor de UI (heuristiek op hostname + label). */
export function categorizeLink(label: string, url?: string | null): string {
  if (!url) return "Werkwijze (lokaal)";
  const u = url.toLowerCase();
  const l = label.toLowerCase();
  if (u.includes("bellingcat")) return "OSINT-platforms";
  if (u.includes("nasa.gov") || u.includes("worldview") || u.includes("sentinel") || u.includes("planet.com"))
    return "Satellietbeelden";
  if (
    u.includes("openstreetmap") ||
    u.includes("google.com/maps") ||
    u.includes("google.nl/maps") ||
    u.includes("earth.google")
  )
    return "Kaarten & geolocatie";
  if (u.includes("archive.org") || u.includes("web.archive") || u.includes("archive.today"))
    return "Archief & versies";
  if (
    /reuters|aljazeera|bbc\.|nos\.nl|france24|cnn\.|theguardian|volkskrant|nrc\.|fd\.nl|tweakers/.test(u) ||
    /reuters|al jazeera|nos\.|bbc/.test(l)
  )
    return "Media & nieuws";
  if (u.includes("google.com/search") || u.includes("duckduckgo")) return "Zoeken";
  return "Bronnen & tools";
}

export function buildToolListItems(
  tools: (string | InvestigationToolPill)[],
  resourceLinks: InvestigationResourceLink[],
  sourceQuickLinks: QuickSourceLink[]
): ToolListItem[] {
  const mergedResources = mergeActionLinks(resourceLinks, sourceQuickLinks, 16);
  const items: ToolListItem[] = [];

  for (const raw of tools ?? []) {
    const pill = normalizeToolPill(raw);
    if (!pill) continue;
    items.push({
      label: pill.label,
      url: pill.url,
      category: categorizeLink(pill.label, pill.url),
    });
  }
  for (const r of mergedResources) {
    items.push({
      label: r.label,
      url: r.url,
      note: r.note,
      category: categorizeLink(r.label, r.url),
    });
  }

  const seen = new Set<string>();
  return items.filter((it) => {
    const key = `${it.label}|${it.url ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupByCategory(items: ToolListItem[]): Map<string, ToolListItem[]> {
  const order: string[] = [];
  const map = new Map<string, ToolListItem[]>();
  for (const it of items) {
    if (!map.has(it.category)) {
      order.push(it.category);
      map.set(it.category, []);
    }
    map.get(it.category)!.push(it);
  }
  /* Dossier-specifiek eerst; generieke OSINT-gidsen (Bellingcat) onderaan. */
  const sortedOrder = [...order].sort((a, b) => {
    const prio = (c: string) => {
      if (c === "Werkwijze (lokaal)") return 0;
      if (c === "Bronnen & tools") return 1;
      if (c === "Media & nieuws") return 2;
      if (c === "Zoeken") return 3;
      if (c === "Kaarten & geolocatie") return 4;
      if (c === "Satellietbeelden") return 5;
      if (c === "Archief & versies") return 6;
      if (c === "OSINT-platforms") return 7;
      return 8;
    };
    return prio(a) - prio(b) || a.localeCompare(b, "nl");
  });
  const out = new Map<string, ToolListItem[]>();
  for (const k of sortedOrder) out.set(k, map.get(k)!);
  return out;
}

/** Korte titel + ondertitel voor vraagkaarten. */
export function splitQuestionCard(text: string, titleMaxWords = 10): { title: string; description: string } {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return { title: "Onderzoeksvraag", description: "" };
  const words = t.split(/\s+/);
  const title =
    words.length <= titleMaxWords ? t : `${words.slice(0, titleMaxWords).join(" ")}…`;
  const description = words.length <= titleMaxWords ? "" : t;
  return { title, description: description || t };
}

export function estimateMinutes(stepCount: number): number {
  return Math.min(12, Math.max(3, 2 + Math.min(stepCount, 6)));
}

export function clampChecklistSteps(steps: string[], max = 7): string[] {
  return (steps ?? []).slice(0, max).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}
