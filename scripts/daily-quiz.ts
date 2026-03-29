import type { Story } from "./types.js";
import { TOPIC_DISPLAY_NL } from "./topicRegistry.js";

export type DailyQuizPayload = {
  kind: "topic" | "headline";
  question: string;
  /** Korte context (bijv. kop) bij topic-quiz */
  contextLine: string | null;
  options: string[];
  correctIndex: number;
  sourceSlug: string;
  generatedAt: string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function headlineFor(s: Story): string {
  return (s.shortHeadline ?? s.title ?? "").trim();
}

function topicLabelNl(key: string): string {
  return TOPIC_DISPLAY_NL[key as keyof typeof TOPIC_DISPLAY_NL] ?? key;
}

/**
 * Eén quiz per build: prominent verhaal = hoogste importance, dan recency.
 * Minimaal 4 verhalen; topic-quiz als er ≥4 verschillende topics zijn, anders kop-quiz.
 */
export function generateDailyQuiz(stories: Story[], generatedAt: string): DailyQuizPayload | null {
  if (stories.length < 4) {
    console.warn("[daily-quiz] overgeslagen: minder dan 4 verhalen");
    return null;
  }

  const sorted = [...stories].sort((a, b) => {
    const imp = (b.importance ?? 0) - (a.importance ?? 0);
    if (imp !== 0) return imp;
    return new Date(b.generatedAt ?? 0).getTime() - new Date(a.generatedAt ?? 0).getTime();
  });

  const source = sorted[0];
  const correctTopic = (source.topic ?? "overig").trim() || "overig";

  const topicKeys = [...new Set(stories.map((s) => (s.topic ?? "overig").trim() || "overig"))];

  if (topicKeys.length >= 4) {
    const wrongPool = topicKeys.filter((t) => t !== correctTopic);
    if (wrongPool.length < 3) {
      console.warn("[daily-quiz] topic-quiz: niet genoeg foute topics, val terug op koppen");
    } else {
      const wrong = shuffle(wrongPool).slice(0, 3);
      const optionKeys = shuffle([correctTopic, ...wrong]);
      const options = optionKeys.map(topicLabelNl);
      const correctIndex = optionKeys.indexOf(correctTopic);
      if (correctIndex < 0) {
        console.warn("[daily-quiz] interne fout: correct topic niet in opties");
        return null;
      }
      return {
        kind: "topic",
        question: "Welk onderwerp past het best bij het meest prominente verhaal van deze editie?",
        contextLine: headlineFor(source).slice(0, 160),
        options,
        correctIndex,
        sourceSlug: source.slug,
        generatedAt
      };
    }
  }

  const required = sorted[0];
  const requiredH = headlineFor(required);
  if (!requiredH) {
    console.warn("[daily-quiz] overgeslagen: prominent verhaal heeft geen kop");
    return null;
  }

  const pool: Story[] = [required];
  const seen = new Set<string>([requiredH]);
  for (const s of sorted) {
    if (pool.length >= 4) break;
    if (s.slug === required.slug) continue;
    const h = headlineFor(s);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    pool.push(s);
  }

  if (pool.length < 4) {
    console.warn("[daily-quiz] overgeslagen: niet genoeg unieke koppen");
    return null;
  }

  const options = shuffle(pool.map(headlineFor));
  const correctH = requiredH;
  const correctIndex = options.indexOf(correctH);
  if (correctIndex < 0) {
    console.warn("[daily-quiz] overgeslagen: correcte kop niet in opties");
    return null;
  }

  return {
    kind: "headline",
    question: "Welke kop hoort bij het belangrijkste verhaal van deze editie?",
    contextLine: null,
    options,
    correctIndex,
    sourceSlug: required.slug,
    generatedAt
  };
}
