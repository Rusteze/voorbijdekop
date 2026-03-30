function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function ImportanceIndicator({
  value,
  compact
}: {
  value: number | null | undefined;
  compact?: boolean;
}) {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const rounded = Math.round(v);
  const width = `${clamp(rounded, 0, 100)}%`;

  return (
    <div className={compact ? "mt-1" : "mt-2"} aria-label={`Belangrijkheid ${rounded}`}>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
          <div className="h-full rounded-full bg-zinc-950 dark:bg-zinc-100" style={{ width }} />
        </div>
        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{rounded}</span>
      </div>
    </div>
  );
}

