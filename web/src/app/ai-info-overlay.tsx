"use client";

import React, { useEffect, useRef } from "react";
import { useVoorbijDekop } from "./voorbijdekop-state";

export function AiInfoOverlay() {
  const { aiInfoOpen, closeAiInfo } = useVoorbijDekop();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aiInfoOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [aiInfoOpen]);

  useEffect(() => {
    if (!aiInfoOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAiInfo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aiInfoOpen, closeAiInfo]);

  return (
    <div
      className={
        "fixed inset-0 z-[820] transition-opacity duration-200 " +
        (aiInfoOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
      }
      style={{ backgroundColor: "var(--overlay-bg)" }}
      onPointerDown={(e) => {
        if (!aiInfoOpen) return;
        if (e.target === e.currentTarget) closeAiInfo();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Uitleg AI-analyse"
      aria-hidden={!aiInfoOpen}
    >
      <div
        ref={panelRef}
        className="mx-auto mt-20 max-w-2xl rounded-2xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Uitleg</div>
            <div className="mt-2 text-lg font-semibold text-[var(--text)]">Hoe AI dit gebruikt</div>
          </div>
          <button
            type="button"
            onClick={closeAiInfo}
            className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--settings-close-hover-bg)] hover:text-[var(--text)]"
            aria-label="Sluit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-3 text-[13px] leading-6 text-[var(--muted)]">
          <p>
            Voor elk verhaal leest de AI de geselecteerde nieuwsberichten en zet die om naar één{" "}
            <span className="font-medium text-[var(--text)]">doorlopend verhaal</span> met{" "}
            <span className="font-medium text-[var(--text)]">belangrijkste punten</span> (waar beschikbaar). Onderaan
            zie je welke bronnen zijn gebruikt en wanneer die gepubliceerd zijn.
          </p>
          <p>
            Het onderwerp (bijvoorbeeld geopolitiek of defensie) is een <span className="font-medium text-[var(--text)]">classificatie</span>{" "}
            om vergelijkbare verhalen te groeperen en te filteren op de voorpagina — geen oordeel over waarheid of mening.
          </p>
          <p>
            Dit is bedoeld als overzicht en startpunt: controleer altijd zelf de originele bronnen, vooral bij gevoelige of
            snel veranderende situaties.
          </p>
        </div>
      </div>
    </div>
  );
}
