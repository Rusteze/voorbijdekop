"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resultsByWord, setResultsByWord] = useState<ResultsByWord>({});
  const hasSubmittedRef = useRef(false);

  useLayoutEffect(() => {
    if (isQuizDismissedForEdition(data.generatedAt)) setHiddenByUser(true);
  }, [data.generatedAt]);

  // Reset state bij nieuwe quizeditie.
  useEffect(() => {
    const init: Record<string, string | null> = {};
    for (const q of data.questions) init[q.word] = null;
    setSelections(init);
    setSubmitted(false);
    setSubmitting(false);
    setResultsByWord({});
    hasSubmittedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.generatedAt]);

  function handleDismiss() {
    dismissQuizForEdition(data.generatedAt);
    setHiddenByUser(true);
  }

  function quizApiUrl(path: string): string {
    const digest = process.env.NEXT_PUBLIC_DIGEST_ENDPOINT;
    if (!digest) return path;
    try {
      const u = new URL(digest);
      return `${u.origin}${path}`;
    } catch {
      return path;
    }
  }

  async function submitAllAndLoadResults() {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setSubmitting(true);
    try {
      const apiSubmit = quizApiUrl("/v1/quiz/submit");
      const apiAgg = quizApiUrl("/v1/quiz/aggregate");

      // 1) Crowd submit (per woord)
      await Promise.all(
        data.questions.map(async (q) => {
          const answer = selections[q.word];
          if (!answer) return;
          try {
            await fetch(apiSubmit, {
              method: "POST",
              headers: { "content-type": "application/json; charset=utf-8" },
              body: JSON.stringify({ date: data.date, word: q.word, answer })
            });
          } catch {
            // ignore submit errors; we still show AI fallback
          }
        })
      );

      // 2) Aggregate per woord
      const aggResults = await Promise.all(
        data.questions.map(async (q) => {
          try {
            const res = await fetch(apiAgg, {
              method: "POST",
              headers: { "content-type": "application/json; charset=utf-8" },
              body: JSON.stringify({ date: data.date, word: q.word, options: q.options })
            });
            if (!res.ok) throw new Error("aggregate_bad_response");
            const json = (await res.json()) as {
              totalResponses: number;
              optionCounts: Record<string, number>;
              crowdMostChosen: string[];
            };
            return { word: q.word, ...json };
          } catch {
            return { word: q.word, totalResponses: 0, optionCounts: {}, crowdMostChosen: [] as string[] };
          }
        })
      );

      const next: ResultsByWord = {};
      for (const item of aggResults) {
        const q = data.questions.find((qq) => qq.word === item.word);
        const totalResponses = Number(item.totalResponses ?? 0) || 0;
        const optionCounts = item.optionCounts ?? {};
        const crowdMostChosen = item.crowdMostChosen ?? [];

        const useCrowd = totalResponses >= 50;
        const aiMostChosen = q?.initialRanking?.[0] ? [q.initialRanking[0]] : [];
        next[item.word] = {
          totalResponses,
          optionCounts,
          crowdMostChosen,
          mostChosen: useCrowd ? crowdMostChosen : aiMostChosen,
          source: useCrowd ? "crowd" : "ai"
        };
      }

      setResultsByWord(next);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = useMemo(() => {
    return data.questions.reduce((acc, q) => acc + (selections[q.word] ? 1 : 0), 0);
  }, [data.questions, selections]);

  const allAnswered = data.questions.length > 0 && answeredCount >= data.questions.length;

  useEffect(() => {
    if (submitted || submitting) return;
    if (!allAnswered) return;
    submitAllAndLoadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, submitted, submitting]);

  const score = useMemo(() => {
    if (!submitted) return null;
    const total = data.questions.length;
    let correct = 0;
    for (const q of data.questions) {
      const picked = selections[q.word];
      const res = resultsByWord[q.word];
      if (!picked || !res) continue;
      if ((res.mostChosen ?? []).includes(picked)) correct++;
    }
    return { correct, total };
  }, [data.questions, resultsByWord, selections, submitted]);

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
            {score?.correct} / {score?.total} gelijk met de meeste mensen
          </div>

          <div className="mt-3 space-y-4">
            {data.questions.map((q, qIdx) => {
              const res = resultsByWord[q.word];
              const total = res?.totalResponses ?? 0;
              const picked = selections[q.word] ?? "";

              const aiFallback = q.initialRanking?.[0] ?? "";
              const source = res?.source ?? "ai";
              const sourceLabel = source === "crowd" ? "Meest gekozen" : "Meest voor de hand liggend";
              const mostChosenLabel = (res?.mostChosen ?? []).length ? res!.mostChosen.join(", ") : aiFallback;

              const showLowAnswers = source === "ai";
              const mostPercent =
                source === "crowd" && total
                  ? (() => {
                      const most = res?.mostChosen ?? [];
                      const maxCount = most.reduce((acc, opt) => Math.max(acc, res?.optionCounts?.[opt] ?? 0), 0);
                      return Math.round((maxCount / total) * 100);
                    })()
                  : 0;

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
                    <div className="font-medium">Jij koos: {picked}</div>
                    {showLowAnswers ? (
                      <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                        {sourceLabel}: {mostChosenLabel}
                        <span className="block mt-0.5">Nog weinig antwoorden</span>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                        {sourceLabel}: {mostChosenLabel} ({mostPercent}%)
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    {q.options.map((opt) => {
                      const c = res?.optionCounts?.[opt] ?? 0;
                      const pct = total ? Math.round((c / total) * 100) : 0;
                      const isTop = (res?.mostChosen ?? []).includes(opt);
                      return (
                        <div key={opt} className="flex items-center gap-2">
                          <div
                            className={
                              "w-[92px] text-[11px] leading-4 text-zinc-600 dark:text-zinc-300 " +
                              (isTop ? "font-semibold text-zinc-900 dark:text-zinc-100" : "")
                            }
                          >
                            {opt} ({pct}%)
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-800">
                              <div
                                className={"h-2 rounded-full " + (isTop ? "bg-emerald-600/90" : "bg-red-400/80")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

        <div className="mt-3 space-y-4">
          {data.questions.map((q, qIdx) => {
            const picked = selections[q.word];
            return (
              <div key={q.word} className="space-y-2">
                <div className="text-[15px] font-bold leading-snug tracking-tight text-[var(--text)]">
                  {qIdx + 1}. {q.word}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => {
                    const isThis = picked === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={submitting || submitted}
                        onClick={() => setSelections((prev) => ({ ...prev, [q.word]: opt }))}
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
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
