export type DailyQuizQuestion = {
  word: string;
  /** 4 opties voor de UI (shuffled voor weergave). */
  options: string[];
  /** Opties in volgorde van "meest logisch" (AI-bootstrapping). */
  initialRanking: string[];
  category: "general" | "news" | "fun";
};

export type DailyQuizPayload = {
  /** Amsterdam-dag (YYYY-MM-DD). */
  date: string;
  questions: DailyQuizQuestion[];
  generatedAt: string;
};

export type DailyQuizFile =
  | DailyQuizPayload
  | { skipped: true; generatedAt?: string; reason?: string };

export function isActiveDailyQuiz(data: DailyQuizFile | null): data is DailyQuizPayload {
  if (!data) return false;
  return !("skipped" in data && data.skipped === true);
}
