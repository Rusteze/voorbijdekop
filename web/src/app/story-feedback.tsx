"use client";

import { useMemo, useState } from "react";
import { submitWithFallback } from "@/lib/submissions";

type FeedbackType = "onjuist" | "misleidend" | "mist-bron";

const STORAGE_KEY = "story-feedback-v1";
const FEEDBACK_ENDPOINT = process.env.NEXT_PUBLIC_FEEDBACK_ENDPOINT;

export function StoryFeedback({ slug }: { slug: string }) {
  const [selected, setSelected] = useState<FeedbackType | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveMode, setSaveMode] = useState<"remote" | "local" | null>(null);

  const options = useMemo(
    () =>
      [
        { id: "onjuist", label: "Onjuist" },
        { id: "misleidend", label: "Misleidend" },
        { id: "mist-bron", label: "Mist bron" }
      ] as const,
    []
  );

  const onSave = async () => {
    if (!selected) return;
    try {
      const result = await submitWithFallback({
        endpoint: FEEDBACK_ENDPOINT,
        storageKey: STORAGE_KEY,
        payload: {
          slug,
          type: selected,
          createdAt: new Date().toISOString()
        }
      });
      setSaveMode(result.persisted);
      setSaved(true);
    } catch {
      // ignore storage failures
    }
  };

  return (
    <section className="mb-10 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 md:mb-12">
      <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-gray-100">Feedback op dit verhaal</h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
        Zie je een probleem? Jouw feedback helpt om de analyse te verbeteren. Alleen jouw keuze en het verhaal worden
        opgeslagen (lokaal of op de server als die is ingesteld).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setSelected(o.id);
                setSaved(false);
                setSaveMode(null);
              }}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
                (active
                  ? "border-zinc-900/20 bg-zinc-900/5 text-zinc-900 dark:border-zinc-100/20 dark:bg-zinc-100/10 dark:text-zinc-100"
                  : "border-[var(--border)] text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!selected}
          className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Verstuur feedback
        </button>
        {saved ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-300">
            Bedankt, {saveMode === "remote" ? "online" : "lokaal"} opgeslagen.
          </span>
        ) : null}
      </div>
    </section>
  );
}
