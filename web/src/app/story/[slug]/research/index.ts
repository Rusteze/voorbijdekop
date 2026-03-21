export type { InvestigationSlide, InvestigationResourceLink, InvestigationToolPill, QuickSourceLink } from "./types";

export { StoryCriticalCarousel, type StoryCriticalCarouselProps } from "./StoryCriticalCarousel";
export { CriticalQuestions, type CriticalQuestionsProps } from "./CriticalQuestions";
export { WhySection, type WhySectionProps } from "./WhySection";
export { InvestigationSuggestions, type InvestigationSuggestionsProps } from "./InvestigationSuggestions";

export {
  buildInvestigationSuggestions,
  buildWhyParagraph,
  resolveCriticalQuestions,
  DEFAULT_WHY_TEXT,
} from "./criticalThinkingHelpers";
