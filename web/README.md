This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SITE_URL`: canonical site URL (used for metadata/sitemap/robots)
- `NEXT_PUBLIC_CONTACT_EMAIL` (optioneel): getoond op `/privacy` als contact voor privacyverzoeken
- `NEXT_PUBLIC_DIGEST_ENDPOINT`: optional POST endpoint for digest signups (bijv. `https://<worker>.workers.dev/v1/digest` — zie `workers/README.md`)
- `NEXT_PUBLIC_FEEDBACK_ENDPOINT`: optional POST endpoint for story feedback (bijv. `…/v1/feedback`)
- `NEXT_PUBLIC_SHOW_IMPORTANCE` (optioneel): zet op `"1"` om Belangrijkheid-indicatoren (badge/bar) op de homepage en debug breakdown op de storypagina te tonen.

If the endpoint variables are empty or unreachable, the app automatically falls back to localStorage so the UI keeps working.

De Cloudflare Worker in `/workers` verzorgt dubbele opt-in, D1-opslag, rate limits en de dagelijkse digest-cron (Resend).

## Aanrader & quiz (homepage)

- **`data/editorial-pick.json`** (repo-root): redactionele **Aanrader** — zet `enabled` op `true` en vul `title`, `dek`, `kind` (`book` \| `film` \| `podcast` \| `series` \| `link`), `href` (intern `/…` of externe URL). Optioneel `imageUrl`, `label`, `updatedAt`. `npm run build:data` valideert en schrijft naar `web/public/data/editorial-pick.json`.
- **`daily-quiz.json`**: wordt **automatisch** gegenereerd bij `build:data` op basis van `stories.json` + `data/wordPool.json`. Het resultaat (in `web/public/data/`) is een **Associatie Quiz** met 4 woorden; na beantwoorden toont de site een verdeling (crowd) en een “meest gekozen”/AI-fallback. Bij generatieproblemen: `{ "skipped": true, … }` — dan toont de site geen quiz. Knop **Minder tonen** onthoudt dat per browser tot de volgende kalenderdag (Europe/Amsterdam) of tot de quiz opnieuw wordt gebouwd (`generatedAt`).

  Crowd-votes gaan naar de Worker (zelfde host als `NEXT_PUBLIC_DIGEST_ENDPOINT`):
  `/v1/quiz/submit` (opslaan) en `/v1/quiz/aggregate` (cijfers). Hiervoor zijn D1 tabellen nodig (`quiz_responses`, plus optioneel `daily_quiz`).

### SWOW import (optioneel, aanbevolen)

Je kunt een eigen Nederlandse SWOW-export importeren naar `data/associations-cache.json`:

```bash
npm run quiz:import-swow -- data/swow-nl.csv
```

Verwacht CSV/TSV met minimaal kolommen `cue` en `response` (optioneel `count`/`freq`).
Zie `data/swow-nl.template.csv` voor formaat.  
Daarna:

```bash
npm run build:data
```

`wordPool.json` blijft leidend als handmatige override.  
ConceptNet-uitbreiding is optioneel en standaard uit; zet `ASSOC_ENABLE_CONCEPTNET=1` als je die extra bron wilt proberen.

### Volledig automatisch (geen handwerk per dag)

De buildpipeline (`npm run build:data`) probeert automatisch, in deze volgorde:

1. `data/swow-nl.csv` (als dit bestand bestaat in de repo)
2. `SWOW_CSV_URL` (als env/secret gezet is)
3. fallback op bestaande cache + `wordPool.json`

Voor GitHub Actions kun je `SWOW_CSV_URL` als repository secret zetten.  
Dan draait SWOW-import automatisch mee in elke scheduled update.

Ankers: `#aanrader`, `#quiz-van-de-dag` (verdwijnt zolang de quiz verborgen is).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
