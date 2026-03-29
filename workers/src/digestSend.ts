import { sendEmailWithRetry } from "./resend.js";

export type StoryJson = {
  slug: string;
  title: string;
  shortHeadline?: string;
  summary?: string;
  importance?: number;
  generatedAt?: string;
  topic?: string;
  /** Volledige URL; kan in digest-mail als afbeelding */
  imageUrl?: string;
};

function sortStories(stories: StoryJson[]): StoryJson[] {
  return [...stories].sort((a, b) => {
    const imp = (b.importance ?? 0) - (a.importance ?? 0);
    if (imp !== 0) return imp;
    const bt = new Date(b.generatedAt ?? 0).getTime();
    const at = new Date(a.generatedAt ?? 0).getTime();
    return bt - at;
  });
}

export function pickTopStories(stories: StoryJson[], n: number): StoryJson[] {
  if (stories.length === 0 || n <= 0) return [];
  return sortStories(stories).slice(0, n);
}

/**
 * Als `topics_json` een niet-lege array is: alleen verhalen met passend `topic`;
 * anderszelfde globale top-N. Bij geen match vallen we terug op alle verhalen.
 */
export function pickTopStoriesForSubscriber(
  stories: StoryJson[],
  topicsJson: string | null | undefined,
  n: number
): StoryJson[] {
  let list = stories;
  if (topicsJson) {
    try {
      const topics = JSON.parse(topicsJson) as unknown;
      if (Array.isArray(topics) && topics.length > 0) {
        const set = new Set(topics.map((x) => String(x)));
        const filtered = stories.filter((s) => set.has(String(s.topic ?? "overig")));
        if (filtered.length > 0) list = filtered;
      }
    } catch {
      // ongeldige JSON: globale lijst
    }
  }
  return pickTopStories(list, n);
}

function headline(s: StoryJson): string {
  const h = (s.shortHeadline ?? s.title ?? "").toString().trim();
  return h || s.title;
}

function absoluteImageUrl(siteUrl: string, raw?: string): string | null {
  const u = (raw ?? "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const base = siteUrl.replace(/\/$/, "");
  if (u.startsWith("/")) return `${base}${u}`;
  return `${base}/${u}`;
}

export function formatNlLongDateAmsterdam(d: Date): string {
  return d.toLocaleDateString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDigestSubject(date: Date): string {
  return `Voorbijdekop — ${formatNlLongDateAmsterdam(date)}`;
}

export function htmlDigestEmail(params: {
  siteUrl: string;
  stories: StoryJson[];
  unsubscribeUrl?: string | null;
  preheader?: string;
}): string {
  const base = params.siteUrl.replace(/\/$/, "");
  const privacyUrl = `${base}/privacy`;
  const pre =
    params.preheader?.trim() ||
    (params.stories[0]
      ? `${headline(params.stories[0]).slice(0, 120)}${headline(params.stories[0]).length > 120 ? "…" : ""}`
      : "Dagelijkse selectie van voorbijdekop.");

  const items = params.stories
    .map((s) => {
      const sum = (s.summary ?? "").toString().slice(0, 160);
      const title = escapeHtml(headline(s));
      const href = `${base}/story/${encodeURIComponent(s.slug)}`;
      const imgUrl = absoluteImageUrl(base, s.imageUrl);
      const imgTd = imgUrl
        ? `<td width="120" valign="top" style="padding-right:12px;"><img src="${escapeHtml(imgUrl)}" width="112" height="63" alt="" style="display:block;width:112px;height:63px;object-fit:cover;border-radius:6px;border:0;" /></td>`
        : "";

      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;"><tr>
${imgTd}
<td valign="top" style="font-family:system-ui,-apple-system,sans-serif;">
<a href="${href}" style="color:#1a1a1a;font-weight:600;font-size:16px;text-decoration:none;">${title}</a>
<p style="margin:6px 0 0 0;color:#555;font-size:14px;line-height:1.45;">${escapeHtml(sum)}${sum.length >= 160 ? "…" : ""}</p>
<p style="margin:8px 0 0 0;"><a href="${href}" style="display:inline-block;padding:8px 14px;background:#7f1d1d;color:#fff!important;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Lees verder</a></p>
</td></tr></table>`;
    })
    .join("");

  const unsubUrl = params.unsubscribeUrl?.trim() ?? "";
  const unsubSentence =
    unsubUrl.length > 0
      ? `<a href="${escapeHtml(unsubUrl)}" style="color:#7f1d1d;">Afmelden voor deze nieuwsbrief</a>`
      : `<a href="${escapeHtml(privacyUrl)}" style="color:#7f1d1d;">Privacy — contact voor afmelden</a>`;

  const footerLegal =
    "Samenvattingen en verbanden zijn met AI gegenereerd op basis van geselecteerde bronnen. Controleer bij gevoelige onderwerpen altijd de originele artikelen.";

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">${escapeHtml(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:16px 8px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;padding:20px 18px;border:1px solid #e4e4e7;">
<tr><td style="font-family:system-ui,-apple-system,sans-serif;">
<p style="margin:0 0 16px 0;font-size:15px;color:#333;line-height:1.5;">Dagelijkse selectie van <strong>voorbijdekop</strong>.</p>
${items}
<hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
<p style="font-size:13px;color:#666;line-height:1.55;margin:0 0 12px 0;">Je ontvangt dit omdat je je hebt aangemeld voor de dagelijkse nieuwsbrief van Voorbijdekop.</p>
<p style="font-size:13px;color:#666;line-height:1.55;margin:0 0 12px 0;">${unsubSentence}</p>
<p style="font-size:12px;color:#888;line-height:1.5;margin:0;">${footerLegal} <a href="${escapeHtml(privacyUrl)}" style="color:#7f1d1d;">Privacy &amp; cookies</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function textDigestEmail(params: {
  siteUrl: string;
  stories: StoryJson[];
  unsubscribeUrl?: string | null;
}): string {
  const base = params.siteUrl.replace(/\/$/, "");
  const privacyUrl = `${base}/privacy`;
  const lines: string[] = [
    "Dagelijkse selectie van voorbijdekop.",
    "",
    ...params.stories.map((s) => {
      const h = headline(s);
      const url = `${base}/story/${encodeURIComponent(s.slug)}`;
      const sum = (s.summary ?? "").toString().replace(/\s+/g, " ").trim().slice(0, 220);
      return `${h}\n${sum}${sum.length >= 220 ? "…" : ""}\n${url}\n`;
    }),
    "",
    "Je ontvangt dit omdat je je hebt aangemeld voor de dagelijkse nieuwsbrief van Voorbijdekop."
  ];
  const unsub = params.unsubscribeUrl?.trim();
  if (unsub) {
    lines.push(`Afmelden: ${unsub}`);
  } else {
    lines.push(`Afmelden / privacy: ${privacyUrl}`);
  }
  lines.push(
    "",
    "Samenvattingen zijn met AI gegenereerd op basis van bronnen. Zie de website voor details.",
    privacyUrl
  );
  return lines.join("\n");
}

export async function sendDailyDigestToSubscriber(params: {
  apiKey: string;
  from: string;
  to: string;
  siteUrl: string;
  stories: StoryJson[];
  unsubscribeUrl?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const now = new Date();
  const subject = buildDigestSubject(now);
  const first = params.stories[0];
  const preheader = first
    ? `${headline(first).slice(0, 140)}${headline(first).length > 140 ? "…" : ""}`
    : "Nieuwe verhalen op voorbijdekop";

  const html = htmlDigestEmail({
    siteUrl: params.siteUrl,
    stories: params.stories,
    unsubscribeUrl: params.unsubscribeUrl,
    preheader
  });
  const text = textDigestEmail({
    siteUrl: params.siteUrl,
    stories: params.stories,
    unsubscribeUrl: params.unsubscribeUrl
  });

  const headers: Record<string, string> = {};
  const u = params.unsubscribeUrl?.trim();
  if (u) {
    headers["List-Unsubscribe"] = `<${u}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  return sendEmailWithRetry({
    apiKey: params.apiKey,
    from: params.from,
    to: params.to,
    subject,
    html,
    text,
    headers: Object.keys(headers).length ? headers : undefined
  });
}
