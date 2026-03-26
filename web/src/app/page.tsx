"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAllStories } from "@/lib/generated";
import { getFallbackImage } from "@/lib/fallbackImage";
import { getStoryLastUpdated, formatRelativeStoryTime } from "@/lib/storyUtils";
import { useVoorbijDekop } from "./voorbijdekop-state";

function prettySourceDomain(domain: string) {
  const d = (domain ?? "").toLowerCase();
  if (!d) return "bron";
  if (d === "nos.nl") return "NOS";
  if (d === "bbc.com" || d === "bbc.co.uk") return "BBC";
  if (d === "theguardian.com") return "The Guardian";
  if (d === "reuters.com" || d === "reutersbest.com") return "Reuters";
  if (d.endsWith("nrc.nl")) return "NRC";
  if (d === "volkskrant.nl") return "De Volkskrant";
  if (d === "trouw.nl") return "Trouw";
  if (d === "apnews.com") return "AP News";
  if (d === "aljazeera.com") return "Al Jazeera";
  if (d === "dw.com") return "DW";
  if (d === "france24.com") return "France 24";
  if (d === "ft.com") return "Financial Times";
  if (d === "feeds.rijksoverheid.nl" || d === "rijksoverheid.nl") return "Rijksoverheid";
  if (d === "thecipherbrief.com") return "The Cipher Brief";
  if (d === "warontherocks.com") return "War on the Rocks";
  if (d === "defence-blog.com") return "Defence Blog";
  if (d === "globalissues.org") return "Global Issues";
  return domain;
}

function canonicalizeSourceDomain(domain: string) {
  const d = (domain ?? "").toLowerCase().trim();
  if (!d) return d;
  // NRC RSS/distributie gebruikt meerdere subdomeinen, canoniseer naar nrc.nl.
  if (d === "ipad.nrc.nl" || d === "vorige.nrc.nl") return "nrc.nl";
  if (d.endsWith(".nrc.nl")) return "nrc.nl";
  // Reuters heeft alternatieve RSS endpoints; canoniseer naar main domein.
  if (d === "reutersbest.com") return "reuters.com";
  // BBC items komen soms op bbc.com, soms op bbc.co.uk.
  if (d === "bbc.com") return "bbc.co.uk";
  if (d === "feeds.rijksoverheid.nl") return "rijksoverheid.nl";
  return d;
}

function isDutchSourceDomain(domain: string) {
  const d = (domain ?? "").toLowerCase();
  return d.endsWith(".nl") || d === "rijksoverheid.nl";
}

function sourceLogoUrl(canonicalDomain: string) {
  const d = canonicalizeSourceDomain(canonicalDomain);
  const fromKnown: Record<string, string> = {
    "nos.nl": "https://www.nos.nl/favicon.ico",
    "nrc.nl": "https://www.nrc.nl/favicon.ico",
    "volkskrant.nl": "https://www.volkskrant.nl/favicon.ico",
    "trouw.nl": "https://www.trouw.nl/favicon.ico",
    "bbc.co.uk": "https://www.bbc.co.uk/favicon.ico",
    "reuters.com": "https://www.reuters.com/favicon.ico",
    "theguardian.com": "https://www.theguardian.com/favicon.ico",
    "aljazeera.com": "https://www.aljazeera.com/favicon.ico",
    "apnews.com": "https://www.apnews.com/favicon.ico",
    "ft.com": "https://www.ft.com/favicon.ico",
    "dw.com": "https://www.dw.com/favicon.ico",
    "france24.com": "https://www.france24.com/favicon.ico",
    "rijksoverheid.nl": "https://www.rijksoverheid.nl/favicon.ico",
    "thecipherbrief.com": "https://www.thecipherbrief.com/favicon.ico",
    "warontherocks.com": "https://warontherocks.com/favicon.ico",
    "defence-blog.com": "https://defence-blog.com/favicon.ico",
    "globalissues.org": "https://www.globalissues.org/favicon.ico"
  };

  return fromKnown[d] ?? `https://${d}/favicon.ico`;
}

const SOURCE_PRIORITY: string[] = [
  "nos.nl",
  "bbc.co.uk",
  "reuters.com",
  "nrc.nl",
  "volkskrant.nl",
  "trouw.nl",
  "ft.com",
  "theguardian.com",
  "aljazeera.com",
  "apnews.com",
  "dw.com",
  "france24.com",
  "rijksoverheid.nl",
  "thecipherbrief.com",
  "warontherocks.com",
  "defence-blog.com",
  "globalissues.org"
];

function sourceSort(aCanonicalDomain: string, bCanonicalDomain: string) {
  const a = canonicalizeSourceDomain(aCanonicalDomain);
  const b = canonicalizeSourceDomain(bCanonicalDomain);
  const ai = SOURCE_PRIORITY.indexOf(a);
  const bi = SOURCE_PRIORITY.indexOf(b);

  const aInKnown = ai !== -1;
  const bInKnown = bi !== -1;

  if (aInKnown || bInKnown) {
    // Bekendste merken eerst (zoals de gebruikersvraag vraagt).
    if (aInKnown && bInKnown) return ai - bi;
    return aInKnown ? -1 : 1;
  }

  // Overigen: NL eerst, dan alphabetisch op label.
  const anl = isDutchSourceDomain(a) ? 0 : 1;
  const bnl = isDutchSourceDomain(b) ? 0 : 1;
  if (anl !== bnl) return anl - bnl;
  return prettySourceDomain(a).localeCompare(prettySourceDomain(b), "nl");
}

function SourceLogoMark({ src, label, selected }: { src: string; label: string; selected: boolean }) {
  const [broken, setBroken] = useState(false);
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  if (broken) {
    return (
      <span
        className={
          "inline-flex h-6 items-center justify-center rounded-md border bg-white/20 px-1 text-[10px] font-semibold " +
          (selected ? "border-[var(--border)] text-[var(--text)]" : "border-transparent text-[var(--muted)]")
        }
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={"h-6 w-auto object-contain " + (!selected ? "grayscale opacity-70" : "opacity-100")}
    />
  );
}

function storySourceLabel(s: any) {
  const domains = Array.from(
    new Set(((s?.articles ?? []) as any[]).map((a) => a?.sourceDomain).filter(Boolean))
  );
  if (domains.length === 1) return prettySourceDomain(domains[0] as string);
  return `${domains.length} bronnen`;
}

function categoryLabel(cat: string) {
  switch (cat) {
    case "geopolitiek":
      return "Geopolitiek";
    case "economie":
      return "Economie";
    case "technologie":
      return "Technologie";
    case "samenleving":
      return "Samenleving";
    case "sport":
      return "Sport";
    default:
      return "Overig";
  }
}

function categoryClass(cat: string) {
  // subtiele accentkleur per categorie
  switch (cat) {
    case "geopolitiek":
      return "bg-blue-50 text-blue-800 ring-blue-900/10";
    case "economie":
      return "bg-emerald-50 text-emerald-800 ring-emerald-900/10";
    case "technologie":
      return "bg-violet-50 text-violet-800 ring-violet-900/10";
    case "samenleving":
      return "bg-amber-50 text-amber-900 ring-amber-900/10";
    case "sport":
      return "bg-rose-50 text-rose-800 ring-rose-900/10";
    default:
      return "bg-zinc-50 text-zinc-700 ring-zinc-900/10";
  }
}

function topicLabel(tp?: string | null) {
  switch (tp) {
    case "overig":
      return "Overig";
    case "geopolitiek":
      return "Geopolitiek";
    case "conflict":
      return "Conflict";
    case "oorlog":
      return "Oorlog";
    case "spionage":
      return "Spionage";
    case "inlichtingen":
      return "Inlichtingen";
    case "diplomatie":
      return "Diplomatie";
    case "sancties":
      return "Sancties";
    case "handelsconflict":
      return "Handelsconflict";
    case "energiepolitiek":
      return "Energiepolitiek";
    case "defensie":
      return "Defensie";
    case "militaire strategie":
      return "Militaire strategie";
    case "cyberoorlog":
      return "Cyberoorlog";
    case "hybride oorlog":
      return "Hybride oorlog";
    case "propaganda":
      return "Propaganda";
    case "desinformatie":
      return "Desinformatie";
    case "beïnvloeding":
      return "Beïnvloeding";
    case "technologische macht":
      return "Technologische macht";
    case "politieke instabiliteit":
      return "Politieke instabiliteit";
    case "machtsverschuiving":
      return "Machtsverschuiving";
    default:
      return "Overig";
  }
}

function extractInsightPreview(s: any) {
  const narrative = (s?.ai?.narrative ?? "").toString();
  if (!narrative) return null;

  const parts = narrative
    .split(/\n{2,}/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  const idx = parts.findIndex((p: string) => /^wat hier opvalt\b/i.test(p));
  const text = idx >= 0 ? (parts[idx + 1] ?? "") : "";
  if (!text) return null;

  const sentenceMatch = text.match(/^(.{15,240}?[.!?])(\s|$)/);
  const sentence = (sentenceMatch?.[1] ?? text).trim();
  return sentence.length > 180 ? sentence.slice(0, 177).trimEnd() + "…" : sentence;
}

function pickCipherPreferredImage(story: any) {
  const SKIP_IMAGE_DOMAINS = new Set(["thecipherbrief.com", "rijksoverheid.nl", "feeds.rijksoverheid.nl"]);
  const articles: any[] = Array.isArray(story?.articles) ? story.articles : [];
  const hasSkip = articles.some((a: any) => SKIP_IMAGE_DOMAINS.has(a?.sourceDomain));
  if (!hasSkip) return story?.imageUrl;

  const others = articles
    .filter((a: any) => !SKIP_IMAGE_DOMAINS.has(a?.sourceDomain))
    .filter((a: any) => typeof a?.imageUrl === "string" && a.imageUrl.trim().length > 0);

  if (others.length === 0) return undefined;

  const best = [...others].sort((a: any, b: any) => {
    const at = new Date(a?.publishedAt ?? "").getTime();
    const bt = new Date(b?.publishedAt ?? "").getTime();
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  })[0];

  return best?.imageUrl;
}

function firstSentence(text?: string | null) {
  const t = (text ?? "").toString().trim();
  if (!t) return "";
  const m = t.match(/^(.{10,220}?[.!?])(\s|$)/);
  return (m?.[1] ?? t).trim();
}

export default function Home() {
  const { query, topic, setTopic, openAiInfo } = useVoorbijDekop();
  const [sourceFilter, setSourceFilter] = useState<string>("alle");
  const [visibleCount, setVisibleCount] = useState(20);
  const [storiesRuntime, setStoriesRuntime] = useState<any[]>(() => getAllStories());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [autoHighlightTick, setAutoHighlightTick] = useState(0);

  const sourcesViewportRef = useRef<HTMLDivElement | null>(null);
  const sourcesMeasureRowRef = useRef<HTMLDivElement | null>(null);
  const sourcesDragRef = useRef<{ isDown: boolean; startX: number; startScrollLeft: number }>({
    isDown: false,
    startX: 0,
    startScrollLeft: 0
  });
  const [sourcesViewportWidthPx, setSourcesViewportWidthPx] = useState(0);
  const [sourceWidths, setSourceWidths] = useState<Record<string, number>>({});
  const [sourceStartIndex, setSourceStartIndex] = useState(0);
  const [navSidePadPx, setNavSidePadPx] = useState(24);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setNavSidePadPx(mq.matches ? 24 : 16);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Robuust tegen verouderde HTML-cache: laad altijd de actuele dataset na mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/stories.json", { cache: "no-store" });
        if (!res.ok) return;
        const parsed = (await res.json()) as any[];
        if (!cancelled && Array.isArray(parsed)) setStoriesRuntime(parsed);
      } catch {
        // stil falen; gebruik dan de inline bootstrap-data uit layout
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const storiesAllFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...storiesRuntime].sort((a, b) => {
      const imp = (b.importance ?? 0) - (a.importance ?? 0);
      if (imp !== 0) return imp;
      return getStoryLastUpdated(b) - getStoryLastUpdated(a);
    });

    const matchQuery = (s: any) => {
      if (!q) return true;
      const hay = [s.title ?? "", s.summary ?? "", s.ai?.narrative ?? ""].join("\n").toLowerCase();
      return hay.includes(q);
    };

    const matchSource = (s: any) => {
      if (sourceFilter === "alle") return true;
      const canon = sourceFilter;
      const arts: any[] = Array.isArray(s?.articles) ? s.articles : [];
      return arts.some((a) => canonicalizeSourceDomain(a?.sourceDomain ?? "") === canon);
    };

    return base.filter((s: any) => {
      if (topic !== "alle" && (s.topic ?? "overig") !== topic) return false;
      if (!matchQuery(s)) return false;
      if (!matchSource(s)) return false;
      return true;
    });
  }, [query, topic, sourceFilter, storiesRuntime]);

  const stories = useMemo(() => storiesAllFiltered.slice(0, visibleCount), [storiesAllFiltered, visibleCount]);
  const allStoriesLoaded = useMemo(() => storiesRuntime, [storiesRuntime]);

  useEffect(() => {
    console.log("stories loaded:", allStoriesLoaded.length);
    console.log("first story:", allStoriesLoaded[0]?.title);
  }, [allStoriesLoaded]);

  const filteredCount = storiesAllFiltered.length;

  useEffect(() => {
    setVisibleCount(20);
  }, [query, topic, sourceFilter]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const el = loadMoreRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        setVisibleCount((cur) => {
          const next = cur + 10;
          return next >= filteredCount ? filteredCount : next;
        });
      },
      { root: null, rootMargin: "800px 0px 0px 0px", threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [filteredCount]);

  // Bron-logos filter: toont alleen bronnen die passen bij query+topic
  const storiesForSourceLogos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...storiesRuntime].sort((a, b) => {
      const imp = (b.importance ?? 0) - (a.importance ?? 0);
      if (imp !== 0) return imp;
      return getStoryLastUpdated(b) - getStoryLastUpdated(a);
    });

    if (topic === "alle" && !q) return base;

    return base.filter((s: any) => {
      if (topic !== "alle" && (s.topic ?? "overig") !== topic) return false;
      if (!q) return true;
      const hay = [s.title ?? "", s.summary ?? "", s.ai?.narrative ?? ""].join("\n").toLowerCase();
      return hay.includes(q);
    });
  }, [query, topic, storiesRuntime]);

  const sourcesFiltered = useMemo(() => {
    const used = new Set<string>();
    for (const st of storiesForSourceLogos as any[]) {
      const arts: any[] = Array.isArray(st?.articles) ? st.articles : [];
      for (const a of arts) {
        const canon = canonicalizeSourceDomain(a?.sourceDomain ?? "");
        if (!canon) continue;
        used.add(canon);
      }
    }

    const ids = Array.from(used).sort(sourceSort);
    return [["alle", "Alle"] as const, ...ids.map((id) => [id, prettySourceDomain(id)] as const)];
  }, [storiesForSourceLogos]);

  const sourcesFilteredIdsKey = useMemo(() => sourcesFiltered.map(([id]) => id).join("|"), [sourcesFiltered]);

  // Zet window terug bij datasetwijzigingen.
  useEffect(() => {
    setSourceStartIndex(0);
  }, [sourcesFilteredIdsKey]);

  // Active bron moet blijven bestaan binnen de huidige dataset.
  useEffect(() => {
    if (sourceFilter === "alle") return;
    const exists = sourcesFiltered.some(([id]) => id === sourceFilter);
    if (!exists) setSourceFilter("alle");
  }, [sourcesFilteredIdsKey, sourceFilter, sourcesFiltered]);

  // Meet viewportbreedte voor "windowed" weergave.
  useEffect(() => {
    const el = sourcesViewportRef.current;
    if (!el) return;
    const update = () => setSourcesViewportWidthPx(el.clientWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [sourcesFilteredIdsKey]);

  // Meet individuele knopbreedtes om exact te kunnen fitten.
  useEffect(() => {
    const row = sourcesMeasureRowRef.current;
    if (!row) return;
    const nodes = Array.from(row.querySelectorAll<HTMLElement>("[data-source-id]"));
    const next: Record<string, number> = {};
    for (const n of nodes) {
      const id = n.getAttribute("data-source-id");
      if (!id) continue;
      next[id] = n.getBoundingClientRect().width;
    }
    setSourceWidths(next);
  }, [sourcesFilteredIdsKey]);

  const SOURCES_GAP_PX = 16;
  const { atStart, atEnd, stepPxVisibleCount } = useMemo(() => {
    const list = sourcesFiltered;
    const len = list.length;

    if (len === 0) {
      return {
        visibleSources: [] as Array<readonly [string, string]>,
        atStart: true,
        atEnd: true,
        stepPxVisibleCount: 1
      };
    }

    const start = Math.min(Math.max(0, sourceStartIndex), Math.max(0, len - 1));
    const available = Math.max(0, sourcesViewportWidthPx - 2 * navSidePadPx);

    if (sourcesViewportWidthPx <= 0) {
      const fallbackSlice = list.slice(start, start + 1);
      return {
        visibleSources: fallbackSlice,
        atStart: start <= 0,
        atEnd: start + fallbackSlice.length >= len,
        stepPxVisibleCount: Math.max(1, fallbackSlice.length)
      };
    }

    let total = 0;
    const visible: Array<readonly [string, string]> = [];
    for (let i = start; i < len; i++) {
      const [id] = list[i];
      const w = sourceWidths[id] ?? 0;
      const gap = visible.length === 0 ? 0 : SOURCES_GAP_PX;

      if (total + gap + w > available && visible.length > 0) break;
      if (total + gap + w > available && visible.length === 0) {
        visible.push(list[i]);
        total += gap + w;
        break;
      }
      visible.push(list[i]);
      total += gap + w;
    }

    if (visible.length === 0) visible.push(list[start]);
    const step = visible.length;

    return {
      visibleSources: visible,
      atStart: start <= 0,
      atEnd: start + step >= len,
      stepPxVisibleCount: Math.max(1, step)
    };
  }, [SOURCES_GAP_PX, navSidePadPx, sourcesFiltered, sourceWidths, sourceStartIndex, sourcesViewportWidthPx]);

  const showLeftFade = !atStart;
  const showRightFade = !atEnd;

  const onSourcesMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = sourcesViewportRef.current;
    if (!el) return;
    sourcesDragRef.current = {
      isDown: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft
    };
  };
  const onSourcesMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = sourcesViewportRef.current;
    if (!el || !sourcesDragRef.current.isDown) return;
    const dx = e.clientX - sourcesDragRef.current.startX;
    el.scrollLeft = sourcesDragRef.current.startScrollLeft - dx;
  };
  const onSourcesMouseUp = () => {
    sourcesDragRef.current.isDown = false;
  };

  // Zorg dat de actieve bron in het zicht komt.
  useEffect(() => {
    const activeIdx = sourcesFiltered.findIndex(([id]) => id === sourceFilter);
    if (activeIdx < 0) return;

    if (activeIdx < sourceStartIndex) {
      setSourceStartIndex(activeIdx);
      return;
    }
    if (activeIdx >= sourceStartIndex + stepPxVisibleCount) {
      setSourceStartIndex(Math.max(0, activeIdx - stepPxVisibleCount + 1));
    }
  }, [sourceFilter, sourcesFiltered, sourceStartIndex, stepPxVisibleCount]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const HIGHLIGHT_CANDIDATE_SET_SIZE = 5;
  const AUTO_HIGHLIGHT_ROTATE_EVERY_MS = 3 * 60 * 1000; // 3 min

  function hashStringToInt(input: string) {
    // Kleine deterministische hash (geen cryptografische behoefte).
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const highlightCandidates = useMemo(
    () => storiesAllFiltered.slice(0, HIGHLIGHT_CANDIDATE_SET_SIZE),
    [storiesAllFiltered]
  );

  const highlightCandidatesKey = useMemo(
    () => highlightCandidates.map((s: any) => s.slug).join("|"),
    [highlightCandidates]
  );

  useEffect(() => {
    // Reset highlight-rotatie bij datasetwijzigingen/filters.
    setAutoHighlightTick(0);

    if (highlightCandidates.length <= 1) return;

    const t = window.setInterval(() => {
      setAutoHighlightTick((cur) => cur + 1);
    }, AUTO_HIGHLIGHT_ROTATE_EVERY_MS);

    return () => window.clearInterval(t);
  }, [todayKey, query, topic, sourceFilter, highlightCandidatesKey]);

  const highlightSeedStr = `${todayKey}|${query.trim().toLowerCase()}|${topic}|${sourceFilter}|${highlightCandidatesKey}`;
  const highlightSeedIndex = highlightCandidates.length
    ? hashStringToInt(highlightSeedStr) % highlightCandidates.length
    : 0;
  const highlightSelectedIndex = highlightCandidates.length
    ? (highlightSeedIndex + autoHighlightTick) % highlightCandidates.length
    : 0;

  const highlightTop = highlightCandidates[highlightSelectedIndex] ?? stories[0] ?? null;

  const storiesOrdered = useMemo(() => {
    if (!highlightTop) return stories;
    // Zorg dat de hero niet dubbel in de eerste cards verschijnt.
    const filtered = stories.filter((s: any) => s.slug !== (highlightTop as any).slug);
    return [highlightTop, ...filtered];
  }, [stories, highlightTop]);

  const top = storiesOrdered[0] ?? null;
  const now = storiesOrdered.slice(1, 3);
  const rest = storiesOrdered.slice(3);
  const latestNews = [...storiesOrdered].sort((a, b) => getStoryLastUpdated(b) - getStoryLastUpdated(a)).slice(0, 10);

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-14">
        <div className="mb-8 space-y-4 md:mb-10 md:space-y-0">
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-zinc-950 md:mt-3 md:text-4xl">
            Het verhaal achter het nieuws
          </h1>
          <div className="inline-flex min-w-0 items-center gap-1 md:flex md:flex-wrap md:gap-2">
            <p className="min-w-0 text-sm leading-relaxed text-zinc-600 line-clamp-1 md:line-clamp-none md:whitespace-normal md:text-base md:leading-7">
              Analyse en context door AI op basis van meerdere betrouwbare bronnen
            </p>
            <button
              type="button"
              onClick={openAiInfo}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-zinc-600 transition hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)] md:h-5 md:w-5"
              aria-label="Uitleg AI-analyse"
            >
              <span aria-hidden="true" className="text-xs font-semibold leading-none md:text-[11px]">
                i
              </span>
            </button>
          </div>
          {topic !== "alle" || sourceFilter !== "alle" ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setTopic("alle");
                  setSourceFilter("alle");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Reset filters
              </button>
            </div>
          ) : null}
        </div>

        {stories.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-zinc-700 ring-1 ring-zinc-900/10">
            Nog geen stories gevonden. Draai eerst <code className="font-mono">npm run build:data</code>.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
            <div className="space-y-8 md:col-span-8 md:space-y-14">
            {top && (
              <section aria-label="Must-read">
                <Link href={`/story/${top.slug}`} className="mt-2 block" aria-label={top.title}>
                <article>
                  <div className="relative overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-900/10 md:rounded-2xl">
                    <div className="aspect-[16/9] w-full bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-200">
                      <img
                        src={
                          pickCipherPreferredImage(top) ||
                          getFallbackImage(top.topic ?? top.category)
                        }
                        alt=""
                        className="h-full w-full object-cover"
                        loading="eager"
                        decoding="async"
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/75 via-zinc-950/30 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-3 sm:px-8 sm:pb-8 sm:pt-5 md:px-8 md:pb-8 md:pt-5">
                      <div className="mx-auto max-w-5xl">
                        <h2
                          className="mt-0.5 mb-3.5 max-w-full font-semibold leading-[1.15] tracking-tight text-white drop-shadow-sm"
                          style={{ fontSize: "clamp(24px, 3vw, 40px)" }}
                        >
                          <span
                            className="block text-white line-clamp-2 md:line-clamp-3"
                            style={{
                              WebkitMaskImage:
                                "linear-gradient(to bottom, rgba(0,0,0,1) 92%, rgba(0,0,0,0) 100%)",
                              maskImage:
                                "linear-gradient(to bottom, rgba(0,0,0,1) 92%, rgba(0,0,0,0) 100%)",
                              WebkitMaskRepeat: "no-repeat",
                              maskRepeat: "no-repeat",
                              WebkitMaskSize: "100% 100%",
                              maskSize: "100% 100%"
                            }}
                          >
                            {top.shortHeadline ?? top.title}
                          </span>
                        </h2>

                      </div>
                    </div>
                  </div>
                </article>
                </Link>
              </section>
            )}

            {/* Bron-logos filter (windowed, NOS-like) */}
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-500">Bronnen</div>

              <div className="relative mt-4">
                {showLeftFade ? (
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-[var(--nav-fade-bg)] to-transparent" />
                ) : null}
                {showRightFade ? (
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[var(--nav-fade-bg)] to-transparent" />
                ) : null}

                {showLeftFade ? (
                  <button
                    type="button"
                    onClick={() => setSourceStartIndex((cur) => Math.max(0, cur - stepPxVisibleCount))}
                    aria-label="Vorige bronnen"
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
                      setSourceStartIndex((cur) =>
                        Math.min(Math.max(0, sourcesFiltered.length - stepPxVisibleCount), cur + stepPxVisibleCount)
                      )
                    }
                    aria-label="Volgende bronnen"
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
                  ref={sourcesViewportRef}
                  onMouseDown={onSourcesMouseDown}
                  onMouseMove={onSourcesMouseMove}
                  onMouseUp={onSourcesMouseUp}
                  onMouseLeave={onSourcesMouseUp}
                  className={
                    "no-scrollbar cursor-grab active:cursor-grabbing overflow-x-auto " +
                    (showLeftFade ? "pl-4 md:pl-6 " : "") +
                    (showRightFade ? "pr-4 md:pr-6" : "")
                  }
                >
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 md:gap-4">
                    {sourcesFiltered.map(([id, label]) => {
                      const active = sourceFilter === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          data-source-id={id}
                          title={label}
                          onClick={() => setSourceFilter(id)}
                          aria-current={active ? "page" : undefined}
                          className={
                            "relative flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 transition-colors md:h-9 md:min-h-0 md:min-w-0 md:px-2 " +
                            (active
                              ? "text-[var(--text)] ring-1 ring-[var(--border)]"
                              : "text-[var(--muted)] hover:text-[var(--text)]")
                          }
                        >
                          {id === "alle" ? (
                            <span className={"text-xs font-semibold " + (active ? "text-[var(--text)]" : "")}>
                              {label}
                            </span>
                          ) : (
                            <SourceLogoMark
                              src={sourceLogoUrl(id)}
                              label={label}
                              selected={active}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hidden measurement row (voor exact fitten zonder cut-off) */}
                <div ref={sourcesMeasureRowRef} className="pointer-events-none absolute left-0 top-0 opacity-0">
                  <div className="flex items-center gap-4 whitespace-nowrap">
                    {sourcesFiltered.map(([id, label]) => {
                      const active = sourceFilter === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          data-source-id={id}
                          title={label}
                          onClick={() => setSourceFilter(id)}
                          tabIndex={-1}
                          aria-hidden="true"
                          className={
                            "relative flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 transition-colors md:h-9 md:min-h-0 md:min-w-0 md:px-2 " +
                            (active
                              ? "text-[var(--text)] ring-1 ring-[var(--border)]"
                              : "text-[var(--muted)]")
                          }
                        >
                          {id === "alle" ? (
                            <span className={"text-xs font-semibold " + (active ? "text-[var(--text)]" : "")}>
                              {label}
                            </span>
                          ) : (
                            <SourceLogoMark src={sourceLogoUrl(id)} label={label} selected={active} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {now.length > 0 && (
              <section>
                <div className="text-xs font-semibold tracking-wide text-zinc-500">Wat speelt er nu</div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:mt-5 md:grid-cols-2 md:gap-6">
                  {now.map((s: any) => {
                    return (
                      <Link
                        key={s.slug}
                        href={`/story/${s.slug}`}
                        className="group block cursor-pointer"
                        aria-label={s.title}
                      >
                        <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.99] md:rounded-[4px] md:shadow-none md:hover:bg-[var(--card-bg-hover)] md:hover:shadow-none md:active:scale-100">
                          <div className="aspect-[16/9] w-full overflow-hidden bg-zinc-100">
                            <img
                              src={
                                pickCipherPreferredImage(s) ||
                                getFallbackImage(s.topic ?? s.category)
                              }
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>

                          <div className="p-4">
                            <h3 className="mt-0 font-sans text-base font-semibold leading-snug tracking-tight text-[var(--text)] group-hover:underline line-clamp-2 md:text-lg">
                              {s.title}
                            </h3>

                            <div className="hidden md:flex mt-1 flex-col gap-1 text-xs leading-4 text-zinc-500 md:text-[var(--muted)]">
                              <div>{storySourceLabel(s)} · {formatRelativeStoryTime(getStoryLastUpdated(s))}</div>
                              <div className="uppercase tracking-wide">
                                {topicLabel(s.topic ?? s.category ?? "overig")}
                              </div>
                            </div>

                            <p className="hidden md:block mt-2 line-clamp-2 text-base leading-relaxed text-zinc-600 md:text-sm md:leading-5 md:text-[var(--muted)]">
                              {s.summary}
                            </p>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section>
                <div className="text-xs font-semibold tracking-wide text-zinc-500">Overige verhalen</div>
                <div className="mt-4 space-y-4 md:hidden">
                  {rest.map((s: any) => {
                    return (
                      <Link
                        key={s.slug}
                        href={`/story/${s.slug}`}
                        className="group block cursor-pointer"
                        aria-label={s.title}
                      >
                        <article className="flex items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.99]">
                          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                            <img
                              src={
                                pickCipherPreferredImage(s) ||
                                getFallbackImage(s.topic ?? s.category)
                              }
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-[var(--text)] group-hover:underline line-clamp-2">
                            {s.title}
                          </h3>
                        </article>
                      </Link>
                    );
                  })}
                </div>

                <div className="hidden md:grid md:mt-8 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
                  {rest.map((s: any) => {
                    return (
                      <Link
                        key={s.slug}
                        href={`/story/${s.slug}`}
                        className="group block cursor-pointer"
                        aria-label={s.title}
                      >
                        <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.99] md:rounded-[4px] md:shadow-none md:hover:bg-[var(--card-bg-hover)] md:hover:shadow-none md:active:scale-100">
                          <div className="aspect-[16/9] w-full overflow-hidden bg-zinc-100">
                            <img
                              src={
                                pickCipherPreferredImage(s) ||
                                getFallbackImage(s.topic ?? s.category)
                              }
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>

                          <div className="p-4">
                            <h3 className="mt-0 font-sans text-base font-semibold leading-snug tracking-tight text-[var(--text)] group-hover:underline line-clamp-2 md:text-lg">
                              {s.title}
                            </h3>

                            <div className="mt-1 flex flex-col gap-1 text-xs leading-4 text-zinc-500 md:text-[var(--muted)]">
                              <div>{storySourceLabel(s)} · {formatRelativeStoryTime(getStoryLastUpdated(s))}</div>
                              <div className="uppercase tracking-wide">
                                {topicLabel(s.topic ?? s.category ?? "overig")}
                              </div>
                            </div>

                            <p className="mt-2 line-clamp-2 text-base leading-relaxed text-zinc-600 md:text-sm md:leading-5 md:text-[var(--muted)]">
                              {s.summary}
                            </p>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
            <div ref={loadMoreRef} className="h-8" aria-hidden="true" />
            </div>

            <aside className="border-t border-[var(--border)] pt-6 md:col-span-4 md:border-t-0 md:pt-2">
              <div className="text-xs font-semibold tracking-wide text-zinc-500">Laatste nieuws</div>
              <div className="mt-4 space-y-1 md:space-y-2.5">
                {latestNews.map((s: any, idx: number) => {
                  const ms = getStoryLastUpdated(s);
                  const prominent = idx === 0;
                  return (
                    <Link
                      key={s.slug}
                      href={`/story/${s.slug}`}
                      className="group block cursor-pointer rounded-lg py-2 md:py-0"
                      aria-label={s.title}
                    >
                      <article className="flex gap-3 rounded-lg transition-all duration-150 md:hover:-translate-y-0.5 md:hover:shadow-sm">
                        <div className="relative mt-2 flex w-3 justify-center">
                          <span
                            className={
                              "h-1.5 w-1.5 rounded-full " +
                              (prominent ? "bg-red-900/80" : "bg-zinc-900/25")
                            }
                          />
                          {idx < latestNews.length - 1 ? (
                            <span className="absolute left-1/2 top-3 bottom-0 w-px -translate-x-1/2 bg-zinc-900/10" />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <span
                            className={
                              "block truncate leading-snug transition-colors md:leading-6 " +
                              (prominent
                                ? "text-base font-semibold text-zinc-950 group-hover:underline md:text-sm"
                                : "text-base font-medium text-zinc-800 group-hover:underline md:text-sm")
                            }
                          >
                            {s.title}
                          </span>
                          <div className="mt-1 flex items-center gap-x-2 text-xs text-zinc-500">
                            <span>{formatRelativeStoryTime(ms)}</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-900/15" aria-hidden="true" />
                            <span>{categoryLabel(s.category ?? "overig")}</span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
