import Link from "next/link";
import { getAllStories, getStoryBySlug } from "@/lib/generated";
import { getFallbackImage } from "@/lib/fallbackImage";
import { storyRecencyMs, timeAgoFromMs, storySourceLabel, topicLabel } from "@/lib/storyUtils";
import { stripAiMarkup } from "@/lib/stripAiMarkup";
import {
  StoryCriticalCarousel,
  buildInvestigationSuggestions,
  buildWhyParagraph,
  resolveCriticalQuestions,
} from "./research";

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
    <section className="mb-12" aria-labelledby="narrative-heading">
      <p id="narrative-heading" className="text-sm text-gray-500 dark:text-gray-500">
        Samengevoegd verhaal
      </p>
      <div className="mt-4 text-lg leading-relaxed text-gray-900 dark:text-gray-100">
        {aiSucceeded && blocks.length > 0 ? (
          <div className="space-y-6">
            {blocks.map((p, i) =>
              isNarrativeSubheading(p) ? (
                <h3
                  key={i}
                  className={`mb-4 text-base font-semibold text-gray-900 dark:text-gray-100 ${i > 0 ? "!mt-8" : ""}`}
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
          <p className="text-lg leading-relaxed text-gray-900 dark:text-gray-100">{summaryFallback}</p>
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

export function generateStaticParams() {
  return getAllStories().map((s) => ({ slug: s.slug }));
}

export default function StoryPage({ params }: { params: { slug: string } }) {
  const story = getStoryBySlug(params.slug);

  const safeFormatDateTimeNl = (value: unknown) => {
    const d = new Date(typeof value === "string" ? value : "");
    if (!Number.isFinite(d.getTime())) return "datum onbekend";
    return d.toLocaleString("nl-NL");
  };

  if (!story) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-gray-900 dark:text-gray-100">
        <main className="mx-auto max-w-2xl px-5 py-12">
          <Link className="text-sm font-medium text-gray-900 hover:text-black hover:underline dark:text-gray-300 dark:hover:text-white" href="/">
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

  const sources = Array.from(new Map(rawSources.map((s) => [s.domain, s])).values());
  const sourceCount = sources.length;

  const buildAt = story.buildAt;
  const buildAtDate = new Date(buildAt);
  const referenceTimeMs = Number.isFinite(buildAtDate.getTime()) ? buildAtDate.getTime() : Date.now();

  const ai = story.ai;
  const aiSucceeded =
    story.aiStatus === "ok" &&
    ai &&
    typeof ai.narrative === "string" &&
    ai.narrative.trim().length > 0;

  const investigations = (ai?.investigations ?? []) as any[];
  const inv0 = investigations[0];
  const inv1 = investigations[1];
  const criticalQuestions = resolveCriticalQuestions((ai?.questions ?? []).map((q: string) => stripAiMarkup(q)));
  const whyParagraph = buildWhyParagraph([inv0, inv1]);
  const investigationSuggestions = buildInvestigationSuggestions([inv0, inv1]);

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
    recencyMap.set(s.slug, storyRecencyMs(s));
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
        <Link
          className="text-sm font-medium text-gray-900 hover:text-black hover:underline dark:text-gray-300 dark:hover:text-white"
          href="/"
        >
          ← terug
        </Link>

        <header className="mt-6 mb-8">
          <p className="text-sm text-gray-500 dark:text-gray-500">voorbijdekop</p>
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
          <h1 className="mt-4 text-2xl font-semibold leading-tight text-gray-900 dark:text-gray-100">{story.title}</h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-900 dark:text-gray-100">{story.summary}</p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            {storySourceLabel(story)} · {timeAgoFromMs(storyRecencyMs(story), referenceTimeMs)}
          </p>
        </header>

        <NarrativeLead
          aiSucceeded={aiSucceeded}
          narrative={stripAiMarkup(ai?.narrative ?? "")}
          summaryFallback={story.summary}
        />

        <div className="mb-12 space-y-8">
          <section>
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Feiten</h2>
            <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-gray-900 marker:text-gray-700 dark:text-gray-100 dark:marker:text-gray-500">
              {(ai?.facts ?? []).slice(0, 16).map((x: string, i: number) => (
                <li key={i} className="break-words">
                  {stripAiMarkup(x)}
                </li>
              ))}
              {(ai?.facts ?? []).length === 0 && (
                <li className="text-sm text-gray-800 dark:text-gray-300">Geen (of niet automatisch afgeleid).</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Interpretaties</h2>
            <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-gray-900 marker:text-gray-700 dark:text-gray-100 dark:marker:text-gray-500">
              {(ai?.interpretations ?? []).slice(0, 16).map((x: string, i: number) => (
                <li key={i} className="break-words">
                  {stripAiMarkup(x)}
                </li>
              ))}
              {(ai?.interpretations ?? []).length === 0 && (
                <li className="text-sm text-gray-800 dark:text-gray-300">Geen (of niet automatisch afgeleid).</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Onbekend</h2>
            <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-gray-900 marker:text-gray-700 dark:text-gray-100 dark:marker:text-gray-500">
              {(ai?.unknowns ?? []).slice(0, 16).map((x: string, i: number) => (
                <li key={i} className="break-words">
                  {stripAiMarkup(x)}
                </li>
              ))}
              {(ai?.unknowns ?? []).length === 0 && (
                <li className="text-sm text-gray-800 dark:text-gray-300">Geen (of niet automatisch afgeleid).</li>
              )}
            </ul>
          </section>
        </div>

        <section className="mb-16">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Bronvergelijking</h2>
          <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-gray-900 marker:text-gray-700 dark:text-gray-100 dark:marker:text-gray-500">
            {(ai?.comparisons ?? []).slice(0, 12).map((x: string, i: number) => (
              <li key={i} className="break-words">
                {stripAiMarkup(x)}
              </li>
            ))}
            {(ai?.comparisons ?? []).length === 0 && (
              <li className="text-sm text-gray-800 dark:text-gray-300">Nog geen vergelijking beschikbaar.</li>
            )}
          </ul>
        </section>
        </div>

        <section
          className="mb-12 bg-neutral-50 py-12 dark:bg-neutral-950/35"
          aria-labelledby="critical-reflection-heading"
        >
          <div className="mx-auto max-w-2xl px-6">
            <h2 id="critical-reflection-heading" className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Kijk hier kritisch naar
            </h2>
            <StoryCriticalCarousel
              questions={criticalQuestions}
              whyText={whyParagraph}
              suggestions={investigationSuggestions}
            />
          </div>
        </section>

        <div className="mx-auto max-w-2xl px-5 pb-12">
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Verificatie (claims)</h2>
          <ol className="space-y-6">
            {(ai?.claims ?? []).slice(0, 12).map((c: any, i: number) => (
              <li key={i}>
                <div className="text-sm font-semibold leading-relaxed text-gray-900 dark:text-gray-100">
                  {i + 1}. {stripAiMarkup(String(c.claim ?? ""))}
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-500">Confidence: {c.confidence}</div>
                <div className="mt-3 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                  {stripAiMarkup(String(c.verification ?? ""))}
                </div>
              </li>
            ))}
            {(ai?.claims ?? []).length === 0 && (
              <li className="text-sm text-gray-800 dark:text-gray-300">Nog geen claims beschikbaar.</li>
            )}
          </ol>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Transparantie</h2>
          <div className="text-sm leading-relaxed">
            <div>
              <span className="font-semibold text-gray-500 dark:text-gray-500">Build tijd:</span>{" "}
              <span className="text-gray-900 dark:text-gray-100">{safeFormatDateTimeNl(buildAt)}</span>
            </div>
            <div className="mt-2">
              <span className="font-semibold text-gray-500 dark:text-gray-500">Gebruikte bronnen:</span>{" "}
              <span className="text-gray-900 dark:text-gray-100">{sourceCount}</span>
            </div>
          </div>
          <ul className="mt-6 space-y-4 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
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
                  {safeFormatDateTimeNl(s.publishedAt)} • {s.type} • {s.depth} • {s.bias}
                </div>
                <div className="mt-2 text-sm text-gray-800 dark:text-gray-300">{s.title}</div>
              </li>
            ))}
          </ul>
        </section>
        </div>

        {relatedFinal.length > 0 ? (
          <section className="pb-12" aria-labelledby="related-articles-heading">
            <div className="mx-auto max-w-7xl border-t border-[var(--border)] px-6 pt-8">
              <h2 id="related-articles-heading" className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Relevante artikelen
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
                {relatedFinal.map((s: any) => (
                  <Link
                    key={s.slug}
                    href={`/story/${s.slug}`}
                    className="group block cursor-pointer"
                    aria-label={s.title}
                  >
                    <article className="flex flex-col overflow-hidden rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] transition-colors duration-150 hover:bg-[var(--card-bg-hover)]">
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
                        <h3 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-black group-hover:underline dark:text-gray-100 dark:group-hover:text-white">
                          {s.shortHeadline ?? s.title}
                        </h3>
                        <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-gray-500 dark:text-gray-500">
                          <span>
                            {storySourceLabel(s)} · {timeAgoFromMs(storyRecencyMs(s), referenceTimeMs)}
                          </span>
                          <span className="uppercase tracking-wide">{topicLabel(s.topic ?? s.category ?? "overig")}</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
