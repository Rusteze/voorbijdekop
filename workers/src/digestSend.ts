import { sendEmail } from "./resend.js";

export type StoryJson = {
  slug: string;
  title: string;
  summary?: string;
  importance?: number;
  generatedAt?: string;
  topic?: string;
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
  return sortStories(stories).slice(0, Math.max(1, n));
}

export function htmlDigestEmail(params: {
  siteUrl: string;
  stories: StoryJson[];
  unsubscribeUrl?: string | null;
}): string {
  const base = params.siteUrl.replace(/\/$/, "");
  const privacyUrl = `${base}/privacy`;
  const items = params.stories
    .map((s) => {
      const sum = (s.summary ?? "").toString().slice(0, 180);
      const href = `${base}/story/${encodeURIComponent(s.slug)}`;
      return `<li style="margin-bottom:12px;"><a href="${href}" style="color:#1a1a1a;font-weight:600;">${escapeHtml(s.title)}</a><br/><span style="color:#555;font-size:14px;">${escapeHtml(sum)}${sum.length >= 180 ? "…" : ""}</span></li>`;
    })
    .join("");
  const unsubBlock =
    params.unsubscribeUrl && params.unsubscribeUrl.length > 0
      ? `<p style="font-size:13px;color:#888;margin-top:24px;">Afmelden voor deze digest: <a href="${escapeHtml(params.unsubscribeUrl)}">klik hier</a>.</p>`
      : `<p style="font-size:13px;color:#888;margin-top:24px;">Afmelden: gebruik de link in een volgende mail of zie <a href="${escapeHtml(privacyUrl)}">privacy &amp; cookies</a>.</p>`;
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:16px;">
<p style="font-size:15px;color:#333;">Dagelijkse selectie van voorbijdekop.</p>
<ul style="padding-left:18px;">${items}</ul>
${unsubBlock}
<p style="font-size:12px;color:#aaa;margin-top:16px;">Privacy: <a href="${escapeHtml(privacyUrl)}">${escapeHtml(privacyUrl)}</a></p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDailyDigestToSubscriber(params: {
  apiKey: string;
  from: string;
  to: string;
  siteUrl: string;
  stories: StoryJson[];
  unsubscribeUrl?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const html = htmlDigestEmail({
    siteUrl: params.siteUrl,
    stories: params.stories,
    unsubscribeUrl: params.unsubscribeUrl
  });
  return sendEmail({
    apiKey: params.apiKey,
    from: params.from,
    to: params.to,
    subject: "Voorbijdekop — dagelijkse digest",
    html
  });
}
