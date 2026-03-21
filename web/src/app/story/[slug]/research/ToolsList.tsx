"use client";

import type { ToolListItem } from "./types";
import { groupByCategory } from "./utils";

function LinkIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

type Props = {
  items: ToolListItem[];
};

export function ToolsList({ items }: Props) {
  const grouped = groupByCategory(items);

  if (items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Geen tools of links voor deze stap.</p>;
  }

  return (
    <div className="space-y-5">
      {[...grouped.entries()].map(([category, list]) => (
        <div key={category}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{category}</h4>
          <ul className="space-2">
            {list.map((it, idx) => (
              <li key={`${category}-${idx}-${it.label}`}>
                {it.url ? (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-xl border border-gray-200 bg-[var(--card-bg)] p-3 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-[var(--card-border)] dark:hover:border-blue-500"
                  >
                    <LinkIcon />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--text)]">{it.label}</span>
                      {it.note ? (
                        <span className="mt-0.5 block line-clamp-2 text-xs text-[var(--muted)]">{it.note}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]" aria-hidden>
                      ↗
                    </span>
                  </a>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-gray-200 border-dashed bg-[var(--card-bg-hover)] p-3 dark:border-[var(--card-border)]">
                    <span className="mt-0.5 block h-4 w-4 shrink-0 rounded border border-[var(--border)]" aria-hidden />
                    <span className="text-sm text-[var(--muted)]">{it.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
