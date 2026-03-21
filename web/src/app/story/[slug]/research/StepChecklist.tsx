"use client";

type Props = {
  items: string[];
  checked: boolean[];
  onToggle: (index: number) => void;
};

export function StepChecklist({ items, checked, onToggle }: Props) {
  return (
    <ul className="space-y-3" role="list">
      {items.map((text, i) => {
        const isChecked = Boolean(checked[i]);
        return (
          <li key={i}>
            <label className="group flex cursor-pointer gap-3 rounded-lg p-2 transition hover:bg-[var(--card-bg-hover)]">
              <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(i)}
                  className="sr-only"
                />
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all duration-200 ${
                    isChecked
                      ? "scale-100 border-emerald-600 bg-emerald-600 shadow-sm dark:border-emerald-500 dark:bg-emerald-500"
                      : "border-gray-300 bg-[var(--card-bg)] group-hover:border-blue-400 dark:border-[var(--card-border)]"
                  }`}
                  aria-hidden
                >
                  <svg
                    className={`h-3 w-3 text-white transition-transform duration-200 ${
                      isChecked ? "scale-100 opacity-100" : "scale-50 opacity-0"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </span>
              <span
                className={`min-w-0 flex-1 text-sm leading-snug transition-colors ${
                  isChecked ? "text-[var(--muted)] line-through decoration-[var(--muted)]" : "text-[var(--text)]"
                }`}
              >
                <span className="line-clamp-2">{text}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
