import { checkRateLimit, hashIp } from "./rateLimit";
import { pickTopStories, sendDailyDigestToSubscriber, type StoryJson } from "./digestSend";
import { sendEmail } from "./resend";

export interface Env {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  SITE_URL: string;
  STORIES_JSON_URL: string;
  DIGEST_TOP_N: string;
  RATE_LIMIT_DIGEST: string;
  RATE_LIMIT_FEEDBACK: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  CRON_SECRET?: string;
  WEBHOOK_SECRET?: string;
}

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
});

function json(data: unknown, status = 200, origin?: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors(origin) }
  });
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? "0.0.0.0";
}

function randomToken(): string {
  const u = new Uint8Array(24);
  crypto.getRandomValues(u);
  return [...u].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchStories(url: string): Promise<StoryJson[]> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`stories fetch ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("stories.json is geen array");
  return data as StoryJson[];
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? undefined;
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(origin) });
    }

    try {
      // --- Handmatige cron-trigger (zelfde logica als scheduled) ---
      if (path === "/v1/cron/digest" && request.method === "GET") {
        const secret = url.searchParams.get("secret") ?? "";
        if (env.CRON_SECRET && secret !== env.CRON_SECRET) {
          return json({ error: "unauthorized" }, 401, origin);
        }
        ctx.waitUntil(runDailyDigest(env));
        return json({ ok: true, message: "digest gestart (async)" }, 202, origin);
      }

      // --- Dubbele opt-in ---
      if (path === "/v1/confirm" && request.method === "GET") {
        const token = url.searchParams.get("token") ?? "";
        if (!token) return json({ error: "token ontbreekt" }, 400, origin);
        const now = new Date().toISOString();
        const r = await env.DB.prepare(
          "UPDATE digest_subscribers SET status = 'confirmed', updated_at = ?, confirmed_at = ? WHERE confirm_token = ? AND status = 'pending'"
        )
          .bind(now, now, token)
          .run();
        if (!r.success || (r.meta.changes ?? 0) === 0) {
          return new Response(
            "<!DOCTYPE html><html><body><p>Link ongeldig of al gebruikt.</p></body></html>",
            { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
          );
        }
        return new Response(
          "<!DOCTYPE html><html><body><p>Je bent aangemeld voor de digest.</p></body></html>",
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
        );
      }

      // --- Digest aanmelden ---
      if (path === "/v1/digest" && request.method === "POST") {
        const ip = clientIp(request);
        const ipHash = await hashIp(ip);
        const max = parseInt(env.RATE_LIMIT_DIGEST ?? "20", 10) || 20;
        const rl = await checkRateLimit(env.RATE_LIMIT, ipHash, "digest", max);
        if (!rl.ok) return json({ error: "rate_limited" }, 429, origin);

        let body: { email?: string; topic?: string | null; topics?: string[] };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid_json" }, 400, origin);
        }
        const email = (body.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ error: "invalid_email" }, 400, origin);
        }

        const topicsArr =
          Array.isArray(body.topics) && body.topics.length > 0
            ? body.topics
            : body.topic
              ? [body.topic]
              : [];
        const topicsJson = topicsArr.length ? JSON.stringify(topicsArr) : null;
        const topicSingle = topicsArr[0] ?? null;
        const token = randomToken();
        const unsubscribeToken = randomToken();
        const now = new Date().toISOString();
        const userAgent = (request.headers.get("User-Agent") ?? "").slice(0, 512);

        try {
          await env.DB.prepare(
            `INSERT INTO digest_subscribers (email, status, topics_json, confirm_token, created_at, ip_hash, source, user_agent, topic, unsubscribe_token)
             VALUES (?, 'pending', ?, ?, ?, ?, 'web', ?, ?, ?)`
          )
            .bind(email, topicsJson, token, now, ipHash, userAgent || null, topicSingle, unsubscribeToken)
            .run();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("UNIQUE")) {
            return json({ ok: true, message: "al geregistreerd (pending of bevestigd)" }, 200, origin);
          }
          throw e;
        }

        if (env.RESEND_API_KEY && env.RESEND_FROM) {
          const confirmUrl = `${url.origin}/v1/confirm?token=${encodeURIComponent(token)}`;
          const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:16px;">
<p>Bevestig je aanmelding voor de dagelijkse digest:</p>
<p><a href="${confirmUrl}">${confirmUrl}</a></p>
</body></html>`;
          await sendEmail({
            apiKey: env.RESEND_API_KEY,
            from: env.RESEND_FROM,
            to: email,
            subject: "Bevestig je aanmelding — voorbijdekop",
            html
          });
        }

        return json({ ok: true, pending: true }, 202, origin);
      }

      // --- Feedback (zelfde shape als web/story-feedback) ---
      if (path === "/v1/feedback" && request.method === "POST") {
        const ip = clientIp(request);
        const ipHash = await hashIp(ip);
        const max = parseInt(env.RATE_LIMIT_FEEDBACK ?? "40", 10) || 40;
        const rl = await checkRateLimit(env.RATE_LIMIT, ipHash, "feedback", max);
        if (!rl.ok) return json({ error: "rate_limited" }, 429, origin);

        let body: { slug?: string; type?: string; createdAt?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid_json" }, 400, origin);
        }
        const slug = (body.slug ?? "").trim();
        const type = (body.type ?? "").trim();
        if (!slug || !type) return json({ error: "slug_en_type_verplicht" }, 400, origin);

        const createdAt = body.createdAt ?? new Date().toISOString();
        const rawJson = JSON.stringify(body);
        const userAgent = (request.headers.get("User-Agent") ?? "").slice(0, 512);
        await env.DB.prepare(
          `INSERT INTO feedback_entries (slug, feedback_type, created_at, ip_hash, raw_json, source, user_agent) VALUES (?, ?, ?, ?, ?, 'web', ?)`
        )
          .bind(slug, type, createdAt, ipHash, rawJson, userAgent || null)
          .run();

        return json({ ok: true }, 200, origin);
      }

      // --- Resend webhook: bounces / klachten (minimaal) ---
      if (path === "/v1/webhooks/resend" && request.method === "POST") {
        const auth = request.headers.get("Authorization") ?? "";
        const expected = env.WEBHOOK_SECRET ? `Bearer ${env.WEBHOOK_SECRET}` : null;
        if (expected && auth !== expected) {
          return json({ error: "unauthorized" }, 401, origin);
        }
        let payload: { type?: string; data?: { email?: string } };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "invalid_json" }, 400, origin);
        }
        const email = payload.data?.email?.toLowerCase().trim();
        if (
          email &&
          (payload.type === "email.bounced" ||
            payload.type === "email.complained" ||
            payload.type === "email.delivery_delayed")
        ) {
          const status = payload.type === "email.complained" ? "complained" : "bounced";
          await env.DB.prepare("UPDATE digest_subscribers SET status = ?, updated_at = ? WHERE email = ?")
            .bind(status, new Date().toISOString(), email)
            .run();
        }
        return json({ ok: true }, 200, origin);
      }

      // --- Admin: simpele export (JSON) ---
      if (path === "/v1/admin/summary" && request.method === "GET") {
        const secret = url.searchParams.get("secret") ?? "";
        if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
          return json({ error: "unauthorized" }, 401, origin);
        }
        const subs = await env.DB.prepare(
          "SELECT id, email, status, topics_json, topic, source, created_at, confirmed_at, updated_at, unsubscribed_at, ip_hash, user_agent, confirm_token, unsubscribe_token FROM digest_subscribers ORDER BY id DESC LIMIT 500"
        ).all<Record<string, unknown>>();
        const fb = await env.DB.prepare(
          "SELECT id, slug, feedback_type, source, created_at, ip_hash, user_agent, raw_json FROM feedback_entries ORDER BY id DESC LIMIT 500"
        ).all<Record<string, unknown>>();
        return json({ digest_subscribers: subs.results ?? [], feedback: fb.results ?? [] }, 200, origin);
      }

      return json({ error: "not_found" }, 404, origin);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[worker]", msg);
      return json({ error: "server_error", detail: msg }, 500, origin);
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runDailyDigest(env));
  }
};

async function runDailyDigest(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    console.warn("[digest] RESEND_API_KEY of RESEND_FROM ontbreekt — overslaan");
    return;
  }

  let stories: StoryJson[];
  try {
    stories = await fetchStories(env.STORIES_JSON_URL);
  } catch (e) {
    console.error("[digest] stories fetch mislukt", e);
    return;
  }

  const n = parseInt(env.DIGEST_TOP_N ?? "10", 10) || 10;
  const top = pickTopStories(stories, n);
  const siteUrl = env.SITE_URL.replace(/\/$/, "");

  const rows = await env.DB.prepare(
    "SELECT email FROM digest_subscribers WHERE status = 'confirmed' AND unsubscribed_at IS NULL"
  ).all<{
    email: string;
  }>();
  const emails = (rows.results ?? []).map((r) => r.email).filter(Boolean);
  console.log(`[digest] versturen naar ${emails.length} abonnees, ${top.length} verhalen`);

  for (const to of emails) {
    const r = await sendDailyDigestToSubscriber({
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM,
      to,
      siteUrl,
      stories: top
    });
    if (!r.ok) console.error(`[digest] mislukt voor ${to}`, r.error);
    await new Promise((r) => setTimeout(r, 150));
  }
}
