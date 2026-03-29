"use client";

import Link from "next/link";
import type { EditorialPickFile } from "@/lib/editorialPick";
import { EDITORIAL_KIND_LABEL_NL } from "@/lib/editorialPick";

export function EditorialPickCard({ data }: { data: Extract<EditorialPickFile, { enabled: true }> }) {
  const badge = (data.label?.trim() || EDITORIAL_KIND_LABEL_NL[data.kind]).trim();
  const inner = (
    <>
      <div
        className="relative h-20 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800/50"
        aria-hidden
      >
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {badge}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Aanrader</p>
        <h2 className="mt-1 text-base font-semibold leading-snug tracking-tight text-[var(--text)]">{data.title}</h2>
        {data.dek ? (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)] line-clamp-3">{data.dek}</p>
        ) : null}
        <span className="mt-2 inline-block text-sm font-semibold text-red-900 underline underline-offset-2 dark:text-red-300">
          {data.external ? "Openen" : "Bekijken"}
        </span>
      </div>
    </>
  );

  const className =
    "flex w-full items-start gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-3 text-left shadow-sm transition-all duration-150 hover:bg-zinc-50/80 hover:shadow-md active:scale-[0.99] dark:hover:bg-zinc-900/40";

  if (data.external) {
    return (
      <section id="aanrader" aria-label="Aanrader" className="scroll-mt-24">
        <a
          href={data.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          aria-label={`Aanrader: ${data.title}`}
        >
          {inner}
        </a>
      </section>
    );
  }

  return (
    <section id="aanrader" aria-label="Aanrader" className="scroll-mt-24">
      <Link href={data.href} className={`${className} group`} aria-label={`Aanrader: ${data.title}`}>
        {inner}
      </Link>
    </section>
  );
}
