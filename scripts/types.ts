import type { Source } from "../data/sources.js";

export type Article = {
  id: string;
  url: string;
  canonicalUrl: string;
  title: string;
  titleNl?: string;
  excerpt: string;
  summaryNl?: string;
  publishedAt: string; // ISO
  sourceDomain: string;
  source: Source;
  imageUrl?: string;
  keywords: string[];
  entities: string[];
};

export type Claim = {
  claim: string;
  confidence: "laag" | "middel" | "hoog";
  verification: string;
};

/** Concrete actielink onder een onderzoeksrichting (bv. bron-URL of publieke tool). */
export type InvestigationResourceLink = {
  label: string;
  url: string;
  /** Optionele toelichting onder de linkregel. */
  note?: string;
};

/**
 * OSINT-aanpak als pill: korte label; optioneel directe link naar vrij toegankelijke tool/handleiding.
 * Oudere data kan nog platte strings in `tools` hebben — die worden in de UI genormaliseerd.
 */
export type InvestigationToolPill = {
  label: string;
  url?: string;
};

export type Investigation = {
  title: string;
  what: string;
  why: string;
  steps: string[];
  tools: (string | InvestigationToolPill)[];
  /** Aanbevolen: 2+ links; oudere cache kan dit veld missen. */
  resourceLinks?: InvestigationResourceLink[];
};

export type AiStory = {
  summary: string;
  narrative: string;
  facts: string[];
  interpretations: string[];
  unknowns: string[];
  comparisons: string[];
  questions: string[];
  investigations: Investigation[];
  claims: Claim[];
};

export type StoryCategory =
  | "geopolitiek"
  | "economie"
  | "technologie"
  | "samenleving"
  | "sport"
  | "overig";

export type StoryTopic =
  | "geopolitiek"
  | "conflict"
  | "oorlog"
  | "spionage"
  | "inlichtingen"
  | "diplomatie"
  | "internationale betrekkingen"
  | "sancties"
  | "handelsconflict"
  | "energiepolitiek"
  | "grondstoffen"
  | "economische machtsstrijd"
  | "defensie"
  | "militaire strategie"
  | "cyberoorlog"
  | "hybride oorlog"
  | "propaganda"
  | "desinformatie"
  | "beïnvloeding"
  | "technologische macht"
  | "surveillance"
  | "politieke instabiliteit"
  | "machtsverschuiving"
  | "overig";

export type Story = {
  storyId: string;
  slug: string;
  title: string; // NL (AI of fallback)
  shortHeadline?: string; // compacte titel (AI)
  summary: string; // NL (AI of fallback)
  imageUrl?: string;
  category?: StoryCategory;
  topic?: StoryTopic;
  importance: number;
  topics: string[];
  buildAt: string; // ISO
  articles: Array<
    Pick<
      Article,
      | "id"
      | "canonicalUrl"
      | "url"
      | "title"
      | "titleNl"
      | "excerpt"
      | "summaryNl"
      | "publishedAt"
      | "sourceDomain"
      | "source"
      | "imageUrl"
      | "keywords"
      | "entities"
    >
  >;
  ai?: AiStory;
  aiStatus: "ok" | "fallback" | "skipped";
  aiCacheKey?: string;
};

