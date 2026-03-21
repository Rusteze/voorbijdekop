"use client";

import React, { useEffect, useRef } from "react";
import { ThemeSwitcher } from "./theme-switcher";
import { useVoorbijDekop } from "./voorbijdekop-state";

export function ThemeSettingsOverlay() {
  const { settingsOpen, closeSettings } = useVoorbijDekop();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, closeSettings]);

  return (
    <>
      <div
        className={
          "fixed inset-0 z-[999] bg-[var(--overlay-bg)] transition-opacity duration-200 " +
          (settingsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
        }
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) closeSettings();
        }}
        aria-hidden={!settingsOpen}
      />

      <div
        ref={panelRef}
        className={
          "fixed right-0 top-0 z-[1000] h-screen w-[320px] border-l border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] transition-transform duration-200 ease-out " +
          (settingsOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none")
        }
        role="dialog"
        aria-modal="true"
        aria-label="Instellingen"
        aria-hidden={!settingsOpen}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-6 pt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Instellingen</div>
          <button
            type="button"
            onClick={closeSettings}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--settings-close-hover-bg)] hover:text-[var(--text)]"
            aria-label="Sluit instellingen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6">
          <ThemeSwitcher />
        </div>
      </div>
    </>
  );
}

