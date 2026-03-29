"use client";

import Link from "next/link";
import { useState } from "react";
import type { DailyQuizPayload } from "@/lib/dailyQuiz";

export function DailyQuizCard({ data }: { data: DailyQuizPayload }) {
  const [picked, setPicked] = useState<number | null>(null);

  const showResult = picked !== null;
  const correct = picked === data.correctIndex;

  return (
    <section id="quiz-van-de-dag" aria-label="Quiz van de dag" className="scroll-mt-24">
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Quiz van de dag</p>
        <h2 className="mt-1 text-base font-semibold leading-snug tracking-tight text-[var(--text)]">{data.question}</h2>
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

        <Link
          href={`/story/${data.sourceSlug}`}
          className="mt-3 inline-flex text-sm font-semibold text-red-900 underline underline-offset-2 dark:text-red-300"
        >
          Lees het verhaal
        </Link>
      </div>
    </section>
  );
}
