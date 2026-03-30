# voorbijdekop-api (Cloudflare Worker)

Dagelijkse digest per e-mail (Resend), aanmeldingen met dubbele opt-in, story-feedback in D1, rate limiting via KV, optionele webhooks.

## Wat je nodig hebt

- **Node.js 20 of hoger** (Wrangler 4 eist dit). Met [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use` (in `workers/` staat een `.nvmrc` met `20`). Of via [nodejs.org](https://nodejs.org/) LTS installeren.
- Een [Cloudflare](https://dash.cloudflare.com)-account (gratis tier volstaat).
- Een [Resend](https://resend.com)-account + API key; voor productie een **geverifieerd domein** (of tijdelijk Resend’s test-afzender gebruiken — zie Resend-docs).
- Je **live site-URL** waar `stories.json` publiek staat (meestal `https://jouwdomein.nl/data/stories.json`).

---

## Stappenplan (productie)

Voer dit **in deze volgorde** uit in je terminal.

### 1. Worker-map en dependencies

```bash
cd workers
npm install
```

### 2. Inloggen bij Cloudflare

```bash
npx wrangler login
```

### 3. D1-database aanmaken

```bash
npx wrangler d1 create voorbijdekop-db
```

In de output staat een **`database_id`** (UUID). Kopieer die.

### 4. KV-namespace voor rate limiting

```bash
npx wrangler kv namespace create RATE_LIMIT
```

Kopieer het **`id`** uit de output.

### 5. `wrangler.toml` invullen

Open `workers/wrangler.toml` en:

- Zet `database_id` bij `[[d1_databases]]` (vervang `REPLACE_WITH_D1_DATABASE_ID`).
- Zet `id` bij `[[kv_namespaces]]` (vervang `REPLACE_WITH_KV_NAMESPACE_ID`).
- Pas `[vars]` aan:
  - **`SITE_URL`** — basis-URL van je site (zonder slash aan het eind), voor links in e-mails.
  - **`PUBLIC_API_URL`** — basis-URL van deze Worker (digest-/feedback-/afmelden), zonder slash, bijv. `https://api.voorbijdekop.nl`. Gebruikt in digest-mails voor de afmeldlink.
  - **`STORIES_JSON_URL`** — volledige URL naar je `stories.json` (moet in de browser te openen zijn).
  - **`DIGEST_TOP_N`** — maximaal aantal verhalen in de digest (string, bijv. `"10"`).
  - **`DIGEST_SKIP_IDENTICAL`** (optioneel) — standaard gedrag = overslaan als de top-slugs gelijk zijn aan de vorige succesvolle mail voor die abonnee; zet op `false` of `0` om dat uit te zetten (handig om elke cron-run te testen zonder `stories.json` te wijzigen; combineer eventueel met hoge **`DIGEST_MAX_PER_DAY`**).
  - **`DIGEST_MAX_PER_DAY`** (optioneel, default `1`) — maximaal zoveel **succesvolle** digests per kalenderdag (Europe/Amsterdam) per abonnee. Zet op `0` om de daglimiet uit te zetten.
  - **`DIGEST_MAX_PER_WEEK`** (optioneel, default `7`) — maximaal zoveel succesvolle digests in een **rol van 7 dagen** per abonnee. Zet op `0` om de weeklimiet uit te zetten.

### 6. Migraties op **remote** D1 toepassen

Dit maakt de tabellen op Cloudflare **voordat** de worker ze gebruikt:

```bash
npm run d1:remote
```

(Of: `npx wrangler d1 migrations apply voorbijdekop-db --remote`.)

### 7. Secrets zetten (Resend + beveiliging)

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM
npx wrangler secret put CRON_SECRET
```

- **RESEND_API_KEY** — begint meestal met `re_`.
- **RESEND_FROM** — mag alleen het adres zijn, bijv. `digest@mail.voorbijdekop.nl`; de Worker zet automatisch de weergavenaam **Voorbijdekop** ervoor (`Voorbijdekop <…>`). Je kunt ook zelf het volledige veld zetten: `Voorbijdekop <digest@…>`.
- **CRON_SECRET** — kies een lange willekeurige string; die gebruik je voor `/v1/cron/digest?secret=…` en `/v1/admin/summary?secret=…`.

Optioneel later:

```bash
npx wrangler secret put WEBHOOK_SECRET
```

### 8. Deploy

```bash
npm run deploy
```

Noteer de worker-URL (bijv. `https://voorbijdekop-api.<subdomain>.workers.dev`).

### 9. Web-app koppelen

In `web/.env.local` (of je hosting-env):

```bash
NEXT_PUBLIC_DIGEST_ENDPOINT=https://<jouw-worker-host>/v1/digest
NEXT_PUBLIC_FEEDBACK_ENDPOINT=https://<jouw-worker-host>/v1/feedback
```

Daarna opnieuw **build/export** van de Next-site zodat de variabelen in de statische bundle zitten.

### 10. Testen

1. **Digest:** op de site e-mail invullen → je zou een **bevestigingsmail** moeten krijgen (Resend) → link openen → status wordt `confirmed`.
2. Zonder mail testen (alleen dev): in Cloudflare D1 SQL o.i.d.:
   `UPDATE digest_subscribers SET status = 'confirmed' WHERE email = 'jij@voorbeeld.nl';`
3. **Handmatige digest-run:** in de browser (of curl):
   `GET https://<worker>/v1/cron/digest?secret=<CRON_SECRET>`
4. **Feedback:** op een storypagina feedback sturen; check met:
   `GET https://<worker>/v1/admin/summary?secret=<CRON_SECRET>`

---

## Lokaal ontwikkelen

```bash
cd workers
cp .dev.vars.example .dev.vars
# Vul .dev.vars met RESEND_* en CRON_SECRET (zelfde namen als secrets)
npm run d1:local
npx wrangler dev
```

Worker draait op `http://localhost:8787`. Zet in de web-app tijdelijk:

`NEXT_PUBLIC_DIGEST_ENDPOINT=http://localhost:8787/v1/digest` (alleen op je machine; CORS staat open).

**Let op:** lokale D1 is gescheiden van productie; `d1:local` vs `d1:remote` niet door elkaar halen.

## Endpoints

| Methode | Pad | Doel |
|--------|-----|------|
| `POST` | `/v1/digest` | Aanmelden; status `pending`, bevestigingsmail (als Resend gezet is) |
| `GET` | `/v1/confirm?token=…` | Zet status op `confirmed` |
| `GET`, `POST` | `/v1/unsubscribe?token=…` | Afmelden digest (`unsubscribe_token`); zelfde token voor browselink (GET) en **one-click** (POST, RFC 8058) |
| `POST` | `/v1/feedback` | Body: `{ slug, type, createdAt? }` (zelfde als frontend) |
| `POST` | `/v1/quiz/submit` | Body: `{ date, word, answer }` (crowd votes per woord per dag) |
| `POST` | `/v1/quiz/aggregate` | Body: `{ date, word, options }` (retour: counts + meest gekozen, incl. ties) |
| `GET` | `/v1/cron/digest?secret=…` | Handmatig digest-run (zelfde als cron) |
| `POST` | `/v1/webhooks/resend` | Optioneel: `Authorization: Bearer WEBHOOK_SECRET` — zet `bounced` / `complained` |
| `GET` | `/v1/admin/summary?secret=…` | JSON-export (zelfde secret als `CRON_SECRET`) |

## Cron / dagelijkse digest

`wrangler.toml` bevat `crons = ["0 6 * * *"]` (06:00 UTC). Alleen rijen met `status = 'confirmed'` krijgen mail. De job haalt `STORIES_JSON_URL` op en stuurt tot **N** (`DIGEST_TOP_N`) verhalen op importance en recency.

- **Per topic:** als `topics_json` bij de abonnee gevuld is (zoals bij aanmelden vanaf de site), worden alleen verhalen met dat topic meegenomen (met terugval naar alle verhalen als er geen match is).
- **Geen identieke digest (standaard aan):** na een succesvolle mail wordt per abonnee in **KV** o.a. een fingerprint van de gekozen top-**slugs** opgeslagen (`digest:state:…` in dezelfde namespace als `RATE_LIMIT`; oude installs met alleen `digest:lastfp:…` worden bij lezen automatisch meegenomen). Is de volgende run **inhoudelijk identiek** aan die vorige send, dan wordt die abonnee overgeslagen. Eerste succesvolle send na deploy of zonder KV-waarde mailt wél (mits quota hieronder het toelaat). Zet optioneel **`DIGEST_SKIP_IDENTICAL`** op `false` of `0` om identieke-inhoud-skip uit te zetten.
- **Max. frequentie:** standaard **hoogstens 1 succesvolle digest per dag** (kalenderdag Europe/Amsterdam) en **hoogstens 7 per rol van 7 dagen** — configureerbaar met **`DIGEST_MAX_PER_DAY`** en **`DIGEST_MAX_PER_WEEK`**. Zo voorkom je dubbele mail op dezelfde dag (bijv. handmatige cron + geplande cron) en kun je een strakkere weekcap instellen.
- **Resend:** bij tijdelijke fouten (5xx, 429) worden e-mails **beperkt opnieuw** geprobeerd met backoff; geen “één fout en volgende adres”.
- **Onderwerpregel:** `Voorbijdekop — [datum in Europe/Amsterdam]`.
- **Preheader + platte tekst + `List-Unsubscribe` + `List-Unsubscribe-Post`** (als `PUBLIC_API_URL` en `unsubscribe_token` gezet zijn; POST ondersteunt one-click afmelden bij grote providers).
- **Afzender:** zie **RESEND_FROM** hierboven (weergavenaam Voorbijdekop).
- **HTML:** miniaturen (`imageUrl` uit `stories.json` indien aanwezig), titel voorkeur `shortHeadline`, knop “Lees verder”, footer met echte afmeldlink en korte AI-transparantiezin.
- **Monitoring (logs):** bij mislukte fetch van `STORIES_JSON_URL`, lege storylijst of geen bevestigde abonnees verschijnt een regel **`[digest] ALERT:`**. Aan het einde van elke run: **`[digest] samenvatting:`** met o.a. verzonden, mislukt, overgeslagen wegens identieke inhoud, leeg, al verstuurd vandaag, weeklimiet, en totaal abonnees.

### Logpush / alerts (optioneel, in Cloudflare)

Dit hoort **niet** in de repo-code: in het Cloudflare-dashboard kun je **Workers Logs** naar een bestemming sturen (**Logpush**) of **Notifications** koppelen aan voorwaarden (bijv. op basis van logregels of fouten). Dat is **geen verplichting** om de digest te laten werken; het **kan** wel helpen om `STORIES_JSON_URL`-storingen of lege runs te merken zonder het dashboard te bekijken. Gebruik daarbij de **`[digest] ALERT:`**- of **`samenvatting:`**-regels als signaal.

## Frontend (statische Next-export)

Zet in `.env.local`:

```bash
NEXT_PUBLIC_DIGEST_ENDPOINT=https://<jouw-worker>.workers.dev/v1/digest
NEXT_PUBLIC_FEEDBACK_ENDPOINT=https://<jouw-worker>.workers.dev/v1/feedback
```

## Twee D1-databases?

De Worker gebruikt **alleen** de `database_id` uit `wrangler.toml`. Een tweede database in het dashboard is meestal **per ongeluk** aangemaakt; je kunt die **leeg laten of verwijderen** als er geen data in staat die je nodig hebt.

Als je **elders** (dashboard/SQL) extra kolommen had, bv. `confirmed_at`, en de “actieve” DB uit de repo-migraties **niet**: voer de **nieuwste migraties** op remote uit (`npm run d1:remote`). Migratie `0002` voegt o.a. **`confirmed_at`** toe en de worker vult die bij bevestigen. Daarna opnieuw **`npm run deploy`**.

Als `confirmed_at` op je actieve DB **al** bestond, kan `0002` falen (“duplicate column”) — dan hoeft die migratie niet meer; deploy alleen de bijgewerkte worker-code.

Heb je **nog meer** kolommen in de andere database die je wilt behouden? Voeg ze toe met een nieuwe migratie (`0003_…sql`) of kopieer handmatig `ALTER TABLE` naar de actieve DB, en pas `src/index.ts` aan als je die velden ook wilt schrijven.

### Uitdraai van de **oude** D1 (schema + tabellen) doorgeven

In de map `workers/` (Node 20+, `npx wrangler login`):

```bash
./scripts/d1-export-voor-migratie.sh <database-naam-in-dashboard>
```

- **`<database-naam-in-dashboard>`** = de **naam** van de database in Cloudflare (D1-overzicht), niet de UUID. Bijv. `voorbijdekop-db` of hoe je die tweede ook hebt genoemd.

Alleen **structuur** (geen rijen — handiger om te delen, geen e-mails in het bestand):

```bash
./scripts/d1-export-voor-migratie.sh <database-naam> schema
```

Het `.sql`-bestand komt in `workers/scripts/exports/` (die map staat in `.gitignore` voor `*.sql` — niet committen).

**Handmatig (zelfde effect als export):**

```bash
cd workers
npx wrangler d1 export <database-naam> --remote --output ./scripts/exports/oud.sql
# alleen schema:
npx wrangler d1 export <database-naam> --remote --output ./scripts/exports/oud-schema.sql --no-data
```

Die `.sql` of de inhoud ervan kun je doorsturen om migraties naar de **actieve** DB af te stemmen.

### Oude DB (`voorbijdekop_db`) vs actieve worker-tabellen

| Oud (`digest_signups`) | Nieuw (`digest_subscribers`) |
|------------------------|------------------------------|
| `email` | `email` |
| `topic` (enkelvoud) | `topic` + `topics_json` (array als JSON) |
| `status`, `created_at`, `confirmed_at`, `unsubscribed_at` | zelfde |
| `confirm_token`, `unsubscribe_token` | zelfde |
| `ip_hash`, `user_agent`, `source` | zelfde (migratie `0003` voegt kolommen toe) |

| Oud (`story_feedback`) | Nieuw (`feedback_entries`) |
|------------------------|------------------------------|
| `slug`, `type` | `slug`, `feedback_type` |
| `created_at`, `ip_hash`, `user_agent`, `source` | zelfde (`0003`) + `raw_json` extra |

Na **`npm run d1:remote`** op de actieve DB (`voorbijdekop-db`) zijn deze kolommen beschikbaar. Daarna **`npm run deploy`**.

**Rijen uit de oude DB overzetten:** export uit `voorbijdekop_db` met **data** (zonder `--no-data`), zet handmatig `INSERT INTO digest_subscribers (...)` regels om naar de nieuwe kolomnamen, of gebruik een tijdelijk script. Twee D1’s kunnen niet in één SQL-query joinen — export/import via bestand is de weg.

## Nog open / logische vervolgstappen

1. **Onderwerpen beheren** — abonnees laten wijzigen welke topics ze in de digest willen (nu: ingesteld bij aanmelding).
2. **Resend-webhooks** — payload kan afwijken; pas `/v1/webhooks/resend` aan op [Resend webhook docs](https://resend.com/docs/dashboard/webhooks) en zet webhook-URL in Resend-dashboard.
3. **Juridisch** — korte privacytekst bij digest- en feedbackformulier in de web-app + bewaartermijn documenteren.
4. **Admin** — CSV-export of betere auth i.p.v. alleen `?secret=`.

## Rate limits

Per IP-hash per uur, configureerbaar via `RATE_LIMIT_DIGEST` en `RATE_LIMIT_FEEDBACK` in `wrangler.toml`.
