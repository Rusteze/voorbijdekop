import type { AiStory, Investigation } from "../types.js";

/**
 * Verwijdert HTML/Markup-achtige ruis uit AI-tekst en decodeert veelvoorkomende entities.
 * Gebruikt na API-parse en bij cache-read zodat stories.json en UI schone platte tekst tonen.
 */
export function stripAiMarkup(input: string): string {
  if (typeof input !== "string") return "";
  let t = input;
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");
  t = t.replace(/<\/li>\s*<li[^>]*>/gi, "\n• ");
  t = t.replace(/<\/(p|div|h[1-6]|section|article)>/gi, "\n\n");
  t = t.replace(/<li[^>]*>/gi, "• ");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/gi, " ");
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    const code = parseInt(h, 16);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
  });
  t = t.replace(/&#(\d+);/g, (_, n) => {
    const code = parseInt(n, 10);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
  });
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    ndash: "–",
    mdash: "—",
    hellip: "…",
  };
  t = t.replace(/&([a-zA-Z]+);/g, (m, name) => named[name.toLowerCase()] ?? m);
  return t
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function sanitizeInvestigation(inv: Investigation): Investigation {
  const strip = stripAiMarkup;
  const tools = (inv.tools ?? []).map((tool) => {
    if (typeof tool === "string") return strip(tool);
    return {
      label: strip(tool.label),
      ...(tool.url != null && String(tool.url).trim() !== ""
        ? { url: String(tool.url).replace(/&amp;/g, "&").trim() }
        : {}),
    };
  });
  return {
    ...inv,
    title: strip(inv.title),
    what: strip(inv.what),
    why: strip(inv.why),
    steps: (inv.steps ?? []).map(strip),
    tools,
    resourceLinks: (inv.resourceLinks ?? []).map((r) => ({
      label: strip(r.label),
      url: String(r.url ?? "").replace(/&amp;/g, "&").trim(),
      ...(r.note != null && r.note.trim() !== "" ? { note: strip(r.note) } : {}),
    })),
  };
}

export function sanitizeAiStory(ai: AiStory): AiStory {
  const strip = stripAiMarkup;
  return {
    ...ai,
    summary: strip(ai.summary),
    narrative: strip(ai.narrative),
    facts: (ai.facts ?? []).map(strip),
    interpretations: (ai.interpretations ?? []).map(strip),
    unknowns: (ai.unknowns ?? []).map(strip),
    comparisons: (ai.comparisons ?? []).map(strip),
    questions: (ai.questions ?? []).map(strip),
    investigations: (ai.investigations ?? []).map(sanitizeInvestigation),
    claims: (ai.claims ?? []).map((c) => ({
      ...c,
      claim: strip(c.claim),
      verification: strip(c.verification),
      confidence: c.confidence,
    })),
  };
}
