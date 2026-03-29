/** Resend REST API (https://resend.com/docs) */

export type SendEmailResult = { ok: boolean; error?: string; status?: number };

export async function sendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}): Promise<SendEmailResult> {
  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html
  };
  if (params.text && params.text.trim()) {
    body.text = params.text;
  }
  if (params.headers && Object.keys(params.headers).length > 0) {
    body.headers = params.headers;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `${res.status} ${t.slice(0, 200)}`, status: res.status };
  }
  return { ok: true, status: res.status };
}

const MAX_ATTEMPTS = 3;

/** Retry bij 5xx of 429 (rate limit); exponentiële backoff. */
export async function sendEmailWithRetry(
  params: Parameters<typeof sendEmail>[0]
): Promise<SendEmailResult> {
  let last: SendEmailResult = { ok: false, error: "geen poging" };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await sendEmail(params);
    if (last.ok) return last;
    const st = last.status ?? 0;
    const retryable = st >= 500 || st === 429;
    if (!retryable || attempt === MAX_ATTEMPTS) {
      return last;
    }
    const ms = 400 * Math.pow(2, attempt - 1);
    console.warn(`[digest] Resend poging ${attempt}/${MAX_ATTEMPTS} mislukt (${st}), retry over ${ms}ms`);
    await new Promise((r) => setTimeout(r, ms));
  }
  return last;
}
