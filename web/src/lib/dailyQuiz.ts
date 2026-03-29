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
