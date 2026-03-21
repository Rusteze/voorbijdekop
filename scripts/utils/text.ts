export function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function stripHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, "").trim();
}

export function tokenizeNlLike(input: string) {
  const s = input
    .toLowerCase()
    .replace(/[“”„"']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ");
  const parts = s.split(/\s+/).filter(Boolean);
  const stop = new Set([
    "de",
    "het",
    "een",
    "en",
    "of",
    "in",
    "op",
    "van",
    "voor",
    "met",
    "naar",
    "door",
    "bij",
    "over",
    "is",
    "zijn",
    "wordt",
    "werd",
    "als",
    "dat",
    "dit",
    "die",
    "aan",
    "om",
    "te",
    "uit"
  ]);
  return parts.filter((t) => t.length >= 3 && !stop.has(t));
}

const ENTITY_SEEDS = [
  // Landen/regio's (NL + veelvoorkomende varianten)
  "Rusland",
  "Oekraïne",
  "Wit-Rusland",
  "Belarus",
  "Polen",
  "Duitsland",
  "Frankrijk",
  "Verenigd Koninkrijk",
  "Brits",
  "VS",
  "Verenigde Staten",
  "United States",
  "Amerika",
  "China",
  "Taiwan",
  "Japan",
  "Noord-Korea",
  "Zuid-Korea",
  "Israël",
  "Palestina",
  "Gaza",
  "Westelijke Jordaanoever",
  "Iran",
  "Irak",
  "Syrië",
  "Libanon",
  "Jemen",
  "Turkije",
  "Saoedi-Arabië",
  "Qatar",
  "VAE",
  "Verenigde Arabische Emiraten",
  "Egypte",
  "Soedan",
  "Ethiopië",
  "Mali",
  "Niger",
  "Nigeria",
  "Congo",
  "Rwanda",
  "Zuid-Afrika",
  "India",
  "Pakistan",
  "Afghanistan",
  "Armenië",
  "Azerbeidzjan",
  "Georgië",
  "Servië",
  "Kosovo",
  "Nederland",
  "België",
  "Brussel",
  "Amsterdam",

  // Organisaties/allianties
  "EU",
  "Europa",
  "NAVO",
  "NATO",
  "VN",
  "Verenigde Naties",
  "UN",
  "G7",
  "G20",
  "OPEC",
  "WHO",
  "IAEA",
  "IMF",
  "Wereldbank",
  "ECB",
  "Europese Commissie",
  "Europees Parlement"
];

export function extractEntities(title: string, excerpt: string) {
  const text = `${title} ${excerpt}`;
  const found = new Set<string>();

  // Seed matching (case-insensitive, woordgrenzen)
  for (const e of ENTITY_SEEDS) {
    const rx = new RegExp(`\\b${escapeRegExp(e)}\\b`, "i");
    if (rx.test(text)) found.add(e);
  }

  // Veelvoorkomende acroniemen (EU, VN/UN, NAVO/NATO, IAEA, IMF, ...).
  // Beperkt om ruis te verminderen; we filteren korte/te generieke matches.
  for (const m of text.matchAll(/\b([A-Z]{2,6})\b/g)) {
    const acr = m[1];
    if (acr === "IN" || acr === "ON" || acr === "OF") continue;
    found.add(acr);
  }

  // Simpele capitalized sequences (ENG/NL namen), beperkt om ruis te verminderen
  // bv. "Vladimir Poetin", "Europese Commissie"
  for (const m of text.matchAll(/\b([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+){0,2})\b/gu)) {
    const candidate = m[1];
    if (candidate.length < 4) continue;
    if (/^(De|Het|Een|Dit|Dat|Deze|Die)$/.test(candidate)) continue;
    // vermijd al te generieke woorden
    if (candidate.split(/\s+/).length === 1 && candidate.length <= 5) continue;
    found.add(candidate);
  }

  // Normaliseer een paar veelvoorkomende aliassen zodat overlap beter werkt.
  const normalized = new Set<string>();
  for (const e of found) {
    const t = e.trim();
    if (!t) continue;
    if (/^(VS|United States|Amerika)$/i.test(t)) normalized.add("Verenigde Staten");
    else if (/^(VN|UN)$/i.test(t)) normalized.add("Verenigde Naties");
    else if (/^(NAVO|NATO)$/i.test(t)) normalized.add("NAVO");
    else if (/^VAE$/i.test(t)) normalized.add("Verenigde Arabische Emiraten");
    else normalized.add(t);
  }

  return [...normalized].slice(0, 24);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

