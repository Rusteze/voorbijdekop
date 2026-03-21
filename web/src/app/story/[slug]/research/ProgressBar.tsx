"use client";

type Props = {
  currentStepIndex: number;
  totalSteps: number;
  /** Stappen die volledig afgerond zijn (0-based indices). */
  completedStepIndices: Set<number>;
};

export function ProgressBar({ currentStepIndex, totalSteps, completedStepIndices }: Props) {
  const pct =
    totalSteps > 0 ? Math.min(100, Math.round((completedStepIndices.size / totalSteps) * 100)) : 0;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          Stap <span className="font-semibold text-[var(--text)]">{currentStepIndex + 1}</span> van {totalSteps}
        </span>
        <span className="tabular-nums">{pct}% afgerond</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[var(--card-border)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out dark:bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }, (_, i) => {
          const done = completedStepIndices.has(i);
          const active = i === currentStepIndex;
          return (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                done
                  ? "bg-emerald-500"
                  : active
                    ? "bg-blue-600 dark:bg-blue-500"
                    : "bg-gray-200 dark:bg-[var(--card-border)]"
              }`}
              title={done ? `Stap ${i + 1} afgerond` : `Stap ${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
