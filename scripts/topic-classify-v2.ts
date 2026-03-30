import type { Story, StoryTopic } from "./types.js";

function normalizeText(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type TopicSignal = { topic: StoryTopic; weight: number; reason: string; re: RegExp };

// Deterministische signalen op basis van regex op titel+tekst+entities.
// Let op: we gebruiken "loos" matchen (zonder harde woordgrenzen) om inflecties te vangen
// (bv. "iraanse" vs "iran").
const SIGNALS: TopicSignal[] = [
  // Spionage / inlichtingen
  { topic: "spionage", weight: 12, reason: "spionage termen", re: /spion|mossad|cia|fsb|gru|mi6|agent/gi },
  { topic: "inlichtingen", weight: 12, reason: "inlichtingen termen", re: /inlichtingen|inlichtingsdienst|aivd|mivd/gi },

  // Cyber
  { topic: "cyberoorlog", weight: 12, reason: "cyber/aanval termen", re: /cyber|hack|ransomware|ddos|malware|phishing|zero[- ]?day/gi },

  // Desinformatie/propaganda/beïnvloeding
  { topic: "desinformatie", weight: 12, reason: "desinformatie termen", re: /desinformatie|misinformatie|fake news/gi },
  { topic: "propaganda", weight: 10, reason: "propaganda/controle termen", re: /propaganda|censorship|media restrictions|onderdrukking/gi },
  { topic: "beïnvloeding", weight: 10, reason: "beïnvloeding termen", re: /beinvloeding|inmenging|troll|botnet|influence/gi },

  // Sancties/handel/conflict-economie
  { topic: "sancties", weight: 12, reason: "sancties/embargo termen", re: /sanctie|sancties|embargo/gi },
  {
    topic: "handelsconflict",
    weight: 12,
    reason: "trade war/tarief termen",
    re: /handelsconflict|tarief|tarieven|importheffing|exportverbod|trade war/gi
  },
  { topic: "economische machtsstrijd", weight: 10, reason: "rivaliteit/economische machtsstrijd", re: /rivaliteit|rival|economische machtsstrijd|economic rivalry|tariefoorlog/gi },

  // Energie/grondstoffen/technologie
  { topic: "energiepolitiek", weight: 12, reason: "energie/Oil/Gas termen", re: /energiepolitiek|energie|olie|gas|lng|opec/gi },
  { topic: "grondstoffen", weight: 10, reason: "grondstoffen/commodities termen", re: /grondstoffen|grondstof|commodit|mining|erts|raw materials/gi },
  { topic: "technologische macht", weight: 10, reason: "tech/chips/exportcontrole termen", re: /technologische macht|chips|semiconductor|exportcontrole|export control/gi },
  { topic: "surveillance", weight: 10, reason: "surveillance termen", re: /surveillance|afsluister|monitoring massaal/gi },

  // Defensie/oorlog/militair
  { topic: "defensie", weight: 12, reason: "defensie/leger termen", re: /defensie|leger|nato|navo|wapen|munitie|drone|military/gi },
  { topic: "militaire strategie", weight: 10, reason: "militaire strategie termen", re: /militaire strategie|frontlinie|luchtmacht|zeemacht|military strategy/gi },

  // Hybride oorlog
  { topic: "hybride oorlog", weight: 12, reason: "hybride oorlog termen", re: /hybride oorlog|hybrid warfare|sabotage|ondermijning/gi },

  // Oorlog/conflict (let op: geopolitiek vs oorlog overlap; we geven oorlog/conflict prioriteit via gewicht)
  { topic: "oorlog", weight: 14, reason: "oorlog/aanval termen", re: /invasie|aanval|oorlog|raket|missile|rocket|ballistic|bombardement|schietpartij/gi },
  { topic: "conflict", weight: 14, reason: "conflict/gevecht termen", re: /conflict|escalatie|gevecht|clash|spanning|insurgency|civil war|terrorism/gi },
  { topic: "diplomatie", weight: 10, reason: "diplomatie/onderhandeling termen", re: /diplomatie|gezant|ambassade|onderhandeling|vredesgesprek|foreign policy/gi },
  { topic: "internationale betrekkingen", weight: 9, reason: "internationale betrekkingen termen", re: /internationale betrekkingen|buitenlandse politiek|international relations/gi },
  { topic: "politieke instabiliteit", weight: 9, reason: "instabiliteit/onrust termen", re: /instabiliteit|staatsgreep|protest|onrust|regime/gi },
  { topic: "machtsverschuiving", weight: 9, reason: "machtspolitiek/machtsverschuiving termen", re: /machtsverschuiving|machtspolitiek|invloedssfeer|power shift/gi },

  // Geopolitiek: landen/regio tokens (loose match voor inflecties)
  {
    topic: "geopolitiek",
    weight: 10,
    reason: "land/regio tokens",
    // Gebruik \b om te beperken dat tokens overal in woorden zitten.
    // (Let op: voor multiword-constructies doen we \s* tussen woorden.)
    re: /\b(houthi|houthis|houthie|jemen|yemen|gaza|hamas|hezbollah|hisbollah|libanon|syrie|irak|iran(?:a|ian)?|israel|oekra(?:i|ein)e|ukraine|china|russia|rusland|verenigde\s*staten|usa|nato|navo|qatar|emiraten|tel\s*aviv|jeruzalem)\b|\bmiddle\s*east\b|\bmidden[- ]oosten\b|\bmidden\s*oosten\b|\bgolfstaat\b/gi
  },
];

export type TopicClassifyResultV2 = {
  topics: StoryTopic[];
  confidence: number;
  // Per toegekende topic: lijst van "why"-redenen (welke signalen/patterns triggerden)
  reasons: Record<string, string[]>;
};

function pickTopTopics(scored: Array<{ topic: StoryTopic; score: number; reasons: string[] }>): TopicClassifyResultV2 {
  // Sort top-down
  scored.sort((a, b) => b.score - a.score);

  const nonOverig = scored.filter((x) => x.topic !== "overig" && x.score > 0);
  const top = nonOverig.slice(0, 7);
  if (top.length === 0) {
    return { topics: ["overig"], confidence: 0.15, reasons: { overig: ["geen sterke signalen"] } };
  }

  const topScore = top[0]?.score ?? 0;
  const secondScore = top[1]?.score ?? 0;
  const confidence = clamp(topScore / (topScore + secondScore + 6), 0.05, 0.95);

  const topics = top.map((t) => t.topic);
  const reasons: Record<string, string[]> = {};
  for (const t of top) reasons[t.topic] = t.reasons;

  return { topics, confidence, reasons };
}

export function classifyTopicsV2(story: Story, opts?: { maxTopics?: number }): TopicClassifyResultV2 {
  const maxTopics = clamp(opts?.maxTopics ?? 7, 1, 7);

  const titleText = normalizeText(story.title ?? "");
  const summaryText = normalizeText(story.summary ?? "");
  const bodyText = normalizeText(
    (story.articles ?? [])
      .slice(0, 6)
      .map((a: any) => `${a.titleNl ?? a.title ?? ""} ${a.summaryNl ?? a.excerpt ?? ""} ${(a.keywords ?? []).join(" ")}`)
      .join(" ")
  );

  const entitiesText = normalizeText(
    (story.articles ?? [])
      .flatMap((a: any) => a.entities ?? [])
      .slice(0, 200)
      .join(" ")
  );

  const combined = `${titleText} ${summaryText} ${bodyText} ${entitiesText}`;

  const scored = new Map<StoryTopic, { topic: StoryTopic; score: number; reasons: string[] }>();

  const get = (topic: StoryTopic) => {
    const cur = scored.get(topic);
    if (cur) return cur;
    const init = { topic, score: 0, reasons: [] as string[] };
    scored.set(topic, init);
    return init;
  };

  for (const sig of SIGNALS) {
    sig.re.lastIndex = 0;
    const matchTitle = sig.re.test(titleText);
    sig.re.lastIndex = 0;
    const matchBody = sig.re.test(`${summaryText} ${bodyText}`);
    sig.re.lastIndex = 0;
    const matchEntities = sig.re.test(entitiesText);
    sig.re.lastIndex = 0;

    const matchedAny = matchTitle || matchBody || matchEntities;
    if (!matchedAny) continue;

    const target = get(sig.topic);
    // Context weighting: titel zwaarder.
    const base = sig.weight;
    const w =
      (matchTitle ? 1.25 : 0) +
      (matchBody ? 1.0 : 0) +
      (matchEntities ? 1.05 : 0);
    const add = base * w;
    target.score += add;
    if (target.reasons.length < 5) target.reasons.push(sig.reason);
  }

  // Zet ook "overig" als fallback score heel laag.
  if (!scored.has("overig")) {
    scored.set("overig", { topic: "overig", score: 1, reasons: ["fallback"] });
  }

  const scoredArr = Array.from(scored.values());
  const picked = pickTopTopics(scoredArr);

  return {
    ...picked,
    topics: picked.topics.slice(0, maxTopics)
  };
}

