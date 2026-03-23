import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import type { AiStory, InvestigationToolPill, Story, StoryCategory, StoryTopic } from "./types.js";
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

const schemaObject = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: CATEGORIES },
    topic: { type: "string", enum: TOPICS },
    shortHeadline: { type: "string" },
    summary: { type: "string" },
    narrative: { type: "string" },
    facts: {
      type: "array",
      items: { type: "string" }
    },
    interpretations: {
      type: "array",
      items: { type: "string" }
    },
    unknowns: {
      type: "array",
      items: { type: "string" }
    },
    comparisons: {
      type: "array",
      items: { type: "string" }
    },
    questions: {
      type: "array",
      items: { type: "string" }
    },
    investigations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          what: { type: "string" },
          why: { type: "string" },
          steps: {
            type: "array",
            items: { type: "string" }
          },
          tools: {
            type: "array",
            minItems: 4,
            maxItems: 10,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" }
              },
              required: ["label"]
            }
          },
          resourceLinks: {
            type: "array",
            minItems: 2,
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                url: { type: "string" },
                note: { type: "string" }
              },
              required: ["label", "url", "note"]
            }
          }
        },
        required: ["title", "what", "why", "steps", "tools", "resourceLinks"]
      }
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          claim: { type: "string" },
          confidence: { type: "string" },
          verification: { type: "string" }
        },
        required: ["claim", "confidence", "verification"]
      }
    }
  },
  required: [
    "category",
    "topic",
    "shortHeadline",
    "summary",
    "narrative",
    "facts",
    "interpretations",
    "unknowns",
    "comparisons",
    "questions",
    "investigations",
    "claims"
  ]
} as const;

type AiResponse = AiStory & { category: StoryCategory; topic: StoryTopic; shortHeadline?: string };

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

/** Zet tool-rijen om naar label-only pills (geen URL's in tools; sluit aan op schema + UI). */
function normalizeInvestigationToolsToPills(tools: unknown[]): InvestigationToolPill[] {
  return tools.map((t, i) => {
    if (typeof t === "string") {
      return { label: t.trim() || `Onderzoeksstap ${i + 1}` };
    }
    if (t && typeof t === "object" && "label" in t) {
      const label = String((t as { label?: unknown }).label ?? "").trim() || `Onderzoeksstap ${i + 1}`;
      return { label };
    }
    return { label: `Onderzoeksstap ${i + 1}` };
  });
}

/** Past ruwe API-JSON aan naar de interne AiStory-vorm (tools → pills). */
function normalizeParsedAiStoryShape(raw: Record<string, unknown>): void {
  const invs = raw.investigations;
  if (!Array.isArray(invs)) return;
  for (const inv of invs) {
    if (!inv || typeof inv !== "object") continue;
    const tools = (inv as { tools?: unknown }).tools;
    if (!Array.isArray(tools)) continue;
    (inv as { tools: InvestigationToolPill[] }).tools = normalizeInvestigationToolsToPills(tools);
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
    ids: selectedIds,
    titles: selectedIds.map((id) => story.articles.find((a) => a.id === id)?.title ?? "")
  };
  return sha256Hex(JSON.stringify(payload)).slice(0, 24);
}

/** Minimaal 2 klikbare links voor fallback / robuuste UI. */
function resourceLinksFromArticles(
  articles: Story["articles"],
  start: number,
  count: number
): { label: string; url: string; note?: string }[] {
  const picked = articles.slice(start, start + count).map((a) => ({
    label: `Open — ${a.sourceDomain}`,
    url: a.url,
    note: a.title.slice(0, 120)
  }));
  if (picked.length >= 2) return picked.slice(0, 6);
  if (picked.length === 1) {
    const u = picked[0].url;
    return [
      picked[0],
      {
        label: "Wayback Machine: eerdere versie van deze URL",
        url: `https://web.archive.org/web/*/${encodeURIComponent(u)}`,
        note: "Controleer of de pagina later is gewijzigd."
      }
    ];
  }
  return [
    { label: "Zoek verder (DuckDuckGo)", url: "https://duckduckgo.com/", note: "Geen artikel-URL in dit dossier." },
    { label: "Internet Archive", url: "https://archive.org/", note: "Context en historisch materiaal." }
  ];
}

function fallbackAi(story: Story): AiStory {
  console.warn("Using fallback AI for story:", story.slug);
  const titles = story.articles.slice(0, 5).map((a) => a.title);
  const summary = titles.join(" • ").slice(0, 260);
  const domains = [...new Set(story.articles.map((a) => a.sourceDomain))];
  const biases = [...new Set(story.articles.map((a) => a.source.bias))];
  const depths = [...new Set(story.articles.map((a) => a.source.depth))];
  const topEntities = (() => {
    const m = new Map<string, number>();
    for (const a of story.articles) for (const e of a.entities) m.set(e, (m.get(e) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);
  })();

  const comparisons = [
    `Bronnen: ${domains.join(", ")}`,
    `Bias-spreiding (metadata): ${biases.join(" / ") || "onbekend"}`,
    `Diepte (metadata): ${depths.join(" / ") || "onbekend"}`
  ];

  const facts = story.articles
    .slice(0, 4)
    .map((a) => a.excerpt)
    .map((x) => x.split(/[.!?]\s+/)[0])
    .filter(Boolean)
    .map((x) => x.slice(0, 200));

  const questions = [
    ...(topEntities.length ? [`Welke rol spelen ${topEntities.slice(0, 3).join(", ")} in dit verhaal?`] : []),
    "Welke claims worden door meerdere bronnen bevestigd, en welke slechts door één bron genoemd?",
    "Welke primaire bronnen (documenten, satellietbeelden, officiële verklaringen) kunnen dit onderbouwen?"
  ];

  const d0 = domains[0];
  const d1 = domains[1];
  const narrative = [
    `Dit dossier bundelt ${story.articles.length} artikelen van: ${domains.join(", ") || "onbekende bronnen"}. Omdat er geen live AI-synthese draait, krijg je hier een uitgebreidere leesbare basis op titels, eerste zinnen van uittreksels en metadata — geen definitieve waarheid.`,
    "",
    topEntities.length
      ? `Terugkerende entiteiten in de bronnen (heuristiek): ${topEntities.join(", ")}. Gebruik dit als start om te zien welke actoren het vaakst genoemd worden.`
      : "Er zijn nog weinig automatisch herkende entiteiten; lees de bronnen zelf om actoren te identificeren.",
    "",
    "Wat hier opvalt",
    "Titels en eerste zinnen geven vaak al de framing van een medium. Vergelijk daarom bewust wie wat als feit presenteert en wat als inschatting of citaat. Controleer data en tijdstippen in de originele URL’s onderaan de pagina.",
    "",
    facts.length
      ? `Voorbeelden uit de eerste zin van uittreksels (niet als feit geverifieerd):\n${facts.slice(0, 4).map((f, i) => `• ${f}`).join("\n")}`
      : "Geen bruikbare uittrekselregels; open de bronnen volledig voor feitelijke inhoud.",
  ].join("\n\n");

  const dossierToolsA: InvestigationToolPill[] = [
    {
      label: `Per stuk van ${d0 ?? "bron 1"}: noteer harde claims (wie/wat/waar/wanneer) na het volledig lezen`,
    },
    {
      label: d1
        ? `Leg ${d0} en ${d1} naast elkaar: dezelfde gebeurtenis — welke details ontbreekt er bij één van beide?`
        : `Markeer in elke titel woorden die de lezer sturen (bijv. “aanval”, “offensief”, “precisie”)`,
    },
    ...(story.articles[0]
      ? [
          {
            label: `Controleer datum, rubriek en eventuele updates bij: “${story.articles[0].title.slice(0, 72)}${story.articles[0].title.length > 72 ? "…" : ""}” (${story.articles[0].sourceDomain})`,
          },
        ]
      : []),
    {
      label: "Raadpleeg open naslag over OSINT-methodes (bijv. Bellingcat-resources) en pas één techniek toe op dit dossier"
    },
    {
      label: "Gebruik een webarchief om eerdere versies van een bronpagina te vergelijken met de huidige tekst"
    }
  ];

  const dossierToolsB: InvestigationToolPill[] = [
    {
      label: `Zoek in het dossier welke bron een document, dataset of officiële verklaring noemt — en welke bron dat níét doet`,
    },
    {
      label: `Formuleer drie ja/nee-verificatievragen die je alleen kunt beantwoorden met primaire bronnen (niet met opinie)`,
    },
    ...(story.articles[1]
      ? [
          {
            label: `Vergelijk de inleiding van ${story.articles[1].sourceDomain} met ${d0 ?? "andere bron"} op hetzelfde subonderwerp`,
          },
        ]
      : []),
    {
      label: "Gebruik geavanceerde zoekoperators om de kernclaim in andere betrouwbare media te verifiëren"
    },
    {
      label: "Controleer locatieclaims met een openbare kaartlaag en noteer wat wel/niet visueel te onderbouwen is"
    }
  ];

  return sanitizeAiStory({
    summary,
    narrative,
    facts: facts.length ? facts : ["De bronnen beschrijven een lopende gebeurtenis; exacte feiten moeten per bron worden geverifieerd."],
    interpretations: [
      "De formulering en focus kunnen per bron verschillen; controleer welke details als feit worden gepresenteerd versus als duiding."
    ],
    unknowns: [
      "Welke concrete feiten/cijfers ontbreken in de bronuittreksels en moeten per originele bron worden opgezocht om claims te verifiëren?",
      "Welke primaire onderbouwing (documenten, officiële verklaringen, data, of on-site bewijs) wordt niet genoemd maar zou nodig zijn om de kernbewering betrouwbaar te toetsen?"
    ],
    comparisons,
    questions,
    investigations: [
      {
        title: "Verzamel en vergelijk primaire bronnen",
        what: "Open de originele artikelen en noteer expliciete claims (wie/wat/waar/wanneer).",
        why: "Zonder AI is een handmatige bronvergelijking de snelste route naar betrouwbaarheid.",
        steps: [
          "Open alle bronlinks onderaan en noteer per bron de kernclaim + datum/tijd.",
          "Identificeer per bron welke primaire onderbouwing genoemd wordt (officiële verklaring, document, dataset, video/foto).",
          "Markeer verschillen in claim-interpretatie en lijst de ontbrekende details die je nog moet opzoeken.",
          "Formuleer 3 verificatievragen die je kunt toetsen met ten minste één primaire bron."
        ],
        tools: dossierToolsA,
        resourceLinks: resourceLinksFromArticles(story.articles, 0, 4)
      },
      {
        title: "Zoek tegenstem en primaire onderbouwing",
        what: "Controleer of andere kwaliteitsmedia dezelfde feiten noemen en of er primaire documenten bestaan.",
        why: "Eenzijdige framing valt op als je bewust andere betrouwbare bronnen en primaire bronnen meeneemt.",
        steps: [
          "Zoek de kernclaim in 1–2 andere bronnen uit het dossier en noteer verschillen in formulering.",
          "Noteer welke bronnen verwijzen naar documenten, data of officiële verklaringen — en welke dat niet doen.",
          "Formuleer wat je nog moet vinden om de claim hard te kunnen maken."
        ],
        tools: dossierToolsB,
        resourceLinks: resourceLinksFromArticles(story.articles, 1, 4)
      }
    ],
    claims: story.articles.slice(0, 4).map((a) => ({
      claim: `Volgens ${a.sourceDomain}: ${a.title}`,
      confidence: "laag",
      verification: "Open het originele artikel, check publicatiedatum, en zoek naar primaire bronverwijzingen (officiële documenten/verklaringen, foto/video, data)."
    }))
  });
}

export async function enrichStoriesWithAi(stories: Story[], opts?: { maxArticlesPerStory?: number }) {
  const maxArticlesPerStory = opts?.maxArticlesPerStory ?? 8;
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
  const usedCacheKeys = new Set<string>();
  const toGenerate: CacheTask[] = [];

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
    usedCacheKeys.add(cacheKey);

    if (fsSync.existsSync(cachePath)) {
      const cached = await fs.readFile(cachePath, "utf8").catch(() => null);
      if (cached) {
        try {
          // Cache is written as cleaned AiResponse; trust it to avoid extra normalize/sanitize passes.
          const parsed = JSON.parse(cached) as AiResponse;
          const { category, topic, shortHeadline, ...rawAi } = parsed;
          const aiStory = rawAi as AiStory;

          out[i] = {
            ...story,
            category: category ?? "overig",
            topic: topic ?? "overig",
            shortHeadline: shortHeadline ?? story.shortHeadline ?? fallbackShortHeadline(story),
            ai: aiStory,
            aiStatus: "ok",
            aiCacheKey: cacheKey
          };
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

    const generateForTask = async (task: CacheTask): Promise<Story> => {
      const { story, selected, cacheKey, cachePath } = task;
      console.log(`[ai] generating ${story.slug} (${cacheKey}) sources=${selected.length}`);

      const sourcesPayload = selected.map((a) => ({
        title: a.title,
        excerpt: a.excerpt.slice(0, 500),
        publishedAt: a.publishedAt,
        url: a.url,
        sourceDomain: a.sourceDomain,
        sourceType: a.source.type,
        sourceBias: a.source.bias,
        sourceDepth: a.source.depth
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
        "Schrijf als een onderzoeksjournalist, niet als een nieuws-samenvatter.",
        "Stijl:",
        "- Korte zinnen.",
        "- Concreet en specifiek. Noem waar mogelijk wie/wat/waar/wanneer volgens de bronnen.",
        "- Vermijd generieke formuleringen zoals 'De oorlog heeft...' of 'Er zijn...'.",
        "- Als bronnen iets suggereren zonder details: benoem wat ontbreekt (cijfers, mechanismen, bewijs).",
        "- Dwing specificiteit af: noem actoren (wie zei wat), locaties en tijdstippen als die in de bronnen staan.",
        "- Als er getallen of hoeveelheden worden genoemd: neem ze letterlijk over (en zeg als ze ontbreken).",
        "- Benoem onzekerheid expliciet. Gebruik woorden als 'onduidelijk', 'niet onderbouwd', 'niet bevestigd' waar passend.",
        "",
        "WAARHEIDSDISCIPLINE (MUST):",
        "- Schrijf alleen wat expliciet uit de bronnen blijkt.",
        "- Als een detail ontbreekt (cijfers, exacte locatie, timing): benoem dit expliciet.",
        "- Vermijd vage formuleringen zoals 'er zijn spanningen' zonder concrete actoren of gebeurtenissen.",
        "- Gebruik waar mogelijk deze structuur:",
        "  'Volgens [bron X] gebeurt Y, terwijl [bron Z] dit anders of niet benoemt.'",
        "- Als meerdere bronnen hetzelfde zeggen: benoem dat expliciet als bevestiging.",
        "",
        "CONCRETISERING (MUST):",
        "- Vermijd algemene of abstracte zinnen.",
        "- Elke alinea moet minimaal één concreet element bevatten:",
        "  (actor, locatie, tijdstip, getal, of specifieke claim).",
        "- Slechte zin (NIET doen):",
        "  'De situatie is complex en onzeker.'",
        "- Goede zin:",
        "  'Volgens Reuters vond de aanval plaats in [locatie], terwijl NOS geen locatie noemt.'",
        "",
        "BRONWEEGING (MUST):",
        "- Gebruik de metadata uit sourcesPayload (sourceType, sourceDepth, sourceBias).",
        "- Geef impliciet meer gewicht aan:",
        "  - investigative > analysis > news",
        "  - very-high depth > high > medium",
        "- Als een claim alleen voorkomt in een lage diepte of één bron:",
        "  benoem dit expliciet als zwakke onderbouwing.",
        "- Als meerdere sterke bronnen (high/very-high depth) hetzelfde zeggen:",
        "  benoem dit expliciet als sterkere bevestiging.",
        "",
        "CONTRADICTIE DETECTIE (MUST):",
        "- Controleer expliciet of bronnen elkaar tegenspreken.",
        "- Als er een verschil is:",
        "  benoem exact WAT verschilt (locatie, tijd, aantallen, framing).",
        "- Gebruik formulering zoals:",
        "  'Bron A noemt X, terwijl bron B Y noemt.'",
        "- Als er GEEN contradictie is:",
        "  zeg expliciet dat bronnen elkaar bevestigen (of dat er onvoldoende detail is om dit te bepalen).",
        "",
        "BETROUWBAARHEIDSSIGNALEN (MUST):",
        "- Geef impliciet aan hoe sterk een claim is:",
        "  - 'wordt door meerdere bronnen bevestigd'",
        "  - 'komt slechts in één bron voor'",
        "  - 'niet onafhankelijk bevestigd'",
        "- Gebruik dit in narrative en interpretations."
      ];

      const outputFormatBlock = [
        "BELANGRIJK: Je output MOET geldig JSON zijn volgens het meegegeven schema, zonder extra tekst.",
        "Regels:",
        "- Maak geen feiten verzonnen; gebruik alleen wat in de bronnen staat.",
        "- Scheid strikt: feiten vs interpretaties vs onbekend.",
        "- Als iets onduidelijk is: zet het in unknowns.",
        "- unknowns mogen alleen inhoudelijke ontbrekende informatie beschrijven (geen meta over AI/build/cache).",
        "",
        "UNKNOWNS (MUST):",
        "- Dit is een kernonderdeel.",
        "- Benoem specifiek WAT ontbreekt:",
        "  - geen cijfers",
        "  - geen exacte locatie",
        "  - geen bevestiging door andere bronnen",
        "- Vermijd vage zinnen zoals 'meer onderzoek nodig'.",
        "",
        "- Highlight spanning, onzekerheid en tegenstrijdigheden tussen bronnen (of expliciet: geen gezien).",
        "- Vergelijk bronnen: framing/woordkeuze/claimverschillen. Benoem wat twijfelachtig of slecht onderbouwd is.",
        "",
        "CLAIMS (MUST):",
        "- Formuleer alleen claims die daadwerkelijk getest kunnen worden.",
        "- Vermijd vage claims.",
        "- Verification moet verwijzen naar:",
        "  - specifieke bron (sourceDomain uit sourcesPayload), of",
        "  - concreet type bewijs (document, verklaring, beeldmateriaal).",
        "",
        "TAAL (MUST):",
        "- Alle gebruikersgerichte tekst — `summary`, `narrative`, `facts`, `interpretations`, `unknowns`, `comparisons`, `questions`, alle tekst in `investigations` (title/what/why/steps/tools.label/note), en `claims` — schrijf je in het **Nederlands**.",
        "- Geen Engelse zinnen in `facts` of `interpretations` (uitzondering: officiële eigennamen, citaten, of vaste Engelse terminologie tussen aanhalingstekens).",
        "",
        "GEEN MARKUP (MUST):",
        "- Geen HTML of Markdown in enig stringveld: geen <p>, <br>, <ul>, <li>, <strong>, **, #, enz.",
        "- Alleen platte tekst. In `narrative`: gebruik dubbele regeleinden (\\n\\n) tussen alinea's.",
        "- `facts`: elk item één heldere zin in het Nederlands; geen opsommingstekens of tags in de string.",
        "",
        "FACTS (MUST):",
        "- Elke fact is één concrete, verifieerbare zin.",
        "- Geen interpretatie of conclusie.",
        "- Als de bron geen concreet feit geeft: NIET invullen — laat het weg of verplaats naar unknowns.",
        "",
        "Verplichte minimale scherpte (MUST):",
        "- Neem ALTIJD minstens één van deze drie op (kies wat het meest waarheidsgetrouw is op basis van de bronnen):",
        "  1) een contradictie tussen bronnen, OF",
        "  2) een onduidelijk/ontbrekend element, OF",
        "  3) een spanning in framing/woordkeuze tussen bronnen.",
        "- Als er echt geen contradicties zijn: benoem precies WAT ontbreekt om dat te kunnen toetsen (unknowns).",
        "",
        "Samengevoegd verhaal (`narrative`, string) — uitgebreid (MUST):",
        "- Schrijf een **vlotte, uitgebreide synthese** (geen opsomming van losse feiten alleen): minimaal **7 alinea's**, bij voorkeur **9–14** korte alinea's, tenzij de bronnen echt te weinig inhoud bieden.",
        "- Streef naar **minimaal ~550 woorden** zolang de bronnen dat toelaten; mag langer als dat de nuance vereist.",
        "- Begin met context (wat spelen de bronnen), werk naar spanning/contradictie of expliciete hiaten.",
        "- Voeg in de narrative het subkopje (als platte tekst op eigen regel):",
        "  Wat hier opvalt",
        "  gevolgd door minstens **twee** alinea's die voldoen aan **Wat hier opvalt (MUST)** hieronder.",
        "",
        "Wat hier opvalt (MUST):",
        "- Benoem minimaal één van:",
        "  1. een concrete contradictie tussen bronnen",
        "  2. een duidelijk ontbrekend detail (bijv. geen cijfers, geen locatie)",
        "  3. verschil in framing (woordkeuze zoals 'aanval' vs 'operatie')",
        "- Vermijd algemene observaties — wees specifiek en bewijsbaar.",
        "",
        "ONDERZOEK DIT VERHAAL (INVESTIGATIONS) — ZEER CONCREET EN TESTBAAR:",
        "- Elke stap moet direct uitvoerbaar zijn zonder interpretatie.",
        "- Elke stap moet leiden tot een controleerbaar resultaat en antwoord geven op een concrete vraag.",
        "- Voeg in de stap impliciet een 'verwachte uitkomst' toe (wat je ziet als het klopt vs. wat een afwijking betekent).",
        "",
        "- Gebruik deze structuur:",
        "  'Open [bron of site] en controleer of [specifieke claim] aanwezig is.'",
        "",
        "- Voorbeeld met uitkomst:",
        "  'Open nos.nl en controleer of dezelfde gebeurtenis wordt beschreven als \"aanval\" of \"operatie\". Als de termen verschillen van een andere bron, wijst dit op framingverschil.'",
        "",
        "- Slechte stap:",
        "  'Zoek meer informatie over het conflict'",
        "",
        "- Goede stap (zonder uitkomstzin mag ook, maar liever met):",
        "  'Open nos.nl en controleer of dezelfde gebeurtenis wordt beschreven als \"aanval\" of \"operatie\".'",
        "",
        "- Vermijd stappen zonder duidelijk resultaat of zonder te beantwoorden vraag.",
        "- Vermijd abstracte instructies.",
        "- Verwijs waar mogelijk naar exacte sourceDomain uit sourcesPayload.",
        "- Alleen legale, openbaar toegankelijke OSINT (web, kaarten, archieven, registers waar publiek); geen hacking, geen niet-publieke systemen, geen instructies die privacy of wet overtreden.",
        "- Per onderzoek: noem welke claim, actor, locatie of tijd je toetst en welke observatie de uitkomst bevestigt of ontkracht.",
        "- Per investigation: ten minste één stap of tool moet expliciet een exacte `sourceDomain` uit sourcesPayload noemen (bv. nos.nl).",
        "- `steps`: formuleer als uitvoerbare check in bovenstaande structuur; geen vage zoekopdrachten.",
        "",
        "- **Belangrijk:** in `tools` zet je **geen URL's en geen http(s)-tekst**; alleen korte actiezinnen. Echte klikbare links horen uitsluitend in `resourceLinks`.",
        "",
        "- `tools`: array van 4–10 objecten, elk **alleen** `{ \"label\" }` (één string). Dit is de **aanpak-pill**-lijst: concrete onderzoeksacties, geen links.",
        "  - Elk `label` is één korte, uitvoerbare instructie in het Nederlands.",
        "  - Voorbeelden:",
        "    - \"Vergelijk framing tussen nos.nl en reuters.com op hetzelfde incident\"",
        "    - \"Controleer datum en updates op de originele bronpagina's uit sourcesPayload\"",
        "    - \"Zoek in elk artikel naar primaire bronverwijzingen (documenten, data, officiële verklaringen)\"",
        "  - **PRIORITEIT (MUST): minstens de helft** van de tools (dus minimaal 3–5 items) moet **duidelijk op dit dossier zijn toegesneden**: concrete actoren, claims, tijdvakken, locaties of **exacte `sourceDomain`-namen** uit sourcesPayload in de `label`.",
        "  - **Secundair: hoogstens 2** tools mogen een **generieke** werkwijze beschrijven (bijv. archiefvergelijking of kaartlezen) — als aanvulling, niet als vervanging van dossier-specifieke acties.",
        "- `resourceLinks` (verplicht, 2–8 items): **echte https-URL's** die direct helpen bij deze onderzoeksrichting.",
        "  - Minstens één `url` moet **exact** gelijk zijn aan een `url` uit sourcesPayload (zelfde string).",
        "  - `label`: één regel, actiegericht (bv. 'Lees X bij NOS', 'Vergelijk framing Reuters').",
        "  - `note` (optioneel): max ~1 zin — wat je op die pagina checkt.",
        "  - Aanvullend: publieke OSINT-tools (Wayback, Bellingcat-gidsen, gerichte zoek-URL met query); geen generieke startpagina zonder zoekterm.",
        "  - Geen URL's verzinnen; geen `javascript:` of data-URL's.",
        "",
        "Categorie (category):",
        `- Kies exact één van: ${CATEGORIES.join(", ")}.`,
        "- Kies op basis van onderwerp en impact; als het niet duidelijk past: overig.",
        "",
        "Topic (topic):",
        `- Kies exact één van: ${TOPICS.join(", ")}.`,
        "- Kies de meest intelligence-relevante invalshoek (macht, conflict, invloed, strategie).",
        "- Als het te generiek of laag-impact is: overig.",
        "",
        "Short headline (shortHeadline):",
        "- Maak een verkorte titel in 8–12 woorden.",
        "- Houd sleutelactoren en de kernactie/impact vast.",
        "- Geen clickbait, geen nieuwe feiten, geen speculatie.",
        "- Laat inhoud weg die niet essentieel is.",
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

        const parsed = (resp as any)?.output_parsed as AiResponse | undefined;
        if (!parsed) {
          console.warn("[ai] No structured output; raw response follows");
          console.warn(JSON.stringify(resp, null, 2));
          throw new Error("OpenAI structured output missing");
        }
        if (!parsed.category || !parsed.topic) {
          console.warn("[ai] Invalid AI structure, fallback triggered");
          throw new Error("Invalid AI structure");
        }

        normalizeParsedAiStoryShape(parsed as unknown as Record<string, unknown>);

        const { category, topic, shortHeadline, ...rawAi } = parsed;
        const aiStory = sanitizeAiStory(rawAi as AiStory);
        const cleaned: AiResponse = {
          category: category ?? "overig",
          topic: topic ?? "overig",
          shortHeadline: shortHeadline ?? story.shortHeadline ?? fallbackShortHeadline(story),
          ...aiStory
        };

        // Alleen bij AI-success cache schrijven.
        await fs.writeFile(cachePath, JSON.stringify(cleaned, null, 2), "utf8");

        return {
          ...story,
          category: cleaned.category,
          topic: cleaned.topic,
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

        return {
          ...story,
          category: story.category ?? "overig",
          topic: story.topic ?? "overig",
          shortHeadline: story.shortHeadline ?? fallbackShortHeadline(story),
          ai: sanitizeAiStory(fallbackAi(story)),
          aiStatus: "fallback" as const,
          aiCacheKey: cacheKey
        };
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
  }

  // Prune cache: behoud alleen JSON bestanden waarvan de cacheKey in deze run gebruikt wordt.
  try {
    const entries = await fs.readdir(cacheDir).catch(() => []);
    let pruned = 0;

    for (const entry of entries) {
      if (entry === ".gitkeep") continue;
      if (!entry.endsWith(".json")) continue;

      const base = entry.slice(0, -".json".length);
      if (!usedCacheKeys.has(base)) {
        await fs.rm(path.join(cacheDir, entry)).catch(() => null);
        pruned += 1;
      }
    }

    if (pruned > 0) {
      console.log(`[ai] pruned ${pruned} old cache files`);
    }
  } catch (e) {
    console.warn("[ai] pruning failed; continue without failing build");
  }

  return out;
}

