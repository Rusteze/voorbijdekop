"use client";

import Link from "next/link";
import type { FeedInsert } from "@/lib/homeFeedInserts";
import { AI_TAGLINE } from "@/lib/siteCopy";
import { useVoorbijDekop } from "./voorbijdekop-state";

function AiInfoCardBody() {
  const { openAiInfo } = useVoorbijDekop();
  return (
    <button
      type="button"
      onClick={openAiInfo}
      className="flex w-full items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-left shadow-sm transition-all duration-150 hover:bg-zinc-50/80 active:scale-[0.99] dark:hover:bg-zinc-900/40"
      aria-label={`${AI_TAGLINE} — uitleg openen`}
    >
      <div
        className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800/50"
        aria-hidden
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">AI</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-normal leading-snug text-zinc-600 dark:text-zinc-300">
          {AI_TAGLINE}
        </p>
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-zinc-600 pointer-events-none dark:text-zinc-400"
          aria-hidden
        >
          <span className="text-xs font-semibold leading-none">i</span>
        </span>
      </div>
    </button>
  );
}

function PromoCard({ insert }: { insert: Extract<FeedInsert, { kind: "promo" }> }) {
  const inner = (
    <>
      <div
        className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50"
        aria-hidden
      >
        Tip
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{insert.title}</p>
        <p className="mt-1 text-sm leading-snug text-zinc-600 dark:text-zinc-300">{insert.body}</p>
        <span className="mt-2 inline-block text-sm font-semibold text-red-900 underline underline-offset-2 dark:text-red-200">
          {insert.cta}
        </span>
      </div>
    </>
  );

  const className =
    "flex w-full items-start gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-left shadow-sm transition-all duration-150 hover:bg-zinc-50/80 active:scale-[0.99] dark:hover:bg-zinc-900/40";

  if (insert.external) {
    return (
      <a
        href={insert.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={`${insert.title}: ${insert.cta}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={insert.href} className={`${className} group`} aria-label={`${insert.title}: ${insert.cta}`}>
      {inner}
    </Link>
  );
}

export function FeedInsertCard({ insert }: { insert: FeedInsert }) {
  if (insert.kind === "ai-info") {
    return <AiInfoCardBody />;
  }
  return <PromoCard insert={insert} />;
}
