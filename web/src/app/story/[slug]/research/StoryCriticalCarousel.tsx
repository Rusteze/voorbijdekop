"use client";

import { useCallback, useState } from "react";
import { CriticalQuestions } from "./CriticalQuestions";
import { InvestigationSuggestions } from "./InvestigationSuggestions";
import { WhySection } from "./WhySection";

const SLIDE_LABELS = ["Vragen", "Waarom", "Dieper"] as const;

export type StoryCriticalCarouselProps = {
  questions: string[];
  whyText: string;
  suggestions: string[];
};

export function StoryCriticalCarousel({ questions, whyText, suggestions }: StoryCriticalCarouselProps) {
  const hasThird = suggestions.length > 0;
  const maxIdx = hasThird ? 2 : 1;
  const [slide, setSlide] = useState(0);

  const go = useCallback(
    (i: number) => {
      setSlide(Math.max(0, Math.min(i, maxIdx)));
    },
    [maxIdx]
  );

  const labels = SLIDE_LABELS.slice(0, maxIdx + 1);

  return (
    <div className="w-full">
      <nav className="flex flex-wrap justify-center gap-2" aria-label="Kritisch kijken">
        {labels.map((label, i) => {
          const active = slide === i;
          return (
            <button
              key={label}
              type="button"
              onClick={() => go(i)}
              aria-current={active ? "true" : undefined}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "font-medium text-gray-900 underline decoration-gray-700 decoration-2 underline-offset-8 dark:text-gray-100 dark:decoration-gray-500"
                  : "text-gray-800 hover:text-black hover:underline dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <div className="pt-6">
        {slide === 0 ? <CriticalQuestions items={questions} /> : null}
        {slide === 1 ? <WhySection text={whyText} /> : null}
        {slide === 2 && hasThird ? <InvestigationSuggestions lines={suggestions} variant="embedded" /> : null}
      </div>
    </div>
  );
}
