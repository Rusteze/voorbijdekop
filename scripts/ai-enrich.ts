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
    narrative: { type: "string" },
    bullets: {
      type: "array",
      items: { type: "string" },
      maxItems: 5
    }
  },
  required: ["category", "topic", "shortHeadline", "narrative", "bullets"]
} as const;

type AiLiteResponse = {
  category: string;
  topic: string;
  shortHeadline: string;
  narrative: string;
  bullets: string[];
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

function looksEnglish(text: string) {
  const t = ` ${text.toLowerCase()} `;
  const hits = [" the ", " and ", " with ", " from ", " this ", " that ", " are ", " was "].filter((w) => t.includes(w)).length;
  return hits >= 2;
}

function ensureDutchBullets(items: string[]) {
  return items
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((x) => (looksEnglish(x) ? "Broninformatie is vertaald en samengevat in het verhaal." : x));
}

function normalizeText(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string) {
  const ta = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

function dedupeBullets(raw: string[], title: string, narrative: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const bullet of raw) {
    const b = normalizeText(bullet);
    if (!b || seen.has(b)) continue;
    const nearTitle = tokenSimilarity(bullet, title) > 0.8;
    const nearNarrative = tokenSimilarity(bullet, narrative) > 0.8 || normalizeText(narrative).includes(b);
    if (nearTitle || nearNarrative) continue;
    seen.add(b);
    out.push(bullet.trim());
    if (out.length >= 5) break;
  }
  return out;
}

function toFullAiStoryFromLite(parsed: Partial<AiLiteResponse>, story: Story): AiStory {
  const narrative = String(parsed.narrative ?? "").trim();
  const summary = narrative
    ? narrative.split(/\n+/).map((p) => p.trim()).filter(Boolean)[0] ?? story.summary
    : story.summary;
  const facts = Array.isArray(parsed.bullets)
    ? dedupeBullets(ensureDutchBullets(parsed.bullets), story.title ?? "", narrative).slice(0, 5)
    : [];

  return sanitizeAiStory({
    summary: summary || story.summary,
    narrative: narrative || story.summary,
    facts: facts.length > 0 ? facts : ["Controleer de bronlinks voor aanvullende details."],
    interpretations: [],
    unknowns: [],
    comparisons: [],
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
  const factsNl = ensureDutchBullets(facts);
  const summary = (
    uniqueDomains.size === 1
      ? "Dit verhaal is gebaseerd op één bron. Lees de originele bron voor volledige context."
      : titles.join(" • ").slice(0, 320) || story.summary || "Samenvatting tijdelijk niet beschikbaar."
  ).trim();
  return sanitizeAiStory({
    summary,
    narrative: summary,
    facts: factsNl.length >= 2 ? factsNl.slice(0, 6) : [summary, "Controleer de bronlinks voor aanvullende details."],
    interpretations: [],
    unknowns: [],
    comparisons: [],
    questions: [],
    investigations: [],
    claims: []
  });
}

export async function enrichStoriesWithAi(stories: Story[], opts?: { maxArticlesPerStory?: number }) {
  const maxArticlesPerStory = opts?.maxArticlesPerStory ?? 3;
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
  let singleSourceCount = 0;
  let multiSourceCount = 0;
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

      if (selected.length < 1) {
        console.log(`[ai] skip (no sources) ${story.slug}`);
        fallbackCount += 1;
        return toFallbackStory(story, cacheKey);
      }

      if ((story.importance ?? 0) < MIN_AI_IMPORTANCE) {
        skippedLowImportance += 1;
        console.log(`[ai] fallback (low importance) ${story.slug}`);
        fallbackCount += 1;
        return toFallbackStory(story, cacheKey);
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

      const isSingleSource = selected.length === 1;
      if (isSingleSource) singleSourceCount += 1;
      else multiSourceCount += 1;

      const instructionBlock = isSingleSource
        ? [
            "INSTRUCTIE:",
            "Schrijf een heldere, korte samenvatting op basis van deze ene bron.",
            "",
            "NARRATIVE:",
            "- 2 tot 4 korte alinea's",
            "- volledig in het Nederlands",
            "- concreet en feitelijk, geen speculatie",
            "- niet letterlijk de titel of eerste zin herhalen",
            "- voeg context en samenhang toe",
            "",
            "BELANGRIJK:",
            "- Gebruik alleen informatie uit deze bron.",
            "- Vertaal broninhoud naar het Nederlands.",
            "- Schrijf een vloeiend verhaal van meerdere alinea's. Herhaal niet letterlijk de titel of eerste zin. Voeg context en samenhang toe.",
            "- Geen extra tekst buiten JSON."
          ]
        : [
            "INSTRUCTIE:",
            "Schrijf één helder, vloeiend verhaal op basis van meerdere nieuwsbronnen.",
            "",
            "NARRATIVE (BELANGRIJKSTE):",
            "- 2 tot 4 korte alinea's",
            "- volledig in het Nederlands",
            "- combineer ALLE bronnen tot één logisch verhaal",
            "- begin met wat er gebeurt (wie/wat/waar)",
            "- daarna: context, verschillen, impact",
            "- niet letterlijk de titel of eerste zin herhalen",
            "- geen opsomming",
            "- geen generieke zinnen",
            "",
            "BELANGRIJK:",
            "- Gebruik ALLEEN info uit de bronnen",
            "- Vertaal ALLES naar Nederlands (ook Engelse excerpts)",
            "- Combineer bronnen: geen losse samenvattingen",
            "- Vermijd herhaling tussen narrative en bullets",
            "- Schrijf een vloeiend verhaal van meerdere alinea's. Herhaal niet letterlijk de titel of eerste zin. Voeg context en samenhang toe.",
            "",
            "STIJL:",
            "- rustig, analytisch",
            "- geen clickbait",
            "- concreet en feitelijk"
          ];

      const outputFormatBlock = isSingleSource
        ? [
            "OUTPUT:",
            "Geef JSON volgens schema.",
            "- shortHeadline: korte, concrete kop",
            "- narrative: 2-4 korte alinea's",
            "- bullets: verplicht, max 3, korte concrete feiten",
            "",
            "BELANGRIJK:",
            "- Schrijf alle velden in het Nederlands.",
            "- Gebruik alleen de broninformatie.",
            "- Geen extra tekst buiten JSON."
          ]
        : [
            "OUTPUT:",
            "Geef JSON volgens schema.",
            "- shortHeadline: korte, concrete kop",
            "- narrative: 5-8 korte alinea's, 400-700 woorden",
            "- bullets: verplicht, max 5, korte concrete feiten",
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
        if (!parsed.category || !parsed.topic || !parsed.shortHeadline || !parsed.narrative) {
          console.warn("[ai] Invalid AI structure, fallback triggered");
          throw new Error("Invalid AI structure");
        }
        if (!parsed.bullets || parsed.bullets.length === 0) {
          console.warn("[ai] Missing bullets, fallback triggered");
          throw new Error("Missing bullets");
        }
        const narrativeText = String(parsed.narrative ?? "").trim();
        const paragraphs = narrativeText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        const wordCount = narrativeText.split(/\s+/).filter(Boolean).length;
        const invalidNarrativeShape = paragraphs.length < 2 || paragraphs.length > 4 || wordCount < 120 || wordCount > 520;
        if (invalidNarrativeShape) {
          console.warn("[ai] narrative shape out of range, fallback triggered", {
            mode: isSingleSource ? "single-source" : "multi-source",
            paragraphs: paragraphs.length,
            words: wordCount,
          });
          throw new Error("Invalid AI narrative shape");
        }

        const aiStory = toFullAiStoryFromLite(parsed, story);
        const cleaned: AiLiteResponse = {
          category: parsed.category ?? "overig",
          topic: parsed.topic ?? "overig",
          shortHeadline: parsed.shortHeadline ?? story.shortHeadline ?? fallbackShortHeadline(story),
          narrative: parsed.narrative,
          bullets: dedupeBullets(ensureDutchBullets(parsed.bullets), story.title ?? "", parsed.narrative ?? "").slice(0, 5)
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
  singleSource=${singleSourceCount}
  multiSource=${multiSourceCount}
  skippedLowImportance=${skippedLowImportance}
`);

  // TEMP: disable prune to prevent cache loss when enrichment runs on a subset.

  return out;
}

