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

  const TOPICS_GAP_PX = 24; // gap-6
  const topicsViewportRef = useRef<HTMLDivElement | null>(null);
  const topicsMeasureRowRef = useRef<HTMLDivElement | null>(null);
  const topicsDragRef = useRef<{ isDown: boolean; startX: number; startScrollLeft: number }>({
    isDown: false,
    startX: 0,
    startScrollLeft: 0
  });
  const [viewportWidthPx, setViewportWidthPx] = useState(0);
  const [topicWidths, setTopicWidths] = useState<Record<string, number>>({});
  const [restStartIndex, setRestStartIndex] = useState(0);

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

  // Zet navigatie terug naar het begin bij datasetwijzigingen.
  useEffect(() => {
    setRestStartIndex(0);
  }, [topicsFiltered]);

  useEffect(() => {
    if (topic === "alle") return;
    if (!topicSet.has(topic)) setTopic("alle");
  }, [topic, topicSet, setTopic]);

  const topicsFilteredIdsKey = useMemo(() => topicsFiltered.map(([id]) => id).join("|"), [topicsFiltered]);

  // Meet viewportbreedte voor het "windowed" navigatiebereik.
  useEffect(() => {
    const el = topicsViewportRef.current;
    if (!el) return;

    const update = () => setViewportWidthPx(el.clientWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [topicsFilteredIdsKey]);

  // Meet individuele topic-knoppen zodat we exact kunnen bepalen wat past.
  useEffect(() => {
    const row = topicsMeasureRowRef.current;
    if (!row) return;

    const nodes = Array.from(row.querySelectorAll<HTMLElement>("[data-topic-id]"));
    const next: Record<string, number> = {};
    for (const n of nodes) {
      const id = n.getAttribute("data-topic-id");
      if (!id) continue;
      next[id] = n.getBoundingClientRect().width;
    }
    setTopicWidths(next);
  }, [topicsFilteredIdsKey]);

  const [navSidePadPx, setNavSidePadPx] = useState(24);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setNavSidePadPx(mq.matches ? 24 : 16);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const { visibleTopics, atStart, atEnd, stepPxVisibleCount } = useMemo(() => {
    const list = topicsFiltered;
    const len = list.length;

    if (len === 0) {
      return {
        visibleTopics: [] as Array<[TopicId, string]>,
        atStart: true,
        atEnd: true,
        stepPxVisibleCount: 1
      };
    }

    const start = Math.min(Math.max(0, restStartIndex), Math.max(0, len - 1));

    // beschikbare ruimte (gecompenseerd voor de zijkant padding op het scherm)
    const available = Math.max(0, viewportWidthPx - 2 * navSidePadPx);

    // Fallback als we nog geen viewport/meting hebben
    if (viewportWidthPx <= 0) {
      const fallbackSlice = list.slice(start, start + 1);
      return {
        visibleTopics: fallbackSlice,
        atStart: start <= 0,
        atEnd: start + fallbackSlice.length >= len,
        stepPxVisibleCount: Math.max(1, fallbackSlice.length)
      };
    }

    let total = 0;
    const visible: Array<[TopicId, string]> = [];
    for (let i = start; i < len; i++) {
      const [id, label] = list[i];
      const w = topicWidths[id] ?? 0;
      const gap = visible.length === 0 ? 0 : TOPICS_GAP_PX;

      if (total + gap + w > available && visible.length > 0) break;

      if (total + gap + w > available && visible.length === 0) {
        // als een enkel item niet past, maar we tonen nog niets: toon toch 1 item
        visible.push([id, label]);
        total += gap + w;
        break;
      }

      visible.push([id, label]);
      total += gap + w;
    }

    // Zorg dat we altijd minstens 1 item tonen
    if (visible.length === 0) visible.push(list[start]);

    const step = visible.length;
    return {
      visibleTopics: visible,
      atStart: start <= 0,
      atEnd: start + step >= len,
      stepPxVisibleCount: Math.max(1, step)
    };
  }, [TOPICS_GAP_PX, navSidePadPx, topicsFiltered, restStartIndex, topicWidths, viewportWidthPx]);

  const showLeftFade = !atStart;
  const showRightFade = !atEnd;

  const onTopicsMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = topicsViewportRef.current;
    if (!el) return;
    topicsDragRef.current = {
      isDown: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft
    };
  };
  const onTopicsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = topicsViewportRef.current;
    if (!el || !topicsDragRef.current.isDown) return;
    const dx = e.clientX - topicsDragRef.current.startX;
    el.scrollLeft = topicsDragRef.current.startScrollLeft - dx;
  };
  const onTopicsMouseUp = () => {
    topicsDragRef.current.isDown = false;
  };

  // Zorg dat de actieve topic in het zicht komt.
  useEffect(() => {
    const activeIdx = topicsFiltered.findIndex(([id]) => id === topic);
    if (activeIdx < 0) return;

    if (activeIdx < restStartIndex) {
      setRestStartIndex(activeIdx);
      return;
    }

    if (activeIdx >= restStartIndex + stepPxVisibleCount) {
      setRestStartIndex(Math.max(0, activeIdx - stepPxVisibleCount + 1));
    }
  }, [topic, topicsFiltered, restStartIndex, stepPxVisibleCount]);

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

        {/* Row 2: Topic navigation (windowed pagination, NOS-like) */}
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 pb-3 md:gap-6 md:px-6">
          <div className="relative flex-1">
            {showLeftFade ? (
              <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-[var(--nav-fade-bg)] to-transparent" />
            ) : null}
            {showRightFade ? (
              <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[var(--nav-fade-bg)] to-transparent" />
            ) : null}

            {showLeftFade ? (
              <button
                type="button"
                onClick={() =>
                  setRestStartIndex((cur) => Math.max(0, cur - stepPxVisibleCount))
                }
                aria-label="Vorige topics"
                className="absolute left-0 top-1/2 z-20 pointer-events-auto flex h-11 w-11 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full border border-[var(--nav-arrow-border)] bg-[var(--nav-arrow-bg)] text-[var(--nav-arrow-fg)] transition-colors hover:bg-[var(--nav-arrow-bg-hover)] md:z-10 md:h-9 md:w-9"
              >
                <svg
                  fill="currentColor"
                  width="14"
                  height="14"
                  viewBox="0 0 15 15"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="block -rotate-180 transform"
                >
                  <path
                    d="M8.29289 2.29289C8.68342 1.90237 9.31658 1.90237 9.70711 2.29289L14.2071 6.79289C14.5976 7.18342 14.5976 7.81658 14.2071 8.20711L9.70711 12.7071C9.31658 13.0976 8.68342 13.0976 8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929L11 8.5H1.5C0.947715 8.5 0.5 8.05228 0.5 7.5C0.5 6.94772 0.947715 6.5 1.5 6.5H11L8.29289 3.70711C7.90237 3.31658 7.90237 2.68342 8.29289 2.29289Z"
                  />
                </svg>
              </button>
            ) : null}

            {showRightFade ? (
              <button
                type="button"
                onClick={() =>
                  setRestStartIndex((cur) =>
                    Math.min(
                      Math.max(0, topicsFiltered.length - stepPxVisibleCount),
                      cur + stepPxVisibleCount
                    )
                  )
                }
                aria-label="Volgende topics"
                className="absolute right-0 top-1/2 z-20 pointer-events-auto flex h-11 w-11 -translate-y-1/2 -translate-x-1 items-center justify-center rounded-full border border-[var(--nav-arrow-border)] bg-[var(--nav-arrow-bg)] text-[var(--nav-arrow-fg)] transition-colors hover:bg-[var(--nav-arrow-bg-hover)] md:z-10 md:h-9 md:w-9"
              >
                <svg
                  fill="currentColor"
                  width="14"
                  height="14"
                  viewBox="0 0 15 15"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="block"
                >
                  <path
                    d="M8.29289 2.29289C8.68342 1.90237 9.31658 1.90237 9.70711 2.29289L14.2071 6.79289C14.5976 7.18342 14.5976 7.81658 14.2071 8.20711L9.70711 12.7071C9.31658 13.0976 8.68342 13.0976 8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929L11 8.5H1.5C0.947715 8.5 0.5 8.05228 0.5 7.5C0.5 6.94772 0.947715 6.5 1.5 6.5H11L8.29289 3.70711C7.90237 3.31658 7.90237 2.68342 8.29289 2.29289Z"
                  />
                </svg>
              </button>
            ) : null}

            <div
              ref={topicsViewportRef}
              onMouseDown={onTopicsMouseDown}
              onMouseMove={onTopicsMouseMove}
              onMouseUp={onTopicsMouseUp}
              onMouseLeave={onTopicsMouseUp}
              className={
                "no-scrollbar cursor-grab active:cursor-grabbing overflow-x-auto " +
                (showLeftFade ? "pl-4 md:pl-6 " : "") +
                (showRightFade ? "pr-4 md:pr-6" : "")
              }
            >
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none md:gap-6">
                {visibleTopics.map(([id, label]) => {
                  const active = topic === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTopic(id)}
                      className={
                        "relative min-h-11 shrink-0 whitespace-nowrap py-2 text-base font-medium leading-[1.375] font-['Helvetica Neue',Helvetica,Arial,sans-serif] transition-colors md:min-h-0 md:py-0 md:pb-1 " +
                        (active ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]") +
                        " after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-red-900/80 after:transition-transform after:duration-200 " +
                        (active ? "after:scale-x-100" : "hover:after:scale-x-100")
                      }
                      aria-current={active ? "page" : undefined}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Hidden measurement row (voor exact fitten zonder cut-off) */}
        <div ref={topicsMeasureRowRef} className="pointer-events-none absolute left-0 top-0 opacity-0">
          <div className="flex items-center gap-4 whitespace-nowrap md:gap-6">
            {topicsFiltered.map(([id, label]) => {
              const active = topic === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-topic-id={id}
                  onClick={() => setTopic(id)}
                  className={
                    "relative min-h-11 shrink-0 whitespace-nowrap py-2 text-base font-medium leading-[1.375] font-['Helvetica Neue',Helvetica,Arial,sans-serif] transition-colors md:min-h-0 md:py-0 md:pb-1 " +
                    (active ? "text-[var(--text)]" : "text-[var(--muted)]")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

