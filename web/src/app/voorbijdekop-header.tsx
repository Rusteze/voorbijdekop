/* Global, newspaper-style header */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GeneratedStory } from "@/lib/generated";
import { getAllStories } from "@/lib/generated";
import { useVoorbijDekop } from "./voorbijdekop-state";

type TopicId = NonNullable<GeneratedStory["topic"]> | "alle";

const TOPICS: Array<[TopicId, string]> = [
  ["alle", "Alle"],
  ["overig", "Overig"],
  ["geopolitiek", "Geopolitiek"],
  ["conflict", "Conflict"],
  ["oorlog", "Oorlog"],
  ["spionage", "Spionage"],
  ["inlichtingen", "Inlichtingen"],
  ["diplomatie", "Diplomatie"],
  ["sancties", "Sancties"],
  ["handelsconflict", "Handelsconflict"],
  ["energiepolitiek", "Energiepolitiek"],
  ["defensie", "Defensie"],
  ["militaire strategie", "Militaire strategie"],
  ["cyberoorlog", "Cyberoorlog"],
  ["hybride oorlog", "Hybride oorlog"],
  ["propaganda", "Propaganda"],
  ["desinformatie", "Desinformatie"],
  ["beïnvloeding", "Beïnvloeding"],
  ["technologische macht", "Technologische macht"],
  ["politieke instabiliteit", "Politieke instabiliteit"],
  ["machtsverschuiving", "Machtsverschuiving"]
];

export function VoorbijDekopHeader() {
  const { topic, setTopic, settingsOpen, openSettings, closeSettings, searchOpen, openSearch, closeSearch } =
    useVoorbijDekop();

  const topicsViewportRef = useRef<HTMLDivElement | null>(null);

  const [allStories, setAllStories] = useState<GeneratedStory[]>(() => getAllStories());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/stories.json", { cache: "no-store" });
        if (!res.ok) return;
        const parsed = (await res.json()) as GeneratedStory[];
        if (!cancelled && Array.isArray(parsed)) setAllStories(parsed);
      } catch {
        // val terug op inline bootstrap-data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const topicSet = useMemo(() => {
    const s = new Set<string>();
    for (const st of allStories) {
      if (typeof st.topic === "string" && st.topic.trim().length > 0) s.add(st.topic);
    }
    return s;
  }, [allStories]);

  // Toon alleen topics die voorkomen in de huidige dataset.
  // Alle onderwerpen (incl. "Alle") vallen onder dezelfde windowed weergave.
  const topicsFiltered = useMemo(() => {
    return TOPICS.filter(([id]) => id === "alle" || topicSet.has(id));
  }, [topicSet]);

  useEffect(() => {
    if (topic === "alle") return;
    if (!topicSet.has(topic)) setTopic("alle");
  }, [topic, topicSet, setTopic]);


  const activeTopicLabel = useMemo(() => {
    const hit = TOPICS.find(([id]) => id === topic);
    return hit?.[1] ?? "Alle";
  }, [topic]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur">
        <div className="relative">
        {/* Row 1: Logo + Zoeken */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-6 md:py-4">
          <Link href="/" className="flex min-h-11 items-center gap-2 py-1 md:min-h-0 md:py-0">
            <span className="font-bold lowercase tracking-tight text-[var(--text)]">voorbijdekop</span>
            <span className="h-1.5 w-1.5 rounded-full bg-red-900/90" aria-hidden="true" />
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            {searchOpen ? (
              <span
                className="min-h-11 px-1 text-base font-medium leading-[1.375] text-[var(--muted)] font-['Helvetica Neue',Helvetica,Arial,sans-serif] md:min-h-0 md:px-0"
              >
                Zoeken: {activeTopicLabel}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (settingsOpen) closeSettings();
                  openSearch();
                }}
                className="min-h-11 rounded-md px-2 text-base font-medium leading-[1.375] text-[var(--muted)] font-['Helvetica Neue',Helvetica,Arial,sans-serif] hover:text-red-900 hover:underline hover:underline-offset-4 md:min-h-0 md:px-0"
              >
                Zoeken
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                closeSearch();
                openSettings();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--settings-close-hover-bg)] hover:text-[var(--text)] md:h-auto md:w-auto md:p-2"
              aria-label="Instellingen"
              aria-expanded={settingsOpen}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1024 1024"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M600.704 64a32 32 0 0130.464 22.208l35.2 109.376c14.784 7.232 28.928 15.36 42.432 24.512l112.384-24.192a32 32 0 0134.432 15.36L944.32 364.8a32 32 0 01-4.032 37.504l-77.12 85.12a357.12 357.12 0 010 49.024l77.12 85.248a32 32 0 014.032 37.504l-88.704 153.6a32 32 0 01-34.432 15.296L708.8 803.904c-13.44 9.088-27.648 17.28-42.368 24.512l-35.264 109.376A32 32 0 01600.704 960H423.296a32 32 0 01-30.464-22.208L357.696 828.48a351.616 351.616 0 01-42.56-24.64l-112.32 24.256a32 32 0 01-34.432-15.36L79.68 659.2a32 32 0 014.032-37.504l77.12-85.248a357.12 357.12 0 010-48.896l-77.12-85.248A32 32 0 0179.68 364.8l88.704-153.6a32 32 0 0134.432-15.296l112.32 24.256c13.568-9.152 27.776-17.408 42.56-24.64l35.2-109.312A32 32 0 01423.232 64H600.64zm-23.424 64H446.72l-36.352 113.088-24.512 11.968a294.113 294.113 0 00-34.816 20.096l-22.656 15.36-116.224-25.088-65.28 113.152 79.68 88.192-1.92 27.136a293.12 293.12 0 000 40.192l1.92 27.136-79.808 88.192 65.344 113.152 116.224-25.024 22.656 15.296a294.113 294.113 0 0034.816 20.096l24.512 11.968L446.72 896h130.688l36.48-113.152 24.448-11.904a288.282 288.282 0 0034.752-20.096l22.592-15.296 116.288 25.024 65.28-113.152-79.744-88.192 1.92-27.136a293.12 293.12 0 000-40.256l-1.92-27.136 79.808-88.128-65.344-113.152-116.288 24.96-22.592-15.232a287.616 287.616 0 00-34.752-20.096l-24.448-11.904L577.344 128zM512 320a192 192 0 110 384 192 192 0 010-384zm0 64a128 128 0 100 256 128 128 0 000-256z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: Topics als chips (snap scroll) */}
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pb-3 md:gap-4 md:px-6">
          <div ref={topicsViewportRef} className="no-scrollbar flex-1 overflow-x-auto">
            <div className="flex items-center gap-2 snap-x snap-mandatory pr-2 md:gap-3">
              {topicsFiltered.map(([id, label]) => {
                const active = topic === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTopic(id)}
                    className={
                      "snap-start whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition-colors md:py-1.5 " +
                      (active
                        ? "border-red-900/30 bg-red-900/10 text-red-900 dark:border-red-200/30 dark:bg-red-200/10 dark:text-red-100"
                        : "border-[var(--border)] bg-white/60 text-[var(--muted)] hover:text-[var(--text)] dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:text-zinc-100")
                    }
                    aria-current={active ? "page" : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {topic !== "alle" ? (
            <button
              type="button"
              onClick={() => setTopic("alle")}
              className="shrink-0 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 md:py-1.5"
              aria-label="Reset topic filter"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

