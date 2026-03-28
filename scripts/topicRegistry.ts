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
  tech: "technologische macht",
  // Veelvoorkomende model-output die anders naar overig valt
  "middle east": "geopolitiek",
  "midden-oosten": "geopolitiek",
  "midden oosten": "geopolitiek",
  "regional conflict": "conflict",
  "armed conflict": "oorlog",
  "military conflict": "conflict",
  "security situation": "geopolitiek",
  "international security": "geopolitiek",
  yemen: "conflict",
  jemen: "conflict",
  houthi: "conflict",
  houthis: "conflict",
  israel: "geopolitiek",
  palestine: "geopolitiek",
  gaza: "conflict",
  hamas: "conflict",
  hezbollah: "conflict",
  iran: "geopolitiek",
  syria: "geopolitiek",
  lebanon: "geopolitiek",
  ukraine: "geopolitiek",
  oekraine: "geopolitiek",
  missile: "oorlog",
  missiles: "oorlog",
  rocket: "oorlog",
  rockets: "oorlog",
  airstrike: "oorlog",
  "air strike": "oorlog",
  terrorism: "conflict",
  terrorist: "conflict",
  insurgency: "conflict",
  "civil war": "oorlog",
  "state violence": "conflict",
  censorship: "propaganda",
  "media restrictions": "propaganda"
};

/**
 * Heuristiek op titel + samenvatting + brontekst (+ eventueel narrative) als AI "overig" teruggeeft
 * of onbekende labels. Gebruikt genormaliseerde kleine letters zonder diakriten voor robuustere match.
 */
export function inferTopicFromText(raw: string): string {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const has = (re: RegExp) => re.test(text);

  if (has(/\b(spionage|spion|agent|mossad|cia|fsb|gru|mi6)\b/)) return "spionage";
  if (has(/\b(inlichtingen|inlichtingsdienst|aivd|mivd)\b/)) return "inlichtingen";
  if (has(/\b(cyber|hack|ransomware|ddos|malware|phishing|zero[- ]?day)\b/)) return "cyberoorlog";
  if (has(/\b(desinformatie|misinformatie)\b/)) return "desinformatie";
  if (has(/\bpropaganda\b/)) return "propaganda";
  if (has(/\b(beinvloeding|inmenging|troll|botnet|influence)\b/)) return "beïnvloeding";
  if (has(/\b(sanctie|sancties|embargo)\b/)) return "sancties";
  if (has(/\b(handelsconflict|tarief|importheffing|exportverbod|trade war)\b/)) return "handelsconflict";
  if (has(/\b(energie|gas|olie|lng|pijplijn|opec)\b/)) return "energiepolitiek";
  if (has(/\b(grondstof|grondstoffen|commodit|mining|erts)\b/)) return "grondstoffen";
  if (has(/\b(economische machtsstrijd|rivaliteit|tariefoorlog)\b/)) return "economische machtsstrijd";

  // Midden-Oosten / regionale actoren (vóór brede defensie-match)
  if (
    has(
      /\b(houthi|houthis|houthie|jemen|yemen|jemenitis|gaza|hamas|hezbollah|hisbollah|libanon|syrie|irak|iran|israel|palestin|west[- ]?bank|midden[- ]oosten|middle east|golfstaat|golflanden|saoe?di|qatar|emiraten|jeruzalem|tel aviv)\b/
    )
  ) {
    if (has(/\b(raket|missile|rocket|ballistic|raketaanval|luchtaanval|bombardement|vuurgevecht|invasie|oorlog)\b/))
      return "oorlog";
    if (has(/\b(conflict|escalatie|gevecht|clash| spanning)\b/)) return "conflict";
    return "geopolitiek";
  }

  if (has(/\b(defensie|leger|nato|navo|wapen|wapenlevering|munitie|drone|navo)\b/)) return "defensie";
  if (has(/\b(militaire strategie|grondoffensief|frontlinie|luchtmacht|zeemacht)\b/)) return "militaire strategie";
  if (has(/\b(hybride oorlog|sabotage|ondermijning|hybrid warfare)\b/)) return "hybride oorlog";
  // Samengestelde woorden: "raket" in raketaanval/raketten
  if (has(/\b(raketaanval|raketten|ballistic|missiel|missiles?|rockets?|luchtaanval|bombardement)\b/)) return "oorlog";
  if (has(/\b(oorlog|invasie|aanval|schietpartij)\b/)) return "oorlog";
  if (has(/\b(conflict|gevecht|clash|escalatie)\b/)) return "conflict";
  if (has(/\b(diplomatie|gezant|ambassade|topoverleg|onderhandeling|vredesgesprek)\b/)) return "diplomatie";
  if (has(/\b(internationale betrekkingen|buitenlandse politiek|foreign policy)\b/)) return "internationale betrekkingen";
  if (has(/\b(instabiliteit|staatsgreep|protest|onrust|regime)\b/)) return "politieke instabiliteit";
  if (has(/\b(machtsverschuiving|machtspolitiek|invloedssfeer)\b/)) return "machtsverschuiving";
  if (has(/\b(technologische macht|chips|semiconductor|exportcontrole tech)\b/)) return "technologische macht";
  if (has(/\b(surveillance|afsluister|monitoring massaal)\b/)) return "surveillance";

  if (has(/\b(rusland|oekraine|china|iran|israel|isra[e]l|eu|navo|verenigde staten|washington|brussel|moskou|peking)\b/))
    return "geopolitiek";

  return "overig";
}

/** Eerst AI-label normaliseren; alleen bij 'overig' de tekst-heuristiek toepassen. */
export function resolveTopicWithTextFallback(aiTopic: unknown, combinedText: string): string {
  const fromAi = resolveTopicFromAi(aiTopic);
  if (fromAi !== "overig") return fromAi;
  return inferTopicFromText(combinedText);
}

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
