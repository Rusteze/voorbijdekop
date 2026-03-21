import type { HTMLAttributes } from "react";

export type WhySectionProps = {
  text: string;
} & Pick<HTMLAttributes<HTMLDivElement>, "className">;

export function WhySection({ text, className = "" }: WhySectionProps) {
  if (!text.trim()) return null;

  return (
    <div className={`mt-6 ${className}`.trim()}>
      <p className="text-sm font-semibold leading-relaxed text-gray-900 dark:text-gray-100">Waarom dit belangrijk is</p>
      <p className="mt-3 text-sm leading-relaxed text-gray-900 dark:text-gray-100">{text}</p>
    </div>
  );
}
