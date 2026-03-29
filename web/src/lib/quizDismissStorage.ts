const STORAGE_KEY = "voorbijdekop-daily-quiz-dismiss-v1";

function amsterdamDayString(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

/** Quiz is verborgen tot de volgende kalenderdag (Amsterdam) of tot `generatedAt` wijzigt. */
export function isQuizDismissedForEdition(generatedAt: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw) as { day?: string; generatedAt?: string };
    if (o.generatedAt !== generatedAt) return false;
    return o.day === amsterdamDayString();
  } catch {
    return false;
  }
}

export function dismissQuizForEdition(generatedAt: string): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: amsterdamDayString(), generatedAt })
    );
  } catch {
    /* ignore */
  }
}
