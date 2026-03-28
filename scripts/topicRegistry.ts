/**
 * Eén bron van waarheid voor story-topics (matcht scripts/types.ts StoryTopic).
 * Aliassen vangen veelvoorkomende AI-/Engelse varianten af → minder gedwongen "overig".
 */

export const CANONICAL_STORY_TOPICS = [
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
] as const;

const CANONICAL_SET = new Set<string>(CANONICAL_STORY_TOPICS);

/** NL-labels voor filters en UI (ook topics die eerder ontbraken in de header). */
export const TOPIC_DISPLAY_NL: Record<(typeof CANONICAL_STORY_TOPICS)[number], string> = {
  geopolitiek: "Geopolitiek",
  conflict: "Conflict",
  oorlog: "Oorlog",
  spionage: "Spionage",
  inlichtingen: "Inlichtingen",
  diplomatie: "Diplomatie",
  "internationale betrekkingen": "Internationale betrekkingen",
  sancties: "Sancties",
  handelsconflict: "Handelsconflict",
  energiepolitiek: "Energiepolitiek",
  grondstoffen: "Grondstoffen",
  "economische machtsstrijd": "Economische machtsstrijd",
  defensie: "Defensie",
  "militaire strategie": "Militaire strategie",
  cyberoorlog: "Cyberoorlog",
  "hybride oorlog": "Hybride oorlog",
  propaganda: "Propaganda",
  desinformatie: "Desinformatie",
  beïnvloeding: "Beïnvloeding",
  "technologische macht": "Technologische macht",
  surveillance: "Surveillance",
  "politieke instabiliteit": "Politieke instabiliteit",
  machtsverschuiving: "Machtsverschuiving",
  overig: "Overig"
};

const topicsWithoutOverig = CANONICAL_STORY_TOPICS.filter((t) => t !== "overig");

/** Rij voor topic-chips: eerst "Alle", dan "Overig", daarna overige topics in vaste volgorde. */
export const TOPIC_NAV_CHIPS: Array<[string, string]> = [
  ["alle", "Alle"],
  ["overig", TOPIC_DISPLAY_NL.overig],
  ...topicsWithoutOverig.map((t) => [t, TOPIC_DISPLAY_NL[t]] as [string, string])
];

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Zonder diakriten, voor losse typfouten / alternatieve spelling. */
function foldKey(s: string): string {
  return normalizeKey(s.normalize("NFD").replace(/\p{M}/gu, ""));
}

/**
 * Keys: genormaliseerd (lowercase, enkele spaties).
 * Waarden: altijd een CANONICAL_STORY_TOPICS id.
 */
const TOPIC_ALIASES: Record<string, (typeof CANONICAL_STORY_TOPICS)[number]> = {
  // Engels ↔ canoniek
  geopolitics: "geopolitiek",
  "global politics": "geopolitiek",
  war: "oorlog",
  warfare: "oorlog",
  invasion: "oorlog",
  espionage: "spionage",
  intelligence: "inlichtingen",
  "intelligence services": "inlichtingen",
  diplomacy: "diplomatie",
  diplomatic: "diplomatie",
  "international relations": "internationale betrekkingen",
  "foreign policy": "internationale betrekkingen",
  ir: "internationale betrekkingen",
  sanctions: "sancties",
  embargo: "sancties",
  "trade war": "handelsconflict",
  tariffs: "handelsconflict",
  "trade conflict": "handelsconflict",
  energy: "energiepolitiek",
  "energy policy": "energiepolitiek",
  oil: "energiepolitiek",
  gas: "energiepolitiek",
  lng: "energiepolitiek",
  commodities: "grondstoffen",
  "raw materials": "grondstoffen",
  mining: "grondstoffen",
  "economic rivalry": "economische machtsstrijd",
  "economic competition": "economische machtsstrijd",
  "power competition": "economische machtsstrijd",
  defense: "defensie",
  defence: "defensie",
  military: "defensie",
  "military strategy": "militaire strategie",
  nato: "defensie",
  navo: "defensie",
  cybersecurity: "cyberoorlog",
  "cyber security": "cyberoorlog",
  "cyber warfare": "cyberoorlog",
  hacking: "cyberoorlog",
  ransomware: "cyberoorlog",
  "hybrid warfare": "hybride oorlog",
  "hybrid war": "hybride oorlog",
  disinformation: "desinformatie",
  misinformation: "desinformatie",
  "fake news": "desinformatie",
  propaganda: "propaganda",
  influence: "beïnvloeding",
  "information warfare": "beïnvloeding",
  "technological power": "technologische macht",
  "tech policy": "technologische macht",
  "mass surveillance": "surveillance",
  monitoring: "surveillance",
  instability: "politieke instabiliteit",
  unrest: "politieke instabiliteit",
  "power shift": "machtsverschuiving",
  misc: "overig",
  miscellaneous: "overig",
  general: "overig",
  other: "overig",
  // Synoniemen / varianten die modellen vaak teruggeven
  conflicts: "conflict",
  wars: "oorlog",
  spy: "spionage",
  spies: "spionage",
  sanction: "sancties",
  cyber: "cyberoorlog",
  hybrid: "hybride oorlog",
  disinfo: "desinformatie",
  tech: "technologische macht"
};

export function resolveTopicFromAi(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "overig";

  const key = normalizeKey(raw);
  if (CANONICAL_SET.has(key)) return key;

  const folded = foldKey(raw);
  if (CANONICAL_SET.has(folded)) return folded;

  const alias = TOPIC_ALIASES[key] ?? TOPIC_ALIASES[folded];
  if (alias) return alias;

  return "overig";
}

export function getTopicDisplayLabel(topicId: string | null | undefined): string {
  const t = topicId ?? "overig";
  return TOPIC_DISPLAY_NL[t as keyof typeof TOPIC_DISPLAY_NL] ?? TOPIC_DISPLAY_NL.overig;
}
