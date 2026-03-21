/**
 * Client-side defensieve opschoning (zelfde logica als scripts/utils/stripAiMarkup.ts).
 */
export function stripAiMarkup(input: string): string {
  if (typeof input !== "string") return "";
  let t = input;
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");
  t = t.replace(/<\/li>\s*<li[^>]*>/gi, "\n• ");
  t = t.replace(/<\/(p|div|h[1-6]|section|article)>/gi, "\n\n");
  t = t.replace(/<li[^>]*>/gi, "• ");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/gi, " ");
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    const code = parseInt(h, 16);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
  });
  t = t.replace(/&#(\d+);/g, (_, n) => {
    const code = parseInt(n, 10);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
  });
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    ndash: "–",
    mdash: "—",
    hellip: "…",
  };
  t = t.replace(/&([a-zA-Z]+);/g, (m, name) => named[name.toLowerCase()] ?? m);
  return t
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}
