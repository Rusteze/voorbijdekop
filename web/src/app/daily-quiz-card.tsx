"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import { resolveQuizStorySlug, type DailyQuizPayload } from "@/lib/dailyQuiz";
import { dismissQuizForEdition, isQuizDismissedForEdition } from "@/lib/quizDismissStorage";

export function DailyQuizCard({
  data,
  stories,
  placement = "feed",
  className
}: {
  data: DailyQuizPayload;
  /** Actuele lijst (zelfde als homepage); nodig om een geldige /story/-slug te kiezen. */
  stories: Array<{ slug?: string; importance?: number }>;
  /** `feed` = tussen overige verhalen (minder prominent). */
  placement?: "feed" | "featured";
  className?: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [hiddenByUser, setHiddenByUser] = useState(false);

  useLayoutEffect(() => {
    if (isQuizDismissedForEdition(data.generatedAt)) {
      setHiddenByUser(true);
    }
  }, [data.generatedAt]);

  const storySlug = useMemo(() => resolveQuizStorySlug(data, stories), [data, stories]);

  const showResult = picked !== null;
  const correct = picked === data.correctIndex;

  const compact = placement === "feed";

  function handleDismiss() {
    dismissQuizForEdition(data.generatedAt);
    setHiddenByUser(true);
  }

  if (hiddenByUser) {
    return null;
  }

  return (
    <section
      id="quiz-van-de-dag"
      aria-label="Quiz van de dag"
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
            Quiz van de dag
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
        <h2
          className={
            compact
              ? "mt-1 text-sm font-semibold leading-snug tracking-tight text-[var(--text)]"
              : "mt-1 text-base font-semibold leading-snug tracking-tight text-[var(--text)]"
          }
        >
          {data.question}
        </h2>
        {data.contextLine ? (
          <p className="mt-2 text-sm italic leading-relaxed text-[var(--muted)] line-clamp-3 border-l-2 border-zinc-300 pl-2 dark:border-zinc-600">
            {data.contextLine}
          </p>
        ) : null}

        <ul className="mt-3 space-y-2" role="list">
          {data.options.map((opt, idx) => {
            const isThis = picked === idx;
            const isCorrectOption = idx === data.correctIndex;
            let btnClass =
              "w-full rounded-md border px-3 py-2.5 text-left text-sm leading-snug transition-colors ";
            if (!showResult) {
              btnClass += "border-[var(--border)] bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900";
            } else {
              if (isCorrectOption) btnClass += "border-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-500/50";
              else if (isThis && !isCorrectOption) btnClass += "border-red-400/80 bg-red-50 dark:bg-red-950/30 dark:border-red-500/40";
              else btnClass += "border-[var(--border)] opacity-70";
            }

            return (
              <li key={`${idx}-${opt.slice(0, 24)}`}>
                <button
                  type="button"
                  disabled={showResult}
                  onClick={() => setPicked(idx)}
                  className={btnClass}
                  aria-pressed={isThis}
                >
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">{String.fromCharCode(65 + idx)}.</span>{" "}
                  <span className="text-[var(--text)]">{opt}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {showResult ? (
          <p
            className={
              "mt-3 text-sm font-medium " +
              (correct ? "text-emerald-800 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-200")
            }
            role="status"
          >
            {correct ? "Goed zo." : "Niet juist — het juiste antwoord staat hierboven gemarkeerd."}
          </p>
        ) : null}

        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Gebaseerd op de verhalen in deze editie.
        </p>

        {storySlug ? (
          <Link
            href={`/story/${encodeURIComponent(storySlug)}`}
            className="mt-3 inline-flex text-sm font-semibold text-red-900 underline underline-offset-2 dark:text-red-300"
          >
            Lees het verhaal
          </Link>
        ) : (
          <Link
            href="/"
            className="mt-3 inline-flex text-sm font-semibold text-red-900 underline underline-offset-2 dark:text-red-300"
          >
            Naar de voorpagina
          </Link>
        )}
      </div>
    </section>
  );
}
