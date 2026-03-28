/** Resend REST API (https://resend.com/docs) */

export async function sendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html
    })
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `${res.status} ${t.slice(0, 200)}` };
  }
  return { ok: true };
}
