import Link from "next/link";
import { getAllStories, getStoryBySlug } from "@/lib/generated.server";
import { getFallbackImage } from "@/lib/fallbackImage";
import {
  getStoryLastUpdated,
  formatRelativeStoryTime,
  formatAbsoluteDateTimeNl,
  storySourceLabel,
  topicLabel,
} from "@/lib/storyUtils";
import { stripAiMarkup } from "@/lib/stripAiMarkup";
export const revalidate = 0;

function isNarrativeSubheading(paragraph: string) {
  const t = paragraph.trim();
  if (t.length >= 100) return false;
  return /^Wat hier opvalt\b/i.test(t);
}

function NarrativeLead({
  aiSucceeded,
  narrative,
  summaryFallback,
}: {
  aiSucceeded: boolean;
  narrative: string;
  summaryFallback: string;
}) {
  const blocks =
    aiSucceeded && narrative.trim()
      ? narrative
          .split(/\n\n+/)
          .map((p) => stripAiMarkup(p).trim())
          .filter(Boolean)
      : [];

  return (
    <section className="mb-10 md:mb-12">
      <div className="mt-4 text-base leading-relaxed text-gray-900 dark:text-gray-100 md:text-lg">
        {aiSucceeded && blocks.length > 0 ? (
          <div className="space-y-4 md:space-y-6">
            {blocks.map((p, i) =>
              isNarrativeSubheading(p) ? (
                <h3
                  key={i}
                  className={`mb-3 text-base font-semibold leading-tight text-gray-900 dark:text-gray-100 md:mb-4 ${i > 0 ? "!mt-6 md:!mt-8" : ""}`}
                >
                  {p.trim()}
                </h3>
              ) : (
                <p key={i} className="whitespace-pre-wrap">
                  {p}
                </p>
              )
            )}
          </div>
        ) : (
          <p className="text-base leading-relaxed text-gray-900 dark:text-gray-100 md:text-lg">{summaryFallback}</p>
        )}
      </div>
    </section>
  );
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

export default function StoryPage({ params }: { params: { slug: string } }) {
  const story = getStoryBySlug(params.slug);

  if (!story) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-gray-900 dark:text-gray-100">
        <main className="mx-auto max-w-2xl px-4 py-8 md:px-5 md:py-12">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-medium text-gray-900 hover:text-black hover:underline dark:text-gray-300 dark:hover:text-white"
            href="/"
          >
            ← terug
          </Link>
          <h1 className="mt-6 text-2xl font-semibold leading-tight">Story niet gevonden</h1>
        </main>
      </div>
    );
  }

  const rawSources = story.articles.map((a: any) => ({
    domain: a.sourceDomain as string,
    url: a.url as string,
    title: (a as any).titleNl ?? a.title,
    publishedAt: a.publishedAt as string,
    type: a.source.type as string,
    depth: a.source.depth as string,
    bias: a.source.bias as string
  }));

  const sources = Array.from(new Map(rawSources.map((s: any) => [s.domain, s])).values()) as any[];
  const sourceCount = sources.length;

  const lastUpdatedMs = getStoryLastUpdated(story);

  const ai = story.ai;
  const aiSucceeded =
    story.aiStatus === "ok" &&
    ai &&
    typeof ai.narrative === "string" &&
    ai.narrative.trim().length > 0;
  const narrativeText = stripAiMarkup(ai?.narrative ?? "");
  const bullets = (ai?.facts ?? []).map((x: string) => stripAiMarkup(x)).filter(Boolean);
  const normalize = (txt: string) => txt.toLowerCase().replace(/\s+/g, " ").trim();
  const isDuplicateBullet = (b: string) => normalize(narrativeText).includes(normalize(b));
  const visibleBullets = bullets.filter((b: string) => !isDuplicateBullet(b));

  const cipherImage = pickCipherPreferredImage(story);
  const fallbackTopic = story.topic ?? story.category ?? "overig";
  const fallbackSrc = getFallbackImage(fallbackTopic);
  const heroSrc = cipherImage || fallbackSrc;
  const usedFallback = !cipherImage;

  const relatedCandidates = [...getAllStories()].filter((s) => s.slug !== story.slug);

  const relatedTopicAnchor = story.topic ?? "overig";
  const relatedCategoryAnchor = story.category ?? "overig";

  const recencyMap = new Map<string, number>();
  for (const s of relatedCandidates) {
    recencyMap.set(s.slug, getStoryLastUpdated(s));
  }

  const sortStories = (a: any, b: any) => {
    const imp = (b.importance ?? 0) - (a.importance ?? 0);
    if (imp !== 0) return imp;
    return (recencyMap.get(b.slug) ?? 0) - (recencyMap.get(a.slug) ?? 0);
  };

  const relatedSameTopic = relatedCandidates
    .filter((s: any) => (s.topic ?? "overig").toString() === relatedTopicAnchor.toString())
    .sort(sortStories);

  const relatedSameCategory = relatedCandidates
    .filter((s: any) => (s.category ?? "overig").toString() === relatedCategoryAnchor.toString())
    .sort(sortStories);

  const relatedFinal = (() => {
    const used = new Set<string>();
    const out: any[] = [];

    for (const s of relatedSameTopic) {
      if (out.length >= 4) break;
      if (used.has(s.slug)) continue;
      used.add(s.slug);
      out.push(s);
    }

    if (out.length < 4) {
      for (const s of relatedSameCategory) {
        if (out.length >= 4) break;
        if (used.has(s.slug)) continue;
        used.add(s.slug);
        out.push(s);
      }
    }

    if (out.length < 4) {
      const fallback = [...relatedCandidates]
        .sort(sortStories)
        .filter((s: any) => !used.has(s.slug))
        .slice(0, 4 - out.length);
      out.push(...fallback);
    }

    return out.slice(0, 4);
  })();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main>
        <div className="mx-auto max-w-2xl px-5 pt-12">
        <header className="mt-6 mb-8">
          <div className="mt-6 overflow-hidden rounded-xl bg-[var(--card-bg)]">
            <div className="relative aspect-[16/9] w-full bg-[var(--card-bg)]">
              <img
                src={heroSrc}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
              {usedFallback ? (
                <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-[var(--card-bg)] px-2 py-2 text-sm text-gray-500 dark:text-gray-500">
                  Ter illustratie
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            {(story.topic ?? story.category ?? "overig").toString()}
          </p>
          <h1 className="mt-4 text-xl font-semibold leading-tight text-gray-900 dark:text-gray-100 md:text-2xl">
            {story.title}
          </h1>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            {storySourceLabel(story)} · Laatst bijgewerkt: {formatRelativeStoryTime(lastUpdatedMs)}
            {lastUpdatedMs > 0 ? (
              <span className="hidden md:inline"> ({formatAbsoluteDateTimeNl(lastUpdatedMs)})</span>
            ) : null}
          </p>
        </header>

        <NarrativeLead
          aiSucceeded={aiSucceeded}
          narrative={narrativeText}
          summaryFallback={story.summary}
        />

        {visibleBullets.length > 0 ? (
        <div className="mb-10 space-y-8 md:mb-12">
          <section className="mt-6 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 md:mt-0 md:rounded-none md:border-0 md:bg-transparent md:p-0">
            <h2 className="mb-2 text-base font-semibold leading-tight text-gray-900 dark:text-gray-100 md:mb-4 md:text-xl">
              Belangrijkste punten
            </h2>
            <ul className="list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-gray-900 marker:text-gray-600 dark:text-gray-100 dark:marker:text-gray-500 md:space-y-3 md:text-sm md:leading-relaxed">
              {visibleBullets.slice(0, 5).map((x: string, i: number) => (
                <li key={i} className="break-words tracking-[0.001em]">
                  {x}
                </li>
              ))}
            </ul>
          </section>
        </div>
        ) : null}
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-10 md:px-5 md:pb-12">
        <section className="mb-10 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 md:mb-12 md:rounded-none md:border-0 md:bg-transparent md:p-0">
          <h2 className="mb-2 text-base font-semibold leading-tight text-gray-900 dark:text-gray-100 md:mb-4 md:text-xl">
            Transparantie
          </h2>
          <div className="text-[15px] leading-7 md:text-sm md:leading-relaxed">
            <div className="mt-1 md:mt-2">
              <span className="font-semibold text-gray-500 dark:text-gray-500">Gebruikte bronnen:</span>{" "}
              <span className="text-gray-900 dark:text-gray-100">{sourceCount}</span>
            </div>
          </div>
          <ul className="mt-4 space-y-4 text-[15px] leading-7 text-gray-900 dark:text-gray-100 md:mt-6 md:text-sm md:leading-relaxed">
            {sources.map((s, i) => (
              <li key={i}>
                <a
                  className="font-semibold text-gray-900 underline-offset-4 hover:text-black hover:underline dark:text-gray-100 dark:hover:text-white"
                  href={s.url}
                  rel="noreferrer"
                >
                  {s.domain}
                </a>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                  Publicatietijd bron: {formatAbsoluteDateTimeNl(s.publishedAt)} • {s.type} • {s.depth} • {s.bias}
                </div>
                <div className="mt-2 text-sm text-gray-800 dark:text-gray-300">{s.title}</div>
              </li>
            ))}
          </ul>
        </section>
        </div>

        {relatedFinal.length > 0 ? (
          <section className="pb-10 md:pb-12" aria-labelledby="related-articles-heading">
            <div className="mx-auto max-w-7xl border-t border-[var(--border)] px-4 pt-6 md:px-6 md:pt-8">
              <h2
                id="related-articles-heading"
                className="mb-3 text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100 md:mb-4 md:text-xl"
              >
                Relevante artikelen
              </h2>

              {/* Mobile: top 2 in 2 columns (image top, title below) */}
              <div className="mt-4 grid grid-cols-2 gap-3 md:hidden">
                {relatedFinal.slice(0, 2).map((s: any) => (
                  <Link
                    key={s.slug}
                    href={`/story/${s.slug}`}
                    className="group block cursor-pointer"
                    aria-label={s.title}
                  >
                    <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm transition-all duration-150 active:scale-[0.99] hover:shadow-md md:rounded-md md:shadow-none md:hover:bg-[var(--card-bg-hover)] md:hover:shadow-none md:active:scale-100">
                      <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--card-bg)]">
                        <img
                          src={pickCipherPreferredImage(s) || getFallbackImage(s.topic ?? s.category)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="p-3">
                        <h3 className="text-base font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-black group-hover:underline dark:text-gray-100 dark:group-hover:text-white">
                          {s.shortHeadline ?? s.title}
                        </h3>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>

              {/* Mobile: remaining items as compact list (image left, title right) */}
              {relatedFinal.length > 2 ? (
                <div className="mt-4 space-y-4 md:hidden">
                  {relatedFinal.slice(2).map((s: any) => (
                    <Link
                      key={s.slug}
                      href={`/story/${s.slug}`}
                      className="group block cursor-pointer"
                      aria-label={s.title}
                    >
                      <article className="flex items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.99]">
                        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-[var(--card-bg)]">
                          <img
                            src={pickCipherPreferredImage(s) || getFallbackImage(s.topic ?? s.category)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-gray-900 line-clamp-2 group-hover:text-black group-hover:underline dark:text-gray-100 dark:group-hover:text-white">
                          {s.shortHeadline ?? s.title}
                        </h3>
                      </article>
                    </Link>
                  ))}
                </div>
              ) : null}

              {/* Desktop: keep existing grid of cards */}
              <div className="hidden md:block">
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
                  {relatedFinal.map((s: any) => (
                    <Link
                      key={s.slug}
                      href={`/story/${s.slug}`}
                      className="group block cursor-pointer"
                      aria-label={s.title}
                    >
                      <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm transition-all duration-150 active:scale-[0.99] hover:shadow-md md:rounded-md md:shadow-none md:hover:bg-[var(--card-bg-hover)] md:hover:shadow-none md:active:scale-100">
                        <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--card-bg)]">
                          <img
                            src={pickCipherPreferredImage(s) || getFallbackImage(s.topic ?? s.category)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="p-4 md:p-3">
                          <h3 className="text-base font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-black group-hover:underline dark:text-gray-100 dark:group-hover:text-white md:text-sm">
                            {s.shortHeadline ?? s.title}
                          </h3>
                          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-gray-500 dark:text-gray-500">
                            <span>
                              {storySourceLabel(s)} · {formatRelativeStoryTime(getStoryLastUpdated(s))}
                            </span>
                            <span className="uppercase tracking-wide">{topicLabel(s.topic ?? s.category ?? "overig")}</span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
