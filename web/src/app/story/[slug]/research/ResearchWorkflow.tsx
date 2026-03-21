"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { InvestigationSlide, QuickSourceLink } from "./types";
import {
  buildToolListItems,
  clampChecklistSteps,
  estimateMinutes,
  splitQuestionCard,
} from "./utils";
import { CollapsibleSection } from "./CollapsibleSection";
import { ProgressBar } from "./ProgressBar";
import { ResearchCard } from "./ResearchCard";
import { StepChecklist } from "./StepChecklist";
import { StickyActionBar } from "./StickyActionBar";
import { ToolsList } from "./ToolsList";

const TOTAL_STEPS = 3;
const STORAGE_PREFIX = "vd-research-checklist";

function keyFor(slug: string, inv: 0 | 1) {
  return `${STORAGE_PREFIX}:${slug}:inv${inv}`;
}

function CardIcon({ index }: { index: number }) {
  const v = index % 3;
  const cls = "h-6 w-6";
  if (v === 0) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );
  }
  if (v === 1) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function allChecked(checks: boolean[], n: number) {
  if (n === 0) return true;
  return checks.length === n && checks.every(Boolean);
}

type PanelProps = {
  inv: InvestigationSlide;
  index: number;
  checklistItems: string[];
  checked: boolean[];
  onToggle: (i: number) => void;
  sourceQuickLinks: QuickSourceLink[];
  toolsOpen: boolean;
  onToolsOpenChange: (v: boolean) => void;
  toolsAnchorRef: RefObject<HTMLDivElement | null>;
};

function InvestigationStepPanel({
  inv,
  index,
  checklistItems,
  checked,
  onToggle,
  sourceQuickLinks,
  toolsOpen,
  onToolsOpenChange,
  toolsAnchorRef,
}: PanelProps) {
  const minutes = estimateMinutes(checklistItems.length);
  const toolItems = useMemo(
    () => buildToolListItems(inv.tools ?? [], inv.resourceLinks ?? [], sourceQuickLinks),
    [inv, sourceQuickLinks]
  );

  const whyPreview = inv.why.replace(/\s+/g, " ").trim().slice(0, 140);
  const whyBody = <p className="max-w-prose text-sm leading-relaxed text-[var(--muted)]">{inv.why}</p>;

  return (
    <div className="rounded-xl border-2 border-blue-600/35 bg-blue-50/40 p-5 shadow-sm dark:border-blue-500/40 dark:bg-blue-950/25 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Onderzoek {index + 1}</p>
      <h3 className="mt-1 text-lg font-medium text-[var(--text)]">{inv.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">{inv.what}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">⏱ ca. {minutes} min</p>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-[var(--text)]">Checklist</h4>
        <p className="mt-1 text-xs text-[var(--muted)]">Vink af wat je gedaan hebt. Daarna kun je de stap voltooien.</p>
        <div className="mt-4">
          {checklistItems.length > 0 ? (
            <StepChecklist items={checklistItems} checked={checked} onToggle={onToggle} />
          ) : (
            <p className="text-sm text-[var(--muted)]">Geen deellijst voor deze richting; je kunt direct voltooien.</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <CollapsibleSection title="Waarom is dit belangrijk?" preview={whyPreview}>
          {whyBody}
        </CollapsibleSection>

        <div ref={toolsAnchorRef}>
          <CollapsibleSection
            title="Tools & aanpak"
            open={toolsOpen}
            onOpenChange={onToolsOpenChange}
            preview="OSINT-tools, dossierlinks en werkwijzen — open alleen wat je nodig hebt."
          >
            <p className="mb-4 text-xs text-[var(--muted)]">
              Alleen vrij toegankelijke bronnen. Klik een kaart om de tool of bron te openen.
            </p>
            <ToolsList items={toolItems} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

export type ResearchWorkflowProps = {
  slug: string;
  questions: string[];
  investigations: [InvestigationSlide | null, InvestigationSlide | null];
  sourceQuickLinks?: QuickSourceLink[];
};

export function ResearchWorkflow({
  slug,
  questions,
  investigations,
  sourceQuickLinks = [],
}: ResearchWorkflowProps) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const [workflowDone, setWorkflowDone] = useState(false);
  const [checkInv0, setCheckInv0] = useState<boolean[]>([]);
  const [checkInv1, setCheckInv1] = useState<boolean[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  const inv0 = investigations[0];
  const inv1 = investigations[1];

  const steps0 = useMemo(() => clampChecklistSteps(inv0?.steps ?? []), [inv0]);
  const steps1 = useMemo(() => clampChecklistSteps(inv1?.steps ?? []), [inv1]);

  useEffect(() => {
    const list = clampChecklistSteps(inv0?.steps ?? []);
    const n = list.length;
    setCheckInv0((prev) => {
      if (prev.length === n) return prev;
      try {
        const raw = localStorage.getItem(keyFor(slug, 0));
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed) && parsed.length === n) return parsed.map(Boolean);
        }
      } catch {
        /* ignore */
      }
      return Array(n).fill(false);
    });
  }, [slug, inv0]);

  useEffect(() => {
    const list = clampChecklistSteps(inv1?.steps ?? []);
    const n = list.length;
    setCheckInv1((prev) => {
      if (prev.length === n) return prev;
      try {
        const raw = localStorage.getItem(keyFor(slug, 1));
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed) && parsed.length === n) return parsed.map(Boolean);
        }
      } catch {
        /* ignore */
      }
      return Array(n).fill(false);
    });
  }, [slug, inv1]);

  useEffect(() => {
    if (steps0.length === 0) return;
    try {
      localStorage.setItem(keyFor(slug, 0), JSON.stringify(checkInv0));
    } catch {
      /* ignore */
    }
  }, [slug, checkInv0, steps0.length]);

  useEffect(() => {
    if (steps1.length === 0) return;
    try {
      localStorage.setItem(keyFor(slug, 1), JSON.stringify(checkInv1));
    } catch {
      /* ignore */
    }
  }, [slug, checkInv1, steps1.length]);

  const scrollToTop = useCallback(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [step, scrollToTop]);

  useEffect(() => {
    setToolsOpen(false);
  }, [step]);

  const currentInvestigation = step === 1 ? inv0 : step === 2 ? inv1 : null;
  const currentChecks = step === 1 ? checkInv0 : step === 2 ? checkInv1 : [];
  const currentN = step === 1 ? steps0.length : step === 2 ? steps1.length : 0;

  const checklistComplete =
    step === 0 || !currentInvestigation || allChecked(currentChecks, currentN);

  const openAllTools = () => {
    setToolsOpen(true);
    requestAnimationFrame(() => {
      toolsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const completeStep = () => {
    if (!checklistComplete || workflowDone) return;
    setCompleted((prev) => new Set([...prev, step]));
    if (step >= TOTAL_STEPS - 1) {
      setWorkflowDone(true);
      return;
    }
    setStep((s) => s + 1);
    setToolsOpen(false);
  };

  const toggleInv0 = (i: number) => {
    setCheckInv0((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const toggleInv1 = (i: number) => {
    setCheckInv1((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const goToResearch = () => {
    setStep(1);
    setToolsOpen(false);
  };

  const qs = questions.length ? questions : ["Geen onderzoeksvragen beschikbaar voor dit dossier."];

  return (
    <div ref={rootRef} className="relative pb-32">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        <span className="font-semibold text-[var(--text)]">OSINT</span> — openbare bronnen, legale methodes. Focus op de
        checklist; context en tools klappen je alleen open als je ze nodig hebt.
      </p>

      <div className="mt-6">
        <ProgressBar currentStepIndex={step} totalSteps={TOTAL_STEPS} completedStepIndices={completed} />
      </div>

      {step > 0 ? (
        <button
          type="button"
          onClick={() => {
            setStep((s) => Math.max(0, s - 1));
            setToolsOpen(false);
          }}
          className="mt-4 text-sm font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--text)] hover:underline"
        >
          ← Terug naar vorige stap
        </button>
      ) : null}

      <div className="mt-6 space-y-6">
        {step === 0 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Kies een onderzoeksspoor</h3>
              <p className="mt-2 max-w-prose text-sm text-[var(--muted)]">
                Elke kaart is een startpunt. Daarna doorloop je een korte checklist met optionele uitleg en tools.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-1">
              {qs.map((q, i) => {
                const { title, description } = splitQuestionCard(q);
                return (
                  <ResearchCard
                    key={i}
                    icon={<CardIcon index={i} />}
                    title={title}
                    description={description || q}
                    onStart={goToResearch}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 1 && inv0 ? (
          <InvestigationStepPanel
            inv={inv0}
            index={0}
            checklistItems={steps0}
            checked={checkInv0}
            onToggle={toggleInv0}
            sourceQuickLinks={sourceQuickLinks}
            toolsOpen={toolsOpen}
            onToolsOpenChange={setToolsOpen}
            toolsAnchorRef={toolsRef}
          />
        ) : null}

        {step === 1 && !inv0 ? (
          <p className="rounded-xl border border-gray-200 bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)] dark:border-[var(--card-border)]">
            Geen eerste onderzoeksrichting beschikbaar. Gebruik &quot;Voltooi stap&quot; om verder te gaan.
          </p>
        ) : null}

        {step === 2 && inv1 ? (
          <InvestigationStepPanel
            inv={inv1}
            index={1}
            checklistItems={steps1}
            checked={checkInv1}
            onToggle={toggleInv1}
            sourceQuickLinks={sourceQuickLinks}
            toolsOpen={toolsOpen}
            onToolsOpenChange={setToolsOpen}
            toolsAnchorRef={toolsRef}
          />
        ) : null}

        {step === 2 && !inv1 ? (
          <p className="rounded-xl border border-gray-200 bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)] dark:border-[var(--card-border)]">
            Geen tweede onderzoeksrichting beschikbaar. Gebruik &quot;Voltooi stap&quot; om af te ronden.
          </p>
        ) : null}
      </div>

      {workflowDone ? (
        <p className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Alle stappen doorlopen — mooi werk. Je kunt checklist-status en tools hierboven nog gebruiken zolang je op deze
          pagina blijft.
        </p>
      ) : null}

      {!workflowDone ? (
        <StickyActionBar
          onCompleteStep={completeStep}
          onOpenAllTools={openAllTools}
          completeDisabled={!checklistComplete}
          showToolsButton={step === 1 || step === 2}
          isLastStep={step === TOTAL_STEPS - 1}
        />
      ) : null}
    </div>
  );
}
