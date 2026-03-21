"use client";

type Props = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onStart: () => void;
};

export function ResearchCard({ icon, title, description, onStart }: Props) {
  return (
    <article className="group rounded-xl border border-gray-200 bg-[var(--card-bg)] p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md dark:border-[var(--card-border)] dark:hover:border-blue-600">
      <div className="flex gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-base font-semibold leading-snug text-[var(--text)]">{title}</h3>
          {description ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
          ) : null}
          <button
            type="button"
            onClick={onStart}
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-400"
          >
            Start onderzoek
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </article>
  );
}
