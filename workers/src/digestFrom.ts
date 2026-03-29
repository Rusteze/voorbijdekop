/** Zorgt voor weergavenaam "Voorbijdekop" als RESEND_FROM alleen een e-mailadres is. */
export function formatResendFrom(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^[^\s<]+@[^\s>]+\s*</.test(t) || (t.includes("<") && t.includes(">"))) {
    return t;
  }
  if (t.includes("@") && !t.includes("<")) {
    return `Voorbijdekop <${t}>`;
  }
  return t;
}
