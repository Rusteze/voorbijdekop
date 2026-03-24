import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import type { AiStory, Story, StoryCategory, StoryTopic } from "./types.js";
import { sha256Hex } from "./utils/hash.js";
import { openAiResponsesCreate } from "./utils/llm.js";
import { sanitizeAiStory } from "./utils/stripAiMarkup.js";

/**
 * Bij `true`: bij schema-/API-fouten direct falen i.p.v. stil naar fallback te gaan.
 * `false`: robuuste productie — mislukte AI valt terug op fallback zonder crash.
 */
const STRICT_AI = false;

const CATEGORIES: StoryCategory[] = [
  "geopolitiek",
  "economie",
  "technologie",
  "samenleving",
  "sport",
  "overig"
];

const TOPICS: StoryTopic[] = [
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
];
const MIN_AI_IMPORTANCE = 0;

const schemaObject = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string" },
    topic: { type: "string" },
    shortHeadline: { type: "string" },
    summary: { type: "string" },
    facts: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 6
    },
    nuance: { type: "string" }
  },
  required: ["category", "topic", "shortHeadline", "summary", "facts"]
} as const;

type AiLiteResponse = {
  category: string;
  topic: string;
  shortHeadline: string;
  summary: string;
  facts: string[];
  nuance?: string;
};

/**
 * Valideert object-schema's recursief: `required` moet een array zijn en elke sleutel in `required`
 * moet in `properties` voorkomen. Optionele velden (alleen in properties, niet in required) zijn toegestaan.
 */
function validateOpenAiObjectSchema(node: unknown, path: string): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => validateOpenAiObjectSchema(item, `${path}[${i}]`));
    return;
  }
  if (typeof node !== "object") return;

  const o = node as Record<string, unknown>;

  if (o.type === "object" && o.properties != null && typeof o.properties === "object" && !Array.isArray(o.properties)) {
    const propKeys = Object.keys(o.properties as Record<string, unknown>);
    const req = o.required;
    if (!Array.isArray(req)) {
      throw new Error(`${path}: object has "properties" but "required" is not an array`);
    }
    for (const k of req) {
      if (!propKeys.includes(k)) {
        throw new Error(`${path}: required key "${k}" is not listed in "properties"`);
      }
    }
    for (const [k, v] of Object.entries(o.properties as Record<string, unknown>)) {
      validateOpenAiObjectSchema(v, `${path}.properties.${k}`);
    }
  }

  if (o.type === "array" && o.items != null) {
    validateOpenAiObjectSchema(o.items, `${path}.items`);
  }
}

function fallbackShortHeadline(story: Story) {
  const t = (story.title ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "Onbekend verhaal";
  const words = t.split(/\s+/).filter(Boolean);
  const maxWords = 12;
  const minWords = 8;

  if (words.length <= maxWords) return t;

  const slice = words.slice(0, maxWords).join(" ");
  const sliceWords = slice.split(/\s+/).filter(Boolean).length;
  if (sliceWords < minWords) return words.slice(0, minWords).join(" ");
  return slice.replace(/[,:;\-–—]+$/g, "").trim();
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

function toFullAiStoryFromLite(parsed: Partial<AiLiteResponse>, story: Story): AiStory {
  const summary = String(parsed.summary ?? story.summary ?? "").trim();
  const shortNuance = String(parsed.nuance ?? "").trim();
  const facts = Array.isArray(parsed.facts)
    ? parsed.facts.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 6)
    : [];
  return sanitizeAiStory({
    summary: summary || story.summary,
    narrative: summary || story.summary,
    facts: facts.length > 0 ? facts : ["Samenvatting beschikbaar; controleer de bronlinks voor extra details."],
    interpretations: [],
    unknowns: shortNuance ? [shortNuance] : [],
    comparisons: shortNuance ? [shortNuance] : [],
    questions: [],
    investigations: [],
    claims: []
  });
}

function fallbackAi(story: Story): AiStory {
  console.warn("Using fallback AI for story:", story.slug);
  const uniqueDomains = new Set(story.articles.map((a) => a.sourceDomain));
  const titles = story.articles.slice(0, 4).map((a) => a.title).filter(Boolean);
  const facts = story.articles
    .slice(0, 4)
    .map((a) => a.excerpt)
    .map((x) => x.split(/[.!?]\s+/)[0])
    .filter(Boolean)
    .map((x) => x.slice(0, 200));
  const summary = (
    uniqueDomains.size === 1
      ? "Dit verhaal is gebaseerd op één bron. Lees de originele bron voor volledige context."
      : titles.join(" • ").slice(0, 320) || story.summary || "Samenvatting tijdelijk niet beschikbaar."
  ).trim();
  return sanitizeAiStory({
    summary,
    narrative: summary,
    facts: facts.length >= 2 ? facts.slice(0, 6) : [summary, "Controleer de bronlinks voor aanvullende details."],
    interpretations: [],
    unknowns: [],
    comparisons: [],
    questions: [],
    investigations: [],
    claims: []
  });
}

export async function enrichStoriesWithAi(stories: Story[], opts?: { maxArticlesPerStory?: number }) {
  const maxArticlesPerStory = opts?.maxArticlesPerStory ?? 4;
  const apiKey = process.env.OPENAI_API_KEY;
  // Persistente AI-cache: alleen nieuwe/gewijzigde stories draaien opnieuw AI.
  // NOTE: If schema or prompt changes, delete data/ai to avoid stale outputs.
  const cacheDir = path.resolve("data/ai");
  await fs.mkdir(cacheDir, { recursive: true });

  if (!apiKey) {
    console.warn("[ai] OPENAI_API_KEY ontbreekt; fallback mode.");
    return stories.map((s) => ({
      ...s,
      category: s.category ?? "overig",
      topic: s.topic ?? "overig",
      shortHeadline: s.shortHeadline ?? fallbackShortHeadline(s),
      ai: sanitizeAiStory(fallbackAi(s)),
      aiStatus: "fallback" as const
    }));
  }

  const client = new OpenAI({ apiKey });

  validateOpenAiObjectSchema(schemaObject as unknown, "story_analysis.schema");

  type CacheTask = {
    index: number;
    story: Story;
    selected: Story["articles"];
    selectedIds: string[];
    cacheKey: string;
    cachePath: string;
  };

  const out: Story[] = new Array(stories.length);
  const toGenerate: CacheTask[] = [];

  let cacheHits = 0;
  let generatedCount = 0;
  let fallbackCount = 0;
  let skippedFewSources = 0;
  let skippedLowImportance = 0;

  const toFallbackStory = (story: Story, cacheKey: string): Story => ({
    ...story,
    category: story.category ?? "overig",
    topic: story.topic ?? "overig",
    shortHeadline: story.shortHeadline ?? fallbackShortHeadline(story),
    ai: sanitizeAiStory(fallbackAi(story)),
    aiStatus: "fallback" as const,
    aiCacheKey: cacheKey
  });
  const toSkippedStory = (story: Story, cacheKey: string): Story => ({
    ...story,
    category: story.category ?? "overig",
    topic: story.topic ?? "overig",
    shortHeadline: story.shortHeadline ?? fallbackShortHeadline(story),
    ai: sanitizeAiStory(fallbackAi(story)),
    aiStatus: "skipped" as const,
    aiCacheKey: cacheKey
  });

  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    const selected = pickTopArticlesForAi(story, maxArticlesPerStory);
    const selectedIds = selected.map((a) => a.id);
    const cacheKey = storyCacheKey(story, selectedIds);
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);

    if (fsSync.existsSync(cachePath)) {
      const cached = await fs.readFile(cachePath, "utf8").catch(() => null);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Partial<AiLiteResponse> & Record<string, unknown>;
          const aiStory = toFullAiStoryFromLite(parsed, story);

          out[i] = {
            ...story,
            category: String(parsed.category ?? "overig") as StoryCategory,
            topic: String(parsed.topic ?? "overig") as StoryTopic,
            shortHeadline:
              String(parsed.shortHeadline ?? story.shortHeadline ?? fallbackShortHeadline(story)),
            ai: aiStory,
            aiStatus: "ok",
            aiCacheKey: cacheKey
          };
          cacheHits += 1;
          console.log(`[ai] cache hit ${story.slug} (${cacheKey})`);
          continue;
        } catch {
          console.warn("[ai] cached JSON invalid; treating as cache miss", {
            slug: story.slug,
            cacheKey
          });
        }
      }
    }

    toGenerate.push({ index: i, story, selected, selectedIds, cacheKey, cachePath });
  }

  if (toGenerate.length === 0) {
    console.log("[ai] no new stories, skipping");
  } else {
    const AI_CONCURRENCY = 5;
    const MAX_AI_STORIES = 50;

    const skippedByCap: CacheTask[] = [];
    if (toGenerate.length > MAX_AI_STORIES) {
      skippedByCap.push(...toGenerate.slice(MAX_AI_STORIES));
      toGenerate.splice(MAX_AI_STORIES);
    }

    const generateForTask = async (task: CacheTask): Promise<Story> => {
      const { story, selected, cacheKey, cachePath } = task;
      console.log(`[ai-debug] ${story.slug} sources=${selected.length}`);

      if (selected.length < 2) {
        skippedFewSources += 1;
        console.log(`[ai] skip (too few sources) ${story.slug}`);
        return toSkippedStory(story, cacheKey);
      }

      if ((story.importance ?? 0) < MIN_AI_IMPORTANCE) {
        skippedLowImportance += 1;
        console.log(`[ai] skip (low importance) ${story.slug}`);
        return toSkippedStory(story, cacheKey);
      }

      if (selected.length >= 2) {
        // FORCE AI path for multi-source stories
      }

      console.log(`[ai] generating ${story.slug} (${cacheKey}) sources=${selected.length}`);

      const sourcesPayload = selected.map((a) => ({
        title: a.title,
        excerpt: a.excerpt.slice(0, 300),
        publishedAt: a.publishedAt,
        sourceDomain: a.sourceDomain
      }));

      const toneBlock = [
        "SYSTEM:",
        "Je bent 'voorbijdekop': een rustige, analytische onderzoeksassistent voor kritische lezers.",
        "Schrijf in het Nederlands. Sensatie vermijden.",
        ""
      ];

      const contextBlock = [
        "CONTEXT:",
        "Originele (lange) titel waaruit je moet verkorten:",
        story.title,
        "",
        "Bronnen (gestructureerd) (gebruik deze als feitelijke basis):",
        JSON.stringify(sourcesPayload, null, 2),
        ""
      ];

      const instructionBlock = [
        "INSTRUCTIE:",
        "Vat de gebeurtenis samen op basis van de bronnen.",
        "",
        "Regels:",
        "- Gebruik alleen informatie uit de bronnen.",
        "- Wees concreet (wie, wat, waar, wanneer).",
        "- Geen speculatie."
      ];

      const outputFormatBlock = [
        "OUTPUT:",
        "Geef JSON volgens schema.",
        "- shortHeadline: 8-12 woorden",
        "- summary: 3-5 zinnen",
        "- facts: 3-5 concrete feiten (elk 1 zin)",
        "- nuance: optioneel, 1 zin over onzekerheid of bronverschil",
        "",
        "BELANGRIJK:",
        "- Schrijf alle velden in het Nederlands.",
        "- Gebruik alleen de broninformatie.",
        "- Geen extra tekst buiten JSON."
      ];

      const prompt = [...toneBlock, ...contextBlock, ...instructionBlock, ...outputFormatBlock].join("\n");

      const payload = {
        model: "gpt-4.1-mini",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "story_analysis",
            schema: schemaObject
          }
        }
      };

      try {
        const resp = await openAiResponsesCreate(client as any, payload, {
          name: `story_analysis:${story.slug}`,
          context: {
            selectedArticleIds: selected.map((a) => a.id).slice(0, 8),
            selectedArticleCount: selected.length
          }
        });

        const parsed = (resp as any)?.output_parsed as AiLiteResponse | undefined;
        if (!parsed) {
          console.warn("[ai] No structured output; raw response follows");
          console.warn(JSON.stringify(resp, null, 2));
          throw new Error("OpenAI structured output missing");
        }
        if (!parsed.category || !parsed.topic || !parsed.shortHeadline || !parsed.summary) {
          console.warn("[ai] Invalid AI structure, fallback triggered");
          throw new Error("Invalid AI structure");
        }
        if (!Array.isArray(parsed.facts) || parsed.facts.length < 2) {
          console.warn("[ai] facts too short for lite mode, fallback triggered");
          throw new Error("Invalid AI facts length");
        }

        const aiStory = toFullAiStoryFromLite(parsed, story);
        const cleaned: AiLiteResponse = {
          category: parsed.category ?? "overig",
          topic: parsed.topic ?? "overig",
          shortHeadline: parsed.shortHeadline ?? story.shortHeadline ?? fallbackShortHeadline(story),
          summary: parsed.summary ?? story.summary,
          facts: parsed.facts.slice(0, 6),
          ...(parsed.nuance ? { nuance: parsed.nuance } : {})
        };

        // Alleen bij AI-success cache schrijven.
        await fs.writeFile(cachePath, JSON.stringify(cleaned, null, 2), "utf8");

        generatedCount += 1;
        return {
          ...story,
          category: cleaned.category as StoryCategory,
          topic: cleaned.topic as StoryTopic,
          shortHeadline: cleaned.shortHeadline ?? story.shortHeadline ?? fallbackShortHeadline(story),
          ai: aiStory,
          aiStatus: "ok",
          aiCacheKey: cacheKey
        };
      } catch (err: unknown) {
        console.error("AI generation failed:", err instanceof Error ? err.message : err);
        console.error("AI generation context:", {
          slug: story.slug,
          storyId: story.storyId,
          cacheKey
        });
        if (STRICT_AI) throw err;

        fallbackCount += 1;
        return toFallbackStory(story, cacheKey);
      }
    };

    for (const chunk of chunkArray(toGenerate, AI_CONCURRENCY)) {
      const results = await Promise.all(
        chunk.map(async (t) => ({
          index: t.index,
          story: await generateForTask(t)
        }))
      );
      for (const r of results) out[r.index] = r.story;
    }

    for (const task of skippedByCap) {
      out[task.index] = toFallbackStory(task.story, task.cacheKey);
      fallbackCount += 1;
    }
  }

  if (out.some((story) => !story)) {
    console.warn("[ai] detected undefined stories, applying fallback");
  }
  for (let i = 0; i < stories.length; i++) {
    if (!out[i]) {
      const selected = pickTopArticlesForAi(stories[i], maxArticlesPerStory);
      const selectedIds = selected.map((a) => a.id);
      const cacheKey = storyCacheKey(stories[i], selectedIds);
      out[i] = toFallbackStory(stories[i], cacheKey);
      fallbackCount += 1;
    }
  }

  console.log(`[ai] stats:
  cacheHits=${cacheHits}
  generated=${generatedCount}
  fallback=${fallbackCount}
  skippedFewSources=${skippedFewSources}
  skippedLowImportance=${skippedLowImportance}
`);

  // TEMP: disable prune to prevent cache loss when enrichment runs on a subset.

  return out;
}

