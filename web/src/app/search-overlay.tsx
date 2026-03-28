"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAllStories } from "@/lib/generated";
import { useVoorbijDekop } from "./voorbijdekop-state";

function matchQuery(story: any, q: string) {
  if (!q) return true;
  const hay = [story.title ?? "", story.summary ?? "", story.ai?.narrative ?? ""].join("\n").toLowerCase();
  return hay.includes(q);
}

export function SearchOverlay() {
  const router = useRouter();
  const { searchOpen, closeSearch, query, setQuery } = useVoorbijDekop();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const stories = getAllStories();
    return stories
      .filter((s) => matchQuery(s, q))
      .slice(0, 12);
  }, [query]);

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
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, closeSearch]);

  const qTrim = query.trim();

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
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                router.push(`/story/${results[0].slug}`);
                closeSearch();
              }
            }}
            placeholder="Zoek in titel, samenvatting, verhaal…"
            aria-autocomplete="list"
            aria-controls="search-results-list"
            className="w-full rounded-xl bg-[var(--bg)] px-4 py-3 text-base leading-[1.375] font-medium font-['Helvetica Neue',Helvetica,Arial,sans-serif] text-[var(--text)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-red-900/30"
          />

          <div className="mt-4 max-h-[min(60vh,28rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--settings-panel-bg)] shadow-sm">
            {!qTrim ? (
              <p className="px-4 py-3 text-sm text-[var(--muted)]">Typ om verhalen te vinden. Enter opent het eerste resultaat.</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[var(--muted)]">Geen verhalen gevonden voor “{query.trim()}”.</p>
            ) : (
              <ul id="search-results-list" className="divide-y divide-[var(--border)] py-1" role="listbox">
                {results.map((s) => (
                  <li key={s.slug} role="option">
                    <Link
                      href={`/story/${s.slug}`}
                      onClick={() => closeSearch()}
                      className="block px-4 py-3 text-left hover:bg-[var(--settings-close-hover-bg)]"
                    >
                      <span className="block font-medium text-[var(--text)]">{s.shortHeadline ?? s.title}</span>
                      {(s.summary ?? "").toString().trim() ? (
                        <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[var(--muted)]">
                          {(s.summary ?? "").toString().slice(0, 160)}
                          {(s.summary ?? "").toString().length > 160 ? "…" : ""}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
