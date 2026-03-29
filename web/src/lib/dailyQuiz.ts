import { getStoryLastUpdated } from "@/lib/storyUtils";

export type DailyQuizPayload = {
  kind: "topic" | "headline";
  question: string;
  contextLine: string | null;
  options: string[];
  correctIndex: number;
  sourceSlug: string;
  generatedAt: string;
};

export type DailyQuizFile =
  | DailyQuizPayload
  | { skipped: true; generatedAt?: string; reason?: string };

export function isActiveDailyQuiz(data: DailyQuizFile | null): data is DailyQuizPayload {
  if (!data) return false;
  return !("skipped" in data && data.skipped === true);
}

/**
 * Bepaalt een werkende story-slug voor de quizlink.
 * `daily-quiz.json` kan achterlopen op `stories.json` (bijv. alleen nieuws-deploy); oude `sourceSlug`
 * heeft dan geen statische `/story/[slug]` meer → 404. Eerst exacte match, anders het prominentste
 * verhaal in de huidige lijst (zelfde logica als de homepage).
 */
export function resolveQuizStorySlug(
  quiz: DailyQuizPayload,
  stories: Array<{ slug?: string; importance?: number }>
): string | null {
  if (!Array.isArray(stories) || stories.length === 0) return null;

  const direct = stories.find((s) => typeof s.slug === "string" && s.slug === quiz.sourceSlug);
  if (direct?.slug) return direct.slug;

  const sorted = [...stories].sort((a, b) => {
    const imp = (b.importance ?? 0) - (a.importance ?? 0);
    if (imp !== 0) return imp;
    return getStoryLastUpdated(b) - getStoryLastUpdated(a);
  });
  const top = sorted[0];
  return typeof top?.slug === "string" && top.slug.length > 0 ? top.slug : null;
}
