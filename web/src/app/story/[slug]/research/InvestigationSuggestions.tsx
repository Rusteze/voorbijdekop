import type { HTMLAttributes } from "react";

export type InvestigationSuggestionsProps = {
  lines: string[];
  variant?: "default" | "embedded";
} & Pick<HTMLAttributes<HTMLDivElement>, "className">;

export function InvestigationSuggestions({
  lines,
  className = "",
  variant = "default",
}: InvestigationSuggestionsProps) {
  const list = lines.slice(0, 5).filter(Boolean);
  if (list.length === 0) return null;

  const titleCls =
    variant === "embedded"
      ? "text-base font-semibold leading-relaxed text-gray-900 dark:text-gray-100 md:text-sm"
      : "text-xl font-semibold text-gray-900 dark:text-gray-100";

  const title = "Wil je verder onderzoeken?";

  return (
    <div className={`mt-6 ${className}`.trim()}>
      {variant === "embedded" ? (
        <p className={titleCls}>{title}</p>
      ) : (
        <h3 className={titleCls}>{title}</h3>
      )}
      <ul className="mt-4 list-disc space-y-3 pl-5 text-base leading-relaxed text-gray-900 marker:text-gray-700 dark:text-gray-100 dark:marker:text-gray-500 md:text-sm">
        {list.map((line, i) => (
          <li key={`${i}-${line.slice(0, 20)}`} className="break-words">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
