import type { HTMLAttributes } from "react";

export type WhySectionProps = {
  text: string;
} & Pick<HTMLAttributes<HTMLDivElement>, "className">;

export function WhySection({ text, className = "" }: WhySectionProps) {
  if (!text.trim()) return null;

  return (
    <div className={`mt-6 ${className}`.trim()}>
      <p className="text-base font-semibold leading-relaxed text-gray-900 dark:text-gray-100 md:text-sm">
        Waarom dit belangrijk is
      </p>
      <p className="mt-3 text-base leading-relaxed text-gray-900 dark:text-gray-100 md:text-sm">{text}</p>
    </div>
  );
}
