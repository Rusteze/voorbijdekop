import Link from "next/link";
import { getAllStories, getStoryBySlug } from "@/lib/generated";
import { getFallbackImage } from "@/lib/fallbackImage";
import { storyRecencyMs, timeAgoFromMs, storySourceLabel, topicLabel } from "@/lib/storyUtils";
import { stripAiMarkup } from "@/lib/stripAiMarkup";
import { ResearchWorkflow } from "./research";

function pickCipherPreferredImage(story: any) {
  const SKIP_IMAGE_DOMAINS = new Set(["thecipherbrief.com", "rijksoverheid.nl", "feeds.rijksoverheid.nl"]);
  const articles: any[] = Array.isArray(story?.articles) ? story.articles : [];
  const hasSkip = articles.some((a: any) => SKIP_IMAGE_DOMAINS.has(a?.sourceDomain));
  if (!hasSkip) return story?.imageUrl;

  const others = articles
    .filter((a: any) => !SKIP_IMAGE_DOMAINS.has(a?.sourceDomain))
    .filter((a: any) => typeof a?.imageUrl === "string" && a.imageUrl.trim().length > 0);

  if (others.length === 0) return undefined;

  // Neem de meest recente andere bron met image (eenvoudige, stabiele keuze).
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
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <main className="mx-auto max-w-3xl px-6 py-14">
          <Link className="text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]" href="/">
            ← terug
          </Link>
          <h1 className="mt-6 text-2xl font-semibold">Story niet gevonden</h1>
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

  // Dedupeer op domain: bron-teller en rendering moeten exact dezelfde dataset gebruiken.
  const sources = Array.from(new Map(rawSources.map((s) => [s.domain, s])).values());
  const sourceCount = sources.length;

  const buildAt = story.buildAt;
  const buildAtDate = new Date(buildAt);
  const referenceTimeMs = Number.isFinite(buildAtDate.getTime()) ? buildAtDate.getTime() : Date.now();

  const investigationSourceQuickLinks = (story.articles as any[]).slice(0, 8).map((a: any) => {
    const tit = (a.titleNl ?? a.title) as string;
    const short = tit.length > 64 ? `${tit.slice(0, 62)}…` : tit;
    return {
      label: `${a.sourceDomain} — ${short}`,
      url: a.url as string,
    };
  });

  const ai = story.ai;
  const aiSucceeded =
    story.aiStatus === "ok" &&
    ai &&
    typeof ai.narrative === "string" &&
    ai.narrative.trim().length > 0;

  const cipherImage = pickCipherPreferredImage(story);
  const fallbackTopic = story.topic ?? story.category ?? "overig";
  const fallbackSrc = getFallbackImage(fallbackTopic);
  const heroSrc = cipherImage || fallbackSrc;
  const usedFallback = !cipherImage;

  const relatedCandidates = [...getAllStories()].filter((s) => s.slug !== story.slug);

  // Correct scheiden: topic-only voor topic, category-only voor category.
  const relatedTopicAnchor = story.topic ?? "overig";
  const relatedCategoryAnchor = story.category ?? "overig";

  // Precompute recency: voorkomt herhaald date-parsen in sort.
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto max-w-7xl px-6 py-14">
        <div className="mx-auto max-w-[680px]">
          <Link className="text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]" href="/">
            ← terug
          </Link>

        <header className="mt-6">
          <div className="text-xs font-medium text-[var(--muted)]">voorbijdekop</div>
          <div className="mt-6 overflow-hidden rounded-2xl bg-[var(--card-bg)] ring-1 ring-[var(--border)]">
            <div className="relative aspect-[16/9] w-full bg-[var(--card-bg)]">
              <img
                src={heroSrc}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
              {usedFallback ? (
                <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-[var(--card-bg)] px-2 py-1 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
                  Ter illustratie
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-xs uppercase tracking-wide text-[var(--muted)]">
            {(story.topic ?? story.category ?? "overig").toString()}
          </p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight text-[var(--text)]">
            {story.title}
          </h1>
          <p className="mt-5 text-base leading-8 text-[var(--muted)]">{story.summary}</p>
          {/* Editorial: alleen bronlabel + (relatieve) publicatietijd */}
          <p className="mt-4 text-sm text-[var(--muted)]">
            {storySourceLabel(story)} · {timeAgoFromMs(storyRecencyMs(story), referenceTimeMs)}
          </p>
        </header>

        <article className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Samengevoegd verhaal</h2>
          <div className="mt-6 text-base leading-8 text-[var(--text)]">
            {aiSucceeded ? (
              <p className="whitespace-pre-wrap leading-8">{stripAiMarkup(ai?.narrative ?? "")}</p>
            ) : (
              <p className="text-[var(--muted)]">{story.summary}</p>
            )}
          </div>

          <div className="mt-12 border-t border-[var(--border)] pt-10">
            <div className="space-y-8">
              <section>
                <h3 className="text-sm font-semibold tracking-wide text-[var(--text)]">Feiten</h3>
                <ul className="mt-4 space-y-2 text-base leading-7 text-[var(--text)]">
                  {(ai?.facts ?? []).slice(0, 16).map((x: string, i: number) => (
                    <li key={i} className="list-disc pl-5">
                      {stripAiMarkup(x)}
                    </li>
                  ))}
                  {(ai?.facts ?? []).length === 0 && (
                    <li className="text-[var(--muted)]">Geen (of niet automatisch afgeleid).</li>
                  )}
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold tracking-wide text-[var(--text)]">Interpretaties</h3>
                <ul className="mt-4 space-y-2 text-base leading-7 text-[var(--text)]">
                  {(ai?.interpretations ?? []).slice(0, 16).map((x: string, i: number) => (
                    <li key={i} className="list-disc pl-5">
                      {stripAiMarkup(x)}
                    </li>
                  ))}
                  {(ai?.interpretations ?? []).length === 0 && (
                    <li className="text-[var(--muted)]">Geen (of niet automatisch afgeleid).</li>
                  )}
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold tracking-wide text-[var(--text)]">Onbekend</h3>
                <ul className="mt-4 space-y-2 text-base leading-7 text-[var(--text)]">
                  {(ai?.unknowns ?? []).slice(0, 16).map((x: string, i: number) => (
                    <li key={i} className="list-disc pl-5">
                      {stripAiMarkup(x)}
                    </li>
                  ))}
                  {(ai?.unknowns ?? []).length === 0 && (
                    <li className="text-[var(--muted)]">Geen (of niet automatisch afgeleid).</li>
                  )}
                </ul>
              </section>
            </div>
          </div>
        </article>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Bronvergelijking</h2>
          <ul className="mt-4 space-y-2 text-base leading-7 text-[var(--text)]">
            {(ai?.comparisons ?? []).slice(0, 12).map((x: string, i: number) => (
              <li key={i} className="list-disc pl-5">
                {stripAiMarkup(x)}
              </li>
            ))}
            {(ai?.comparisons ?? []).length === 0 && (
              <li className="text-[var(--muted)]">Nog geen vergelijking beschikbaar.</li>
            )}
          </ul>
        </section>

        </div>

        <section className="relative left-1/2 right-1/2 mt-12 w-screen -translate-x-1/2 border-y border-[var(--border)] bg-[var(--card-bg-hover)] px-6 py-10 pb-28 sm:pb-32">
          <div className="mx-auto max-w-[680px]">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Onderzoek dit verhaal</h2>
            <ResearchWorkflow
              slug={story.slug}
              questions={(ai?.questions ?? []).slice(0, 10).map((q) => stripAiMarkup(q))}
              investigations={[
                (ai?.investigations ?? [])[0] ?? null,
                (ai?.investigations ?? [])[1] ?? null,
              ]}
              sourceQuickLinks={investigationSourceQuickLinks}
            />
          </div>
        </section>

        <div className="mx-auto max-w-[680px]">
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">Verificatie (claims)</h2>
          <ol className="mt-4 space-y-5">
            {(ai?.claims ?? []).slice(0, 12).map((c: any, i: number) => (
              <li key={i} className="border-l border-[var(--border)] pl-4">
                <div className="text-base font-semibold leading-6 text-[var(--text)]">
                  {i + 1}. {stripAiMarkup(String(c.claim ?? ""))}
                </div>
                <div className="mt-2 text-sm text-[var(--muted)]">Confidence: {c.confidence}</div>
                <div className="mt-2 text-base leading-7 text-[var(--text)]">
                  {stripAiMarkup(String(c.verification ?? ""))}
                </div>
              </li>
            ))}
            {(ai?.claims ?? []).length === 0 && (
              <li className="text-sm text-[var(--muted)]">Nog geen claims beschikbaar.</li>
            )}
          </ol>
        </section>
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">Transparantie</h2>
          <div className="mt-4 text-base leading-7 text-[var(--text)]">
            <div>
              <span className="font-medium text-[var(--muted)]">Build tijd:</span> {safeFormatDateTimeNl(buildAt)}
            </div>
            <div className="mt-1">
              <span className="font-medium text-[var(--muted)]">Gebruikte bronnen:</span> {sourceCount}
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-base leading-7 text-[var(--text)]">
            {sources.map((s, i) => (
              <li key={i} className="border-l border-[var(--border)] pl-4">
                <a className="font-semibold text-[var(--text)] hover:underline" href={s.url} rel="noreferrer">
                  {s.domain}
                </a>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {safeFormatDateTimeNl(s.publishedAt)} • {s.type} • {s.depth} • {s.bias}
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">{s.title}</div>
              </li>
            ))}
          </ul>
        </section>
        </div>

        {relatedFinal.length > 0 ? (
          <section className="mt-16 border-t border-[var(--border)] pt-10">
            <h2 className="text-lg font-semibold tracking-tight">Misschien vind je dit ook interessant...</h2>

            <div className="mt-4 w-full grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-4">
              {relatedFinal.map((s: any) => (
                <Link key={s.slug} href={`/story/${s.slug}`} className="group block cursor-pointer" aria-label={s.title}>
                  <article className="flex flex-col overflow-hidden rounded-[4px] border border-[var(--card-border)] bg-[var(--card-bg)] transition-all duration-150 hover:bg-[var(--card-bg-hover)]">
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
                      <h3 className="mt-0.5 font-sans text-sm font-semibold leading-snug tracking-tight text-[var(--text)] group-hover:underline line-clamp-2">
                        {s.shortHeadline ?? s.title}
                      </h3>

                      <div className="mt-2 flex flex-col gap-1 text-[11px] leading-4 text-[var(--muted)]">
                        <div>
                          {storySourceLabel(s)} · {timeAgoFromMs(storyRecencyMs(s), referenceTimeMs)}
                        </div>
                        <div className="uppercase tracking-wide">{topicLabel(s.topic ?? s.category ?? "overig")}</div>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

