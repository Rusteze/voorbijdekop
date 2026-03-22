import type { HTMLAttributes } from "react";

export type CriticalQuestionsProps = {
  items: string[];
} & Pick<HTMLAttributes<HTMLUListElement>, "className">;

/** Kritische vragen — zelfde body-typografie als de rest van het stuk (geen koppengevoel). */
export function CriticalQuestions({ items, className = "" }: CriticalQuestionsProps) {
  const list = items.slice(0, 5);
  if (list.length === 0) return null;

  return (
    <ul className={`list-disc space-y-3 pl-5 text-base leading-relaxed text-gray-900 marker:text-gray-700 dark:text-gray-100 dark:marker:text-gray-500 md:text-sm ${className}`.trim()}>
      {list.map((q, i) => (
        <li key={`${i}-${q.slice(0, 24)}`} className="break-words">
          {q}
        </li>
      ))}
    </ul>
  );
}
