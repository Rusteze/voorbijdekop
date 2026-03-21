export type InvestigationResourceLink = {
  label: string;
  url: string;
  note?: string;
};

export type InvestigationToolPill = {
  label: string;
  url?: string;
};

export type InvestigationSlide = {
  title: string;
  what: string;
  why: string;
  steps: string[];
  tools: (string | InvestigationToolPill)[];
  resourceLinks?: InvestigationResourceLink[];
};

export type QuickSourceLink = { label: string; url: string };

export type ToolListItem = {
  label: string;
  url?: string;
  note?: string;
  category: string;
};
