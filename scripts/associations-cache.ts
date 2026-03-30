import fs from "node:fs/promises";
import path from "node:path";

export type AssocCategory = "general" | "fun";

export type AssocEntry = {
  word: string;
  category: AssocCategory;
  associations: string[]; // ranked, length>=4 ideally
  source: "conceptnet" | "manual" | "swow";
  updatedAt: string; // ISO
};

export type AssociationsCacheFile = {
  updatedAt: string;
  entries: AssocEntry[];
};

type WordPoolEntry = { word: string; category: AssocCategory; associations?: string[] };

function uniqueNonEmpty(arr: string[]): string[] {
  return Array.from(new Set(arr.map((x) => String(x).trim()).filter(Boolean)));
}

function isCleanToken(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.length < 2 || t.length > 32) return false;
  if (/\d/.test(t)) return false;
  if (/[^\p{L}\p{M}\s-]/u.test(t)) return false;
  return true;
}

function toDisplayWord(token: string): string {
  const t = token.trim();
  if (!t) return t;
  return t
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (e: any) {
    if (e?.code === "ENOENT") return fallback;
    throw e;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function readAssociationsCache(repoRoot: string): Promise<AssociationsCacheFile> {
  const filePath = path.join(repoRoot, "data", "associations-cache.json");
  const fallback: AssociationsCacheFile = { updatedAt: "", entries: [] };
  const parsed = await readJson<AssociationsCacheFile>(filePath, fallback);
  return {
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    entries: Array.isArray(parsed.entries) ? parsed.entries : []
  };
}

async function readWordPool(repoRoot: string): Promise<WordPoolEntry[]> {
  const filePath = path.join(repoRoot, "data", "wordPool.json");
  const rawText = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(rawText) as unknown;
  if (!Array.isArray(parsed)) throw new Error("wordPool.json moet een array zijn");
  return parsed as WordPoolEntry[];
}

type ConceptNetEdge = {
  rel?: { label?: string; "@id"?: string };
  weight?: number;
  start?: { language?: string; label?: string; term?: string };
  end?: { language?: string; label?: string; term?: string };
};

async function fetchConceptNetAssociationsNl(word: string, limit = 50): Promise<string[]> {
  const term = encodeURIComponent(word.trim().toLowerCase());
  // Node lookup; filter naar relevante relaties voor “associaties”.
  const rels = ["/r/RelatedTo", "/r/Synonym", "/r/Antonym", "/r/IsA", "/r/PartOf", "/r/HasA"];
  const candidates: Array<{ label: string; score: number }> = [];

  // We doen een paar calls met rel-filter; klein en voorspelbaar.
  for (const rel of rels) {
    const url = `https://api.conceptnet.io/c/nl/${term}?rel=${encodeURIComponent(rel)}&limit=${limit}`;
    const res = await fetch(url, { headers: { accept: "application/ld+json, application/json" } });
    if (!res.ok) continue;
    const data = (await res.json()) as { edges?: ConceptNetEdge[] };
    const edges = Array.isArray(data.edges) ? data.edges : [];
    for (const e of edges) {
      const w = typeof e.weight === "number" ? e.weight : 1;
      const relLabel = e.rel?.label ?? "";
      const a = e.start?.language === "nl" ? e.start?.label : null;
      const b = e.end?.language === "nl" ? e.end?.label : null;
      const other = (a && a.toLowerCase() !== word.toLowerCase() ? a : null) ?? (b && b.toLowerCase() !== word.toLowerCase() ? b : null);
      if (!other) continue;
      const label = toDisplayWord(other);
      if (!isCleanToken(label)) continue;
      // Antonymen zijn ook interessant, maar iets minder “voor de hand liggend”.
      const relBonus = relLabel === "Synonym" ? 2 : relLabel === "RelatedTo" ? 1.5 : relLabel === "Antonym" ? 0.8 : 1;
      candidates.push({ label, score: w * relBonus });
    }
  }

  // Rank + dedupe
  const byLabel = new Map<string, number>();
  for (const c of candidates) byLabel.set(c.label, Math.max(byLabel.get(c.label) ?? 0, c.score));
  return [...byLabel.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}

export async function updateAssociationsCache(
  repoRoot: string,
  opts?: { maxNewWords?: number; fetchBudget?: number; enableConceptNet?: boolean }
): Promise<{ updated: boolean; added: number; updatedCount: number }> {
  const filePath = path.join(repoRoot, "data", "associations-cache.json");
  const nowIso = new Date().toISOString();
  const maxNewWords = opts?.maxNewWords ?? 20;
  const fetchBudget = opts?.fetchBudget ?? 30;
  const enableConceptNet = opts?.enableConceptNet === true;

  const wordPool = await readWordPool(repoRoot);
  const cache = await readAssociationsCache(repoRoot);
  const existing = new Map(cache.entries.map((e) => [e.word, e]));

  // Seed: neem alle wordPool entries (manual) op in cache (altijd veilig).
  let updatedCount = 0;
  for (const w of wordPool) {
    const assoc = uniqueNonEmpty(w.associations ?? []).slice(0, 8);
    if (assoc.length < 4) continue;
    const prev = existing.get(w.word);
    const next: AssocEntry = {
      word: w.word,
      category: w.category,
      associations: assoc,
      source: "manual",
      updatedAt: nowIso
    };
    if (!prev) {
      existing.set(w.word, next);
      updatedCount++;
    } else if (prev.source !== "manual" || JSON.stringify(prev.associations) !== JSON.stringify(next.associations)) {
      existing.set(w.word, next);
      updatedCount++;
    }
  }

  let added = 0;

  // Optioneel: expand met ConceptNet.
  if (enableConceptNet) {
    // Deterministisch: sorteer seeds op woord.
    const seedWords = [...new Set(wordPool.map((w) => w.word))].sort((a, b) => a.localeCompare(b, "nl"));
    const newWords: Array<{ word: string; category: AssocCategory }> = [];

    let fetches = 0;
    for (const seed of seedWords) {
      if (newWords.length >= maxNewWords) break;
      if (fetches >= fetchBudget) break;
      const seedEntry = wordPool.find((w) => w.word === seed);
      if (!seedEntry) continue;

      try {
        fetches++;
        const rel = await fetchConceptNetAssociationsNl(seed, 30);
        // Neem de top gerelateerde termen als potentiële nieuwe quiz-woorden.
        for (const cand of rel.slice(0, 12)) {
          if (newWords.length >= maxNewWords) break;
          if (!isCleanToken(cand)) continue;
          if (existing.has(cand)) continue;
          newWords.push({ word: cand, category: seedEntry.category });
        }
      } catch {
        // ignore
      }
    }

    // Voor nieuwe woorden: probeer meteen associaties te vullen via ConceptNet.
    for (const nw of newWords) {
      if (fetches >= fetchBudget) break;
      try {
        fetches++;
        const assoc = uniqueNonEmpty(await fetchConceptNetAssociationsNl(nw.word, 50)).slice(0, 12);
        if (assoc.length < 4) continue;
        existing.set(nw.word, {
          word: nw.word,
          category: nw.category,
          associations: assoc,
          source: "conceptnet",
          updatedAt: nowIso
        });
        added++;
      } catch {
        // ignore
      }
    }
  }

  const nextEntries = [...existing.values()].sort((a, b) => a.word.localeCompare(b.word, "nl"));
  const next: AssociationsCacheFile = { updatedAt: nowIso, entries: nextEntries };

  // Schrijf altijd (klein bestand).
  await writeJson(filePath, next);
  const updated = true;

  return { updated, added, updatedCount };
}

function detectDelimiter(line: string): "," | ";" | "\t" {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

function splitRow(line: string, delimiter: string): string[] {
  // Simpele parser voor CSV/TSV zonder complexe quotes (voldoende voor SWOW-exporten met simpele velden).
  return line.split(delimiter).map((x) => x.trim().replace(/^"(.*)"$/, "$1"));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function importSwowToAssociationsCache(
  repoRoot: string,
  sourceFilePath: string
): Promise<{ importedWords: number; mergedWords: number }> {
  const nowIso = new Date().toISOString();
  const raw = await fs.readFile(sourceFilePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("SWOW-bestand heeft te weinig regels");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitRow(lines[0], delimiter).map(normalizeHeader);
  const idxCue = headers.findIndex((h) => ["cue", "stimulus", "word", "target"].includes(h));
  const idxResp = headers.findIndex((h) => ["response", "association", "associate", "answer"].includes(h));
  const idxCount = headers.findIndex((h) => ["count", "freq", "frequency", "n"].includes(h));

  if (idxCue < 0 || idxResp < 0) {
    throw new Error("SWOW-bestand mist verplichte kolommen: cue + response");
  }

  const scores = new Map<string, Map<string, number>>();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i], delimiter);
    const cueRaw = cols[idxCue] ?? "";
    const respRaw = cols[idxResp] ?? "";
    const cue = toDisplayWord(cueRaw);
    const resp = toDisplayWord(respRaw);
    if (!isCleanToken(cue) || !isCleanToken(resp)) continue;
    if (cue.toLowerCase() === resp.toLowerCase()) continue;
    const count = idxCount >= 0 ? Math.max(1, parseInt(cols[idxCount] ?? "1", 10) || 1) : 1;
    const m = scores.get(cue) ?? new Map<string, number>();
    m.set(resp, (m.get(resp) ?? 0) + count);
    scores.set(cue, m);
  }

  const wordPool = await readWordPool(repoRoot);
  const categoryByWord = new Map(wordPool.map((w) => [w.word.toLowerCase(), w.category]));

  const imported: AssocEntry[] = [];
  for (const [cue, respMap] of scores.entries()) {
    const ranked = [...respMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"))
      .map(([w]) => w)
      .slice(0, 12);
    if (ranked.length < 4) continue;
    imported.push({
      word: cue,
      category: categoryByWord.get(cue.toLowerCase()) ?? "general",
      associations: ranked,
      source: "swow",
      updatedAt: nowIso
    });
  }

  const cache = await readAssociationsCache(repoRoot);
  const byWord = new Map(cache.entries.map((e) => [e.word, e]));
  let mergedWords = 0;
  for (const e of imported) {
    byWord.set(e.word, e);
    mergedWords++;
  }

  // Manual wordPool blijft leidend als expliciete override.
  for (const w of wordPool) {
    const assoc = uniqueNonEmpty(w.associations ?? []).slice(0, 8);
    if (assoc.length < 4) continue;
    byWord.set(w.word, {
      word: w.word,
      category: w.category,
      associations: assoc,
      source: "manual",
      updatedAt: nowIso
    });
  }

  const next: AssociationsCacheFile = {
    updatedAt: nowIso,
    entries: [...byWord.values()].sort((a, b) => a.word.localeCompare(b.word, "nl"))
  };
  const cachePath = path.join(repoRoot, "data", "associations-cache.json");
  await writeJson(cachePath, next);

  return { importedWords: imported.length, mergedWords };
}

