"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { DailyQuizPayload } from "@/lib/dailyQuiz";
import { dismissQuizForEdition, isQuizDismissedForEdition } from "@/lib/quizDismissStorage";

export function DailyQuizCard({
  data,
  stories: _stories,
  placement = "feed",
  className
}: {
  data: DailyQuizPayload;
  /** `stories` is niet meer nodig, maar blijft optioneel voor compatibiliteit. */
  stories?: Array<{ slug?: string; importance?: number }>;
  /** `feed` = tussen overige verhalen (minder prominent). */
  placement?: "feed" | "featured";
  className?: string;
}) {
  const [hiddenByUser, setHiddenByUser] = useState(false);

  const compact = placement === "feed";

  type ResultsByWord = Record<
    string,
    {
      totalResponses: number;
      optionCounts: Record<string, number>;
      crowdMostChosen: string[];
      mostChosen: string[];
      source: "ai" | "crowd";
    }
  >;

  const [selections, setSelections] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const q of data.questions) init[q.word] = null;
    return init;
  });

  const [activeIndex, setActiveIndex] = useState(0);

  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    if (isQuizDismissedForEdition(data.generatedAt)) setHiddenByUser(true);
  }, [data.generatedAt]);

  // Reset state bij nieuwe quizeditie.
  useEffect(() => {
    const init: Record<string, string | null> = {};
    for (const q of data.questions) init[q.word] = null;
    setSelections(init);
    setActiveIndex(0);
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.generatedAt]);

  function handleDismiss() {
    dismissQuizForEdition(data.generatedAt);
    setHiddenByUser(true);
  }

  const answeredCount = useMemo(() => {
    return data.questions.reduce((acc, q) => acc + (selections[q.word] ? 1 : 0), 0);
  }, [data.questions, selections]);

  const allAnswered = data.questions.length > 0 && answeredCount >= data.questions.length;

  const activeQuestion = data.questions[Math.max(0, Math.min(activeIndex, data.questions.length - 1))];
  const activePicked = activeQuestion ? selections[activeQuestion.word] : null;

  useEffect(() => {
    if (submitted) return;
    if (!allAnswered) return;
    setSubmitted(true);
  }, [allAnswered, submitted]);

  const score = useMemo(() => {
    if (!submitted) return null;
    const total = data.questions.length;
    let correct = 0;
    for (const q of data.questions) {
      const picked = selections[q.word];
      if (!picked) continue;
      if (picked === q.correctOption) correct++;
    }
    return { correct, total };
  }, [data.questions, selections, submitted]);

  if (hiddenByUser) {
    return null;
  }

  if (submitted) {
    return (
      <section
        id="quiz-van-de-dag"
        aria-label="Associatie Quiz van de Dag"
        className={[compact ? "scroll-mt-20" : "scroll-mt-24", className ?? ""].filter(Boolean).join(" ")}
      >
        <div
          className={
            "relative rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm " +
            (compact ? "px-3 py-2.5" : "px-3 py-3")
          }
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Associatie Quiz van de Dag
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium text-zinc-500 underline-offset-2 hover:bg-zinc-100 hover:text-zinc-800 hover:underline dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200"
              aria-label="Quiz vandaag minder tonen"
            >
              Minder tonen
            </button>
          </div>

          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            {score?.correct} / {score?.total} goed
          </div>

          <div className="mt-3 space-y-4">
            {data.questions.map((q, qIdx) => {
              const picked = selections[q.word] ?? "";
              const ok = picked && picked === q.correctOption;

              return (
                <div key={q.word} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-bold leading-snug tracking-tight text-[var(--text)]">
                        {q.word}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-500">
                        Vraag {qIdx + 1} / {data.questions.length}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-[var(--text)]">
                    <div className={"font-medium " + (ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300")}>
                      Jij koos: {picked || "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                      Juiste associatie: <span className="font-semibold text-[var(--text)]">{q.correctOption}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="quiz-van-de-dag"
      aria-label="Associatie Quiz van de Dag"
      className={[compact ? "scroll-mt-20" : "scroll-mt-24", className ?? ""].filter(Boolean).join(" ")}
    >
      <div
        className={
          "relative rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm " +
          (compact ? "px-3 py-2.5" : "px-3 py-3")
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Associatie Quiz van de Dag
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium text-zinc-500 underline-offset-2 hover:bg-zinc-100 hover:text-zinc-800 hover:underline dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200"
            aria-label="Quiz vandaag minder tonen"
          >
            Minder tonen
          </button>
        </div>

        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Beantwoord: {answeredCount} / {data.questions.length}
        </div>

        {activeQuestion ? (
          <div className="mt-3 space-y-2">
            <div className="text-[15px] font-bold leading-snug tracking-tight text-[var(--text)]">
              {activeIndex + 1}. {activeQuestion.word}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {activeQuestion.options.map((opt, optIdx) => {
                const isThis = activePicked === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                        disabled={submitted}
                    onClick={() => {
                          if (submitted) return;
                      setSelections((prev) => ({ ...prev, [activeQuestion.word]: opt }));
                      // Auto-advance naar volgende woord
                      setActiveIndex((i) => Math.min(i + 1, data.questions.length - 1));
                    }}
                    aria-pressed={isThis}
                    className={
                      "rounded-md border px-3 py-2 text-left text-sm leading-snug transition-colors " +
                      (isThis
                        ? "border-red-400/80 bg-red-50 dark:bg-red-950/30 dark:border-red-500/40"
                        : "border-[var(--border)] bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900")
                    }
                  >
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">{String.fromCharCode(65 + optIdx)}.</span>{" "}
                    <span className="text-[var(--text)]">{opt}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-500">
              <button
                type="button"
                disabled={activeIndex <= 0 || submitted}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                className="rounded-md px-2 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800/70"
              >
                Vorige
              </button>
              <div>
                Vraag {activeIndex + 1} / {data.questions.length}
              </div>
              <button
                type="button"
                disabled={activeIndex >= data.questions.length - 1 || submitted || !activePicked}
                onClick={() => setActiveIndex((i) => Math.min(data.questions.length - 1, i + 1))}
                className="rounded-md px-2 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800/70"
              >
                Volgende
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
