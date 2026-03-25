import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { XMLParser } from "fast-xml-parser";
import { FEEDS } from "../data/feeds.js";
import { SOURCE_BY_DOMAIN } from "../data/sources.js";
import type { Article } from "./types.js";
import { canonicalizeUrl } from "./utils/url.js";
import { sha256Hex } from "./utils/hash.js";
import { extractEntities, stripHtml, tokenizeNlLike } from "./utils/text.js";
import { openAiResponsesCreate } from "./utils/llm.js";

type RawRssItem = {
  title?: string | { "#text"?: string };
  link?: string | { "@_href"?: string } | Array<{ "@_href"?: string; "@_rel"?: string }>;
  guid?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
  "content:encoded"?: string;
  description?: string;
  summary?: string;
  enclosure?: { "@_url"?: string };
  "media:thumbnail"?: { "@_url"?: string };
  "media:content"?: { "@_url"?: string };
};

function asItemArray(raw: unknown): RawRssItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as RawRssItem[];
  return [raw as RawRssItem];
}

function extractItemTitle(item: RawRssItem): string {
  const t = item.title;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && typeof (t as { "#text"?: string })["#text"] === "string") {
    return (t as { "#text": string })["#text"];
  }
  return "";
}

function extractItemLink(item: RawRssItem): string {
  const l = item.link as unknown;
  if (typeof l === "string") return l.replace(/&amp;/g, "&").trim();
  if (l && typeof l === "object" && !Array.isArray(l) && typeof (l as { "@_href"?: string })["@_href"] === "string") {
    return String((l as { "@_href": string })["@_href"]).replace(/&amp;/g, "&").trim();
  }
  if (Array.isArray(l)) {
    for (const x of l) {
      if (x && typeof x === "object" && typeof (x as { "@_href"?: string })["@_href"] === "string") {
        const rel = (x as { "@_rel"?: string })["@_rel"];
        if (!rel || rel === "alternate") {
          return String((x as { "@_href": string })["@_href"]).replace(/&amp;/g, "&").trim();
        }
      }
    }
    const first = l[0];
    if (first && typeof first === "object" && typeof (first as { "@_href"?: string })["@_href"] === "string") {
      return String((first as { "@_href": string })["@_href"]).replace(/&amp;/g, "&").trim();
    }
  }
  return "";
}

function extractPublishedIso(item: RawRssItem): string | null {
  for (const v of [item.pubDate, item.published, item.updated]) {
    if (typeof v === "string" && v.trim()) {
      const iso = toIsoDate(v);
      if (iso) return iso;
    }
  }
  return null;
}

function itemPublishedMs(item: RawRssItem): number {
  const iso = extractPublishedIso(item);
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

async function fetchTextWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...(init ?? {}), signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function toIsoDate(input?: string) {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function stripHtmlSimple(html: string) {
  return html.replace(/<[^>]*>?/gm, "").trim();
}

function pickExcerpt(item: RawRssItem) {
  const raw = item.description ?? item.summary ?? item["content:encoded"] ?? "";
  const text = stripHtmlSimple(stripHtml(raw));
  return text.slice(0, 500);
}

function extractImgFromHtml(html: string) {
  // Eerste img src-waarde (normalisatie naar absolute URL gebeurt later)
  const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (!m) return undefined;
  return m[1].replace(/&amp;/g, "&").trim();
}

function normalizeImageUrl(input: string | undefined, baseUrl: string) {
  if (!input) return undefined;
  const src = input.replace(/&amp;/g, "&").trim();
  if (!src || /^data:/i.test(src)) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractOgImageFromHtml(html: string) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (!m) return undefined;
  return m[1].replace(/&amp;/g, "&").trim();
}

async function fetchOgImage(canonicalUrl: string) {
  const cacheDir = path.resolve("data/cache/ai/og-images");
  await fs.mkdir(cacheDir, { recursive: true });
  const cacheKey = sha256Hex(canonicalUrl).slice(0, 24);
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);

  const cached = await fs.readFile(cachePath, "utf8").catch(() => null);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { imageUrl?: string };
      if (parsed?.imageUrl && typeof parsed.imageUrl === "string") return parsed.imageUrl;
      return undefined;
    } catch {
      // ignore
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(canonicalUrl, {
      headers: {
        "user-agent": "voorbijdekop-bot/0.1 (build-time OG image fetch; contact: none)"
      },
      signal: controller.signal
    });
    if (!res.ok) {
      await fs.writeFile(cachePath, JSON.stringify({ imageUrl: undefined }, null, 2), "utf8");
      return undefined;
    }
    const html = await res.text();
    const raw = extractOgImageFromHtml(html);
    const imageUrl = normalizeImageUrl(raw, canonicalUrl);
    await fs.writeFile(cachePath, JSON.stringify({ imageUrl }, null, 2), "utf8");
    return imageUrl;
  } catch {
    await fs.writeFile(cachePath, JSON.stringify({ imageUrl: undefined }, null, 2), "utf8");
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function pickImage(item: RawRssItem, baseUrl: string) {
  const enclosure = normalizeImageUrl(item.enclosure?.["@_url"], baseUrl);
  const mediaContent = normalizeImageUrl(item["media:content"]?.["@_url"], baseUrl);
  const mediaThumb = normalizeImageUrl(item["media:thumbnail"]?.["@_url"], baseUrl);

  // Zoek in meerdere velden zodat feeds met img in description/summary ook scoren.
  const html = [item["content:encoded"], item.description, item.summary].filter(Boolean).join("\n");
  const imgInHtml = html ? normalizeImageUrl(extractImgFromHtml(html), baseUrl) : undefined;

  return enclosure ?? mediaContent ?? mediaThumb ?? imgInHtml ?? undefined;
}

function isLikelyDutch(text: string) {
  const t = text.toLowerCase();
  const hits = [
    " de ",
    " het ",
    " een ",
    " en ",
    " van ",
    " voor ",
    " met ",
    " niet ",
    " dat ",
    " dit ",
    " deze ",
    " die ",
    " als ",
    " naar ",
    " op ",
    " in "
  ].reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0);
  return hits >= 4;
}

async function translateIfNeeded(opts: {
  canonicalUrl: string;
  title: string;
  excerpt: string;
}) {
  const combined = `${opts.title}\n\n${opts.excerpt}`.trim();
  const likelyNl = isLikelyDutch(` ${combined} `);

  // Als het al (waarschijnlijk) NL is: houd het schoon, zonder extra AI-kosten.
  if (likelyNl) {
    return { titleNl: opts.title, summaryNl: opts.excerpt };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { titleNl: undefined, summaryNl: undefined };

  const cacheDir = path.resolve("data/cache/ai/articles");
  await fs.mkdir(cacheDir, { recursive: true });
  const cacheKey = sha256Hex(`${opts.canonicalUrl}|${opts.title}|${opts.excerpt}`).slice(0, 24);
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);

  const cached = await fs.readFile(cachePath, "utf8").catch(() => null);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { titleNl: string; summaryNl: string };
      return parsed;
    } catch {
      // ignore
    }
  }

  const client = new OpenAI({ apiKey });
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      titleNl: { type: "string" },
      summaryNl: { type: "string" }
    },
    required: ["titleNl", "summaryNl"]
  } as const;

  const toneBlock = [
    "SYSTEM:",
    "Je vertaalt naar het Nederlands, zonder extra informatie toe te voegen.",
    ""
  ];

  const contextBlock = [
    "CONTEXT:",
    "Titel (bron):",
    opts.title,
    "",
    "Tekst (uittreksel) (bron):",
    opts.excerpt,
    ""
  ];

  const instructionBlock = [
    "INSTRUCTIE:",
    "Regels:",
    "- Houd de titel betekenis-exact en maak hem NIET langer dan nodig.",
    "- Samenvatting: 1–2 zinnen, kort, geen speculatie, geen hallucinaties.",
    "- Gebruik alleen de meegegeven tekst."
  ];

  // Voor vertaling is “output format” in feite dezelfde regels-set.
  const outputFormatBlock: string[] = [];

  const prompt = [...toneBlock, ...contextBlock, ...instructionBlock, ...outputFormatBlock].join("\n");

  const payload = {
    model: "gpt-4.1-mini",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "article_translation",
        schema
      }
    }
  };

  const resp = await openAiResponsesCreate(client as any, payload, {
    name: `article_translation:${opts.canonicalUrl.slice(0, 40)}`,
    context: {
      canonicalUrl: opts.canonicalUrl,
      titleLen: opts.title?.length ?? 0,
      excerptLen: opts.excerpt?.length ?? 0
    }
  });

  const rawText = (resp as any)?.output?.[0]?.content?.[0]?.text;
  if (typeof rawText !== "string" || rawText.trim() === "") {
    return { titleNl: undefined, summaryNl: undefined };
  }

  try {
    const parsed = JSON.parse(rawText) as { titleNl: string; summaryNl: string };
    await fs.writeFile(cachePath, JSON.stringify(parsed, null, 2), "utf8");
    return parsed;
  } catch {
    return { titleNl: undefined, summaryNl: undefined };
  }
}

export async function fetchRssArticles(options?: { maxPerFeed?: number }) {
  const maxPerFeed = options?.maxPerFeed ?? 30;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: false,
    // Hardening: voorkom entity-expansion issues bij sommige feeds
    processEntities: false
  });

  const out: Article[] = [];

  for (const feed of FEEDS) {
    const source = SOURCE_BY_DOMAIN.get(feed.domain);
    if (!source) throw new Error(`Feed domain niet in SOURCE_BY_DOMAIN: ${feed.domain}`);

    let xml: string;
    try {
      const timeoutMs = Number(process.env.RSS_FETCH_TIMEOUT_MS ?? 8000);
      // Sommige feeds zijn traag/instabiel; zonder timeout kan build onnodig lang blijven hangen.
      xml = await fetchTextWithTimeout(
        feed.url,
        timeoutMs,
        {
          headers: {
            "user-agent": "voorbijdekop-bot/0.1 (build-time RSS ingest; contact: none)"
          }
        }
      );
    } catch (e) {
      console.warn(`[rss] fetch error ${feed.url}`, e);
      continue;
    }
    let doc: any;
    try {
      doc = parser.parse(xml) as any;
    } catch (e) {
      console.warn(`[rss] parse failed ${feed.url}`, e);
      continue;
    }

    const rawItems =
      doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.rdf?.RDF?.item ?? [];

    const items = asItemArray(rawItems);
    // Veel feeds leveren chronologisch oud→nieuw; zonder sorteren krijg je alleen oude items binnen maxPerFeed.
    const slice = [...items].sort((a, b) => itemPublishedMs(b) - itemPublishedMs(a)).slice(0, maxPerFeed);

    for (const item of slice) {
      const title = stripHtmlSimple(stripHtml(extractItemTitle(item))).slice(0, 220);
      const linkRaw = extractItemLink(item);
      const link = linkRaw.replace(/&amp;/g, "&");
      const canonical = canonicalizeUrl(link);
      if (!canonical) continue;

      // Whitelist enforce: item link domain moet matchen met een whitelisted source.
      const sourceForItem = SOURCE_BY_DOMAIN.get(canonical.domain);
      if (!sourceForItem) {
        // hard reject
        continue;
      }

      const excerpt = pickExcerpt(item);
      const publishedAt = extractPublishedIso(item) ?? new Date().toISOString();
      let imageUrl = pickImage(item, canonical.url);
      if (!imageUrl) {
        // OG fallback: alleen als we nog geen image hebben (performance!)
        imageUrl = await fetchOgImage(canonical.url).catch(() => undefined);
      }

      const translation = await translateIfNeeded({
        canonicalUrl: canonical.url,
        title,
        excerpt
      });

      // Gebruik NL-velden (vertaald of origineel) voor clustering-kwaliteit.
      const titleForNlp = translation.titleNl ?? title;
      const excerptForNlp = translation.summaryNl ?? excerpt;
      const keywords = tokenizeNlLike(`${titleForNlp} ${excerptForNlp}`).slice(0, 24);
      const entities = extractEntities(titleForNlp, excerptForNlp);

      const canonicalUrl = canonical.url;
      const id = sha256Hex(`${canonicalUrl}|${publishedAt}|${title}`);

      out.push({
        id,
        url: link,
        canonicalUrl,
        title: title || canonicalUrl,
        titleNl: translation.titleNl,
        excerpt,
        summaryNl: translation.summaryNl,
        publishedAt,
        sourceDomain: canonical.domain,
        source: sourceForItem,
        imageUrl,
        keywords,
        entities
      });
    }
  }

  return out;
}

