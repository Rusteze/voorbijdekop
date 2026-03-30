import fs from "node:fs/promises";
import path from "node:path";
import type { Story } from "./types.js";

export type DailyQuizQuestion = {
  word: string;
  options: string[];
  correctOption: string;
};

export type DailyQuizPayload = {
  date: string; // YYYY-MM-DD (Amsterdam)
  questions: DailyQuizQuestion[]; // altijd 4
  generatedAt: string;
};

function toAmsterdamDayString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

function fnv1a(str: string): number {
  // FNV-1a 32-bit (deterministisch)
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const a = [...arr];
  const rand = mulberry32(fnv1a(seedStr));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

type QuizHistory = { entries: Array<{ date: string; words: string[] }> };

async function readQuizHistory(repoRoot: string): Promise<QuizHistory> {
  const filePath = path.join(repoRoot, "data", "quiz-history.json");
  try {
    const rawText = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(rawText) as unknown;
    if (!parsed || typeof parsed !== "object") return { entries: [] };
    const entries = (parsed as any).entries;
    return { entries: Array.isArray(entries) ? entries : [] };
  } catch (e: any) {
    if (e?.code === "ENOENT") return { entries: [] };
    throw e;
  }
}

async function writeQuizHistory(repoRoot: string, history: QuizHistory): Promise<void> {
  const filePath = path.join(repoRoot, "data", "quiz-history.json");
  await fs.writeFile(filePath, JSON.stringify(history, null, 2), "utf8");
}

function uniqueNonEmpty(arr: string[]): string[] {
  return Array.from(new Set(arr.map((x) => String(x).trim()).filter(Boolean)));
}

function detectDelimiter(line: string): "," | ";" | "\t" {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

function splitRow(line: string, delimiter: string): string[] {
  // Simpele parser voor CSV/TSV met eenvoudige quotes.
  return line.split(delimiter).map((x) => x.trim().replace(/^"(.*)"$/, "$1"));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

type SwowCue = { word: string; optionsRanked: string[] }; // optionsRanked[0] = correct

async function readQuizBlocklist(repoRoot: string): Promise<string[]> {
  const p = path.join(repoRoot, "data", "quiz-blocklist.txt");
  try {
    const raw = await fs.readFile(p, "utf8");
    return raw
      .split(/\r?\n/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x && !x.startsWith("#"));
  } catch (e: any) {
    if (e?.code === "ENOENT") return [];
    throw e;
  }
}

function isBlocked(text: string, blocklist: string[]): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return blocklist.some((b) => t.includes(b));
}

async function readSwowCues(repoRoot: string): Promise<SwowCue[]> {
  const candidates = [
    path.join(repoRoot, "data", "swow-nl.csv"),
    path.join(repoRoot, "data", "swow-nl.template.csv")
  ];
  let filePath: string | null = null;
  for (const p of candidates) {
    try {
      await fs.access(p);
      filePath = p;
      break;
    } catch {
      // continue
    }
  }
  if (!filePath) {
    throw new Error("Geen SWOW CSV gevonden. Verwacht data/swow-nl.csv of data/swow-nl.template.csv");
  }

  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitRow(lines[0], delimiter).map(normalizeHeader);
  const idxCue = headers.findIndex((h) => ["cue", "stimulus", "word", "target"].includes(h));
  const idxResp = headers.findIndex((h) => ["response", "association", "associate", "answer"].includes(h));
  const idxCount = headers.findIndex((h) => ["count", "freq", "frequency", "n"].includes(h));
  if (idxCue < 0 || idxResp < 0) {
    throw new Error("SWOW CSV mist verplichte kolommen: cue + response");
  }

  const blocklist = await readQuizBlocklist(repoRoot);
  const scores = new Map<string, Map<string, number>>();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i], delimiter);
    const cue = toDisplayWord(cols[idxCue] ?? "");
    const resp = toDisplayWord(cols[idxResp] ?? "");
    if (!cue || !resp) continue;
    if (isBlocked(cue, blocklist) || isBlocked(resp, blocklist)) continue;
    if (cue.toLowerCase() === resp.toLowerCase()) continue;
    const count = idxCount >= 0 ? Math.max(1, parseInt(cols[idxCount] ?? "1", 10) || 1) : 1;
    const m = scores.get(cue) ?? new Map<string, number>();
    m.set(resp, (m.get(resp) ?? 0) + count);
    scores.set(cue, m);
  }

  const cues: SwowCue[] = [];
  for (const [cue, respMap] of scores.entries()) {
    const ranked = [...respMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"))
      .map(([w]) => w);
    const uniq = uniqueNonEmpty(ranked);
    if (uniq.length < 4) continue;
    cues.push({ word: cue, optionsRanked: uniq.slice(0, 12) });
  }

  // Stabiele volgorde voor deterministische picking
  cues.sort((a, b) => a.word.localeCompare(b.word, "nl"));
  return cues;
}

export async function generateDailyQuiz(
  _stories: Story[],
  generatedAt: string,
  opts?: { repoRoot?: string }
): Promise<DailyQuizPayload | null> {
  const repoRoot = opts?.repoRoot ?? path.resolve(".");

  const date = toAmsterdamDayString(new Date(generatedAt));
  const swowCues = await readSwowCues(repoRoot);
  if (swowCues.length < 4) {
    console.warn("[daily-quiz] overgeslagen: SWOW heeft minder dan 4 cues met >=4 associaties");
    return null;
  }

  const history = await readQuizHistory(repoRoot);
  // “Geen reuse in last 30 dagen” (best-effort): we vermijden woorden uit dezelfde pool.
  const usedInLast30Days = (() => {
    const cutoff = new Date(date + "T00:00:00.000Z");
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const cutoffMs = cutoff.getTime();
    const used = new Set<string>();
    for (const e of history.entries ?? []) {
      if (!e?.date || !Array.isArray(e.words)) continue;
      const ms = new Date(e.date + "T00:00:00.000Z").getTime();
      if (Number.isFinite(ms) && ms >= cutoffMs) for (const w of e.words) used.add(String(w));
    }
    return used;
  })();

  // Selecteer 4 cues (deterministisch, liefst niet herhalen).
  const seedBase = date + ":swow";
  const pool = swowCues.map((c) => c.word);
  const preferred = pool.filter((w) => !usedInLast30Days.has(w));
  const pickedWords = (preferred.length ? preferred : pool);
  const selected = seededShuffle(pickedWords, seedBase + ":pick").slice(0, 4);

  const cueByWord = new Map(swowCues.map((c) => [c.word, c]));
  const questions: DailyQuizQuestion[] = selected.map((word) => {
    const cue = cueByWord.get(word)!;
    const ranked = cue.optionsRanked;
    const correctOption = ranked[0];
    const optionPool = uniqueNonEmpty(ranked).slice(0, 8);
    const options = seededShuffle(optionPool.slice(0, 4), `${seedBase}:${word}:ui`);
    // Zorg dat correct altijd in de 4 zit.
    if (!options.includes(correctOption)) {
      options[0] = correctOption;
    }
    return { word, options, correctOption };
  });

  // Zorg dat we altijd precies 4 vragen hebben.
  if (questions.length < 4) return null;

  // Update history (zelf-improvement / no-reuse best-effort).
  try {
    const next: QuizHistory = { entries: history.entries ?? [] };
    const words = questions.map((q) => q.word);
    const idx = next.entries.findIndex((e) => e.date === date);
    const entry = { date, words };
    if (idx >= 0) next.entries[idx] = entry;
    else next.entries.unshift(entry);
    next.entries = next.entries.slice(0, 120);
    await writeQuizHistory(repoRoot, next);
  } catch (e) {
    console.warn("[daily-quiz] quiz-history schrijf faalde (niet fataal)", e);
  }

  return { date, questions, generatedAt };
}
