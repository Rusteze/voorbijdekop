# voorbijdekop-api (Cloudflare Worker)

Dagelijkse digest per e-mail (Resend), aanmeldingen met dubbele opt-in, story-feedback in D1, rate limiting via KV, optionele webhooks.

## Snelstart

```bash
cd workers
npm install
wrangler login
wrangler d1 create voorbijdekop-db
wrangler kv namespace create RATE_LIMIT
```

Vul in `wrangler.toml` de `database_id` en KV `id` in (output van de commands hierboven). Zet `SITE_URL` en `STORIES_JSON_URL` naar je productie-URL (waar `/data/stories.json` statisch wordt gehost).

```bash
npm run d1:local
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM
wrangler secret put CRON_SECRET
npm run deploy
npm run d1:remote
```

Lokaal: kopieer `.dev.vars.example` naar `.dev.vars` en vul secrets in. `wrangler dev` start de worker op `http://localhost:8787`.

## Endpoints

| Methode | Pad | Doel |
|--------|-----|------|
| `POST` | `/v1/digest` | Aanmelden; status `pending`, bevestigingsmail (als Resend gezet is) |
| `GET` | `/v1/confirm?token=…` | Zet status op `confirmed` |
| `POST` | `/v1/feedback` | Body: `{ slug, type, createdAt? }` (zelfde als frontend) |
| `GET` | `/v1/cron/digest?secret=…` | Handmatig digest-run (zelfde als cron) |
| `POST` | `/v1/webhooks/resend` | Optioneel: `Authorization: Bearer WEBHOOK_SECRET` — zet `bounced` / `complained` |
| `GET` | `/v1/admin/summary?secret=…` | JSON-export (zelfde secret als `CRON_SECRET`) |

## Cron

`wrangler.toml` bevat `crons = ["0 6 * * *"]` (06:00 UTC). Alleen rijen met `status = 'confirmed'` krijgen mail. De job haalt `STORIES_JSON_URL` op en stuurt de top **N** ( `DIGEST_TOP_N` ) verhalen gesorteerd op importance en recency.

## Frontend (statische Next-export)

Zet in `.env.local`:

```bash
NEXT_PUBLIC_DIGEST_ENDPOINT=https://<jouw-worker>.workers.dev/v1/digest
NEXT_PUBLIC_FEEDBACK_ENDPOINT=https://<jouw-worker>.workers.dev/v1/feedback
```

## Nog open / logische vervolgstappen

1. **Afmelden (unsubscribe)** — link in elke digest-mail + kolom `status = unsubscribed` + endpoint `GET /v1/unsubscribe?token=…`.
2. **Per-topic digest** — `topics_json` bij subscriber gebruiken om te filteren vóór verzenden (nu: alleen globale top N).
3. **Resend-webhooks** — payload kan afwijken; pas `/v1/webhooks/resend` aan op [Resend webhook docs](https://resend.com/docs/dashboard/webhooks) en zet webhook-URL in Resend-dashboard.
4. **Juridisch** — korte privacytekst bij digest- en feedbackformulier in de web-app + bewaartermijn documenteren.
5. **Admin** — CSV-export of betere auth i.p.v. alleen `?secret=`.

## Rate limits

Per IP-hash per uur, configureerbaar via `RATE_LIMIT_DIGEST` en `RATE_LIMIT_FEEDBACK` in `wrangler.toml`.
