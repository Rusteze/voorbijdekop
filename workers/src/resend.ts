/** Resend REST API (https://resend.com/docs) */

export async function sendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string }> {
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
    return { ok: false, error: `${res.status} ${t.slice(0, 200)}` };
  }
  return { ok: true };
}
