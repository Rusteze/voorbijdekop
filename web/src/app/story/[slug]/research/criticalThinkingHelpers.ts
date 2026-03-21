import type { InvestigationSlide } from "./types";

const DEFAULT_QUESTIONS = [
  "Welke bron noemt concrete cijfers — en welke niet?",
  "Wordt dezelfde gebeurtenis anders benoemd?",
  "Welke informatie ontbreekt volledig?",
];

export const DEFAULT_WHY_TEXT =
  "Als je deze vragen beantwoordt — ook alleen in je hoofd — zie je sneller tegenstrijdigheden, gaten en framing. Zo lees je niet alleen mee, maar begrijp je wat het verhaal wél en níét hard maakt.";

function toolLabel(t: string | { label?: string }): string {
  if (typeof t === "string") return t.replace(/\s+/g, " ").trim();
  return String(t.label ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateToLines(text: string, maxChars = 320): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const last = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "), cut.lastIndexOf(","));
  const base = last > 120 ? cut.slice(0, last + 1) : cut;
  return `${base.trim()}…`;
}

/** 3–5 korte richtingen: tools + stappen, dedupliceerd. */
export function buildInvestigationSuggestions(invs: (InvestigationSlide | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (s: string) => {
    const L = s.replace(/\s+/g, " ").trim();
    if (!L || seen.has(L)) return;
    seen.add(L);
    out.push(L);
  };

  for (const inv of invs) {
    if (!inv) continue;
    for (const t of inv.tools ?? []) push(toolLabel(t));
    if (out.length >= 8) break;
  }
  for (const inv of invs) {
    if (!inv) continue;
    for (const s of inv.steps ?? []) push(s);
    if (out.length >= 8) break;
  }

  return out.slice(0, 5);
}

/** Waarom-tekst uit investigations; max ~2–3 regels. */
export function buildWhyParagraph(invs: (InvestigationSlide | null | undefined)[]): string {
  const parts = invs
    .filter(Boolean)
    .map((i) => (i as InvestigationSlide).why.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_WHY_TEXT;
  return truncateToLines(parts.join(" "), 360);
}

export function resolveCriticalQuestions(raw: string[]): string[] {
  const cleaned = raw.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean);
  const take = cleaned.slice(0, 5);
  if (take.length >= 3) return take;
  const merged = [...take];
  for (const d of DEFAULT_QUESTIONS) {
    if (merged.length >= 5) break;
    if (!merged.includes(d)) merged.push(d);
  }
  return merged.slice(0, 5);
}
