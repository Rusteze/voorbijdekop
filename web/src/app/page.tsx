"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAllStories } from "@/lib/generated";
import { getFallbackImage } from "@/lib/fallbackImage";
import { getStoryLastUpdated, formatRelativeStoryTime, topicLabel } from "@/lib/storyUtils";
import { submitWithFallback } from "@/lib/submissions";
import { resolveTopicFromAi } from "@/lib/storyTopicsRegistry";
import { useVoorbijDekop } from "./voorbijdekop-state";
import { usePointerDragScroll } from "@/lib/usePointerDragScroll";

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
  const DIGEST_ENDPOINT = process.env.NEXT_PUBLIC_DIGEST_ENDPOINT;
  const { query, topic, setTopic, openAiInfo } = useVoorbijDekop();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("topic");
    if (t === null || t === "") return;
    if (t === "alle") {
      setTopic("alle");
      return;
    }
    setTopic(resolveTopicFromAi(t));
  }, [setTopic]);
  const [sourceFilter, setSourceFilter] = useState<string>("alle");
  const [visibleCount, setVisibleCount] = useState(20);
  const [storiesRuntime, setStoriesRuntime] = useState<any[]>(() => getAllStories());
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);
  const [digestEmail, setDigestEmail] = useState("");
  const [digestSaved, setDigestSaved] = useState(false);
  const [digestSaveMode, setDigestSaveMode] = useState<"remote" | "local" | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [autoHighlightTick, setAutoHighlightTick] = useState(0);

  const sourcesViewportRef = useRef<HTMLDivElement | null>(null);
  usePointerDragScroll(sourcesViewportRef);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("followed-topics-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setFollowedTopics(parsed.filter((x) => typeof x === "string"));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("followed-topics-v1", JSON.stringify(followedTopics));
    } catch {
      // ignore
    }
  }, [followedTopics]);

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

  // Active bron moet blijven bestaan binnen de huidige dataset.
  useEffect(() => {
    if (sourceFilter === "alle") return;
    const exists = sourcesFiltered.some(([id]) => id === sourceFilter);
    if (!exists) setSourceFilter("alle");
  }, [sourcesFilteredIdsKey, sourceFilter, sourcesFiltered]);

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
  const isCurrentTopicFollowed = topic !== "alle" && followedTopics.includes(topic);

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
          {topic !== "alle" ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setFollowedTopics((cur) =>
                    cur.includes(topic) ? cur.filter((t) => t !== topic) : [...cur, topic]
                  );
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {isCurrentTopicFollowed ? "Ontvolg topic" : "Volg topic"}
              </button>
            </div>
          ) : null}
          {followedTopics.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">Gevolgde topics:</span>
              {followedTopics.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setTopic(tp as any)}
                  className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {topicLabel(tp)}
                </button>
              ))}
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

              <div className="mt-4 flex items-center gap-3">
                <div
                  ref={sourcesViewportRef}
                  className="no-scrollbar flex-1 overflow-x-auto md:cursor-grab"
                >
                  <div className="flex items-center gap-2 snap-x snap-mandatory pr-2 md:gap-3">
                    {sourcesFiltered.map(([id, label]) => {
                      const active = sourceFilter === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          title={label}
                          onClick={() => setSourceFilter(id)}
                          aria-current={active ? "page" : undefined}
                          className={
                            "snap-start whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition-colors md:py-1.5 " +
                            (active
                              ? "border-zinc-900/20 bg-zinc-900/5 text-zinc-900 dark:border-zinc-100/20 dark:bg-zinc-100/10 dark:text-zinc-100"
                              : "border-[var(--border)] bg-white/60 text-[var(--muted)] hover:text-[var(--text)] dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:text-zinc-100")
                          }
                        >
                          {id === "alle" ? label : prettySourceDomain(id)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {sourceFilter !== "alle" ? (
                  <button
                    type="button"
                    onClick={() => setSourceFilter("alle")}
                    className="shrink-0 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 md:py-1.5"
                    aria-label="Reset bron filter"
                  >
                    Reset
                  </button>
                ) : null}
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
              <div className="mb-5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                <div className="text-xs font-semibold tracking-wide text-zinc-500">Dagelijkse digest</div>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  Ontvang dagelijks een korte update per e-mail. Je ontvangt eerst een bevestigingslink; daarna wordt je
                  adres alleen gebruikt voor de digest. Zie{" "}
                  <Link href="/privacy" className="font-medium text-red-900 underline underline-offset-2 dark:text-red-200">
                    privacy &amp; cookies
                  </Link>{" "}
                  voor gegevensverwerking en afmelden.
                </p>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!digestEmail.trim()) return;
                    try {
                      const result = await submitWithFallback({
                        endpoint: DIGEST_ENDPOINT,
                        storageKey: "digest-signups-v1",
                        payload: {
                          email: digestEmail.trim().toLowerCase(),
                          createdAt: new Date().toISOString(),
                          topic: topic === "alle" ? null : topic,
                          topics:
                            followedTopics.length > 0
                              ? followedTopics
                              : topic !== "alle"
                                ? [topic]
                                : []
                        }
                      });
                      setDigestSaveMode(result.persisted);
                      setDigestSaved(true);
                      setDigestEmail("");
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <input
                    type="email"
                    value={digestEmail}
                    onChange={(e) => {
                      setDigestEmail(e.target.value);
                      setDigestSaved(false);
                      setDigestSaveMode(null);
                    }}
                    placeholder="jij@voorbeeld.nl"
                    className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Aanmelden
                  </button>
                </form>
                {digestSaved ? (
                  <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                    {digestSaveMode === "remote" ? "Online opgeslagen." : "Lokaal opgeslagen."}
                  </div>
                ) : null}
              </div>
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
                            <span>{topicLabel(s.topic ?? s.category ?? "overig")}</span>
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
