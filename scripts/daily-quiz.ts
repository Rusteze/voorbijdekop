import fs from "node:fs/promises";
import path from "node:path";
import type { Story } from "./types.js";

export type DailyQuizQuestion = {
  word: string;
  options: string[];
  initialRanking: string[];
  category: "general" | "news" | "fun";
};

export type DailyQuizPayload = {
  date: string; // YYYY-MM-DD (Amsterdam)
  questions: DailyQuizQuestion[]; // altijd 4
  generatedAt: string;
};

type WordPoolEntry = {
  word: string;
  category: "general" | "fun";
  associations?: string[];
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

function normalizeNewsToken(token: string): string {
  return token.trim().toLowerCase();
}

function toDisplayWord(token: string): string {
  const t = token.trim();
  if (!t) return t;
  // Meest voorkomende cases: lowercase woorden of tokens met koppeltekens.
  return t
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function isGoodNewsToken(token: string): boolean {
  const t = token.trim();
  // keywords zijn meestal lowercase woorden, soms met koppeltekens.
  return /^[a-zA-ZÀ-ÖØ-öø-ÿ-]{2,24}$/.test(t) && !/^(de|het|een|en|of|dat|om|op|bij|van|door|naar|met|voor)$/i.test(t);
}

async function readWordPool(repoRoot: string): Promise<WordPoolEntry[]> {
  const filePath = path.join(repoRoot, "data", "wordPool.json");
  const rawText = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(rawText) as unknown;
  if (!Array.isArray(parsed)) throw new Error("wordPool.json moet een array zijn");
  return parsed as WordPoolEntry[];
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

export async function generateDailyQuiz(
  stories: Story[],
  generatedAt: string,
  opts?: { repoRoot?: string }
): Promise<DailyQuizPayload | null> {
  const repoRoot = opts?.repoRoot ?? path.resolve(".");

  const date = toAmsterdamDayString(new Date(generatedAt));

  const wordPool = await readWordPool(repoRoot);
  const generalPool = wordPool.filter((w) => w.category === "general" && Array.isArray(w.associations) && w.associations.length >= 4);
  const funPool = wordPool.filter((w) => w.category === "fun" && Array.isArray(w.associations) && w.associations.length >= 4);

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

  // News keywords: neem uit de meest prominente stories (importance) en tel keyword-frequentie.
  const sortedStories = [...stories].sort((a, b) => {
    const imp = (b.importance ?? 0) - (a.importance ?? 0);
    if (imp !== 0) return imp;
    return new Date(b.generatedAt ?? 0).getTime() - new Date(a.generatedAt ?? 0).getTime();
  });
  const topStories = sortedStories.slice(0, 15);

  const keywordFreq = new Map<string, number>();
  for (const s of topStories) {
    for (const art of s.articles) {
      for (const kw of art.keywords ?? []) {
        const tok = normalizeNewsToken(kw);
        if (!isGoodNewsToken(tok)) continue;
        keywordFreq.set(tok, (keywordFreq.get(tok) ?? 0) + 1);
      }
    }
  }

  const newsCandidates = [...keywordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  // Selecteer woorden (deterministisch, liefst niet herhalen).
  const seedBase = date + ":associatie";
  const pickGeneral = seededShuffle(
    generalPool.map((w) => w.word).filter((w) => !usedInLast30Days.has(w)),
    seedBase + ":general"
  );
  const pickFun = seededShuffle(
    funPool.map((w) => w.word).filter((w) => !usedInLast30Days.has(w)),
    seedBase + ":fun"
  );

  const selectedGeneral = (pickGeneral.length ? pickGeneral : generalPool.map((w) => w.word)).slice(0, 2);
  const selectedFun = (pickFun.length ? pickFun : funPool.map((w) => w.word)).slice(0, 1);

  const selectedNewsRaw = (() => {
    const filtered = newsCandidates.filter((tok) => !usedInLast30Days.has(toDisplayWord(tok)));
    const chosen = filtered.length ? filtered[0] : newsCandidates[0] ?? "nieuws";
    return chosen;
  })();

  const newsWordDisplay = toDisplayWord(selectedNewsRaw);

  const questions: DailyQuizQuestion[] = [];

  // Helper: build options from association map
  const poolByWord = new Map(wordPool.map((e) => [e.word, e]));
  const makeFromPool = (word: string, category: "general" | "fun"): DailyQuizQuestion => {
    const entry = poolByWord.get(word);
    const initialRanking = entry?.associations?.slice(0, 4) ?? [word];
    const safeInitial = uniqueNonEmpty(initialRanking).slice(0, 4);
    while (safeInitial.length < 4) safeInitial.push(`Optie ${safeInitial.length + 1}`);
    const options = seededShuffle(safeInitial, `${seedBase}:${word}:ui`);
    return { word, category, options, initialRanking: safeInitial };
  };

  for (const w of selectedGeneral) questions.push(makeFromPool(w, "general"));
  if (selectedFun[0]) questions.push(makeFromPool(selectedFun[0], "fun"));

  // News associations: co-occur keywords in stories where this token voorkomt.
  const newsRelated = topStories.filter((s) =>
    s.articles.some((art) => (art.keywords ?? []).some((kw) => normalizeNewsToken(kw) === selectedNewsRaw))
  );
  const coFreq = new Map<string, number>();
  for (const s of newsRelated) {
    for (const art of s.articles) {
      for (const kw of art.keywords ?? []) {
        const tok = normalizeNewsToken(kw);
        if (!isGoodNewsToken(tok)) continue;
        if (tok === selectedNewsRaw) continue;
        coFreq.set(tok, (coFreq.get(tok) ?? 0) + 1);
      }
    }
  }
  const coCandidates = [...coFreq.entries()].sort((a, b) => b[1] - a[1]).map(([tok]) => tok);
  const fallbackCandidates = newsCandidates.filter((tok) => tok !== selectedNewsRaw);
  const newsOptionsRaw = uniqueNonEmpty([...coCandidates.slice(0, 10), ...fallbackCandidates.slice(0, 20)]);
  const selectedNewsOptions = newsOptionsRaw.map(toDisplayWord).slice(0, 4);
  const initialRankingNews = uniqueNonEmpty(selectedNewsOptions).slice(0, 4);
  while (initialRankingNews.length < 4) initialRankingNews.push(`Optie ${initialRankingNews.length + 1}`);
  const optionsNews = seededShuffle(initialRankingNews, `${seedBase}:news:${newsWordDisplay}:ui`);

  questions.push({
    word: newsWordDisplay,
    category: "news",
    initialRanking: initialRankingNews,
    options: optionsNews
  });

  // Zorg dat we altijd precies 4 vragen hebben.
  const finalQuestions = questions.slice(0, 4);
  if (finalQuestions.length < 4) {
    console.warn("[daily-quiz] overgeslagen: kon geen 4 vragen samenstellen");
    return null;
  }

  // Update history (zelf-improvement / no-reuse best-effort).
  try {
    const next: QuizHistory = { entries: history.entries ?? [] };
    const words = finalQuestions.map((q) => q.word);
    const idx = next.entries.findIndex((e) => e.date === date);
    const entry = { date, words };
    if (idx >= 0) next.entries[idx] = entry;
    else next.entries.unshift(entry);
    next.entries = next.entries.slice(0, 120);
    await writeQuizHistory(repoRoot, next);
  } catch (e) {
    console.warn("[daily-quiz] quiz-history schrijf faalde (niet fataal)", e);
  }

  return { date, questions: finalQuestions, generatedAt };
}
