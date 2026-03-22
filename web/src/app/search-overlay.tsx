"use client";

import React, { useEffect, useRef } from "react";
import { useVoorbijDekop } from "./voorbijdekop-state";

export function SearchOverlay() {
  const { searchOpen, closeSearch, query, setQuery } = useVoorbijDekop();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!searchOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    inputRef.current?.focus();
    // Minimal: laat de gebruiker meteen typen, maar selecteer niet agressief.
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, closeSearch]);

  return (
    <div
      className={
        "fixed inset-0 z-[850] transition-opacity duration-200 " +
        (searchOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
      }
      style={{ backgroundColor: "var(--overlay-bg)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Zoeken"
      aria-hidden={!searchOpen}
      onPointerDown={(e) => {
        if (!searchOpen) return;
        if (e.target !== e.currentTarget) return;
        closeSearch();
      }}
    >
      <div
        className={
          "mx-auto w-full max-w-7xl px-4 pt-20 transition-transform duration-200 md:px-6 md:pt-24 " +
          (searchOpen ? "translate-y-0" : "-translate-y-2")
        }
      >
        <div className="w-full max-w-2xl">
          <input
            ref={inputRef}
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Zoek in titel, samenvatting, verhaal…"
            className="w-full rounded-xl bg-[var(--bg)] px-4 py-3 text-base leading-[1.375] font-medium font-['Helvetica Neue',Helvetica,Arial,sans-serif] text-[var(--text)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-red-900/30"
          />
        </div>
      </div>
    </div>
  );
}

