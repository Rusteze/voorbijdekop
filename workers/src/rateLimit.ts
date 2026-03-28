/** Eenvoudige fixed-window rate limit in KV (key verloopt impliciet door nieuw uur). */

function hourBucket(): number {
  return Math.floor(Date.now() / 3600000);
}

export async function checkRateLimit(
  kv: KVNamespace,
  ipHash: string,
  route: string,
  maxPerHour: number
): Promise<{ ok: boolean; remaining: number }> {
  const key = `rl:${ipHash}:${route}:${hourBucket()}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= maxPerHour) {
    return { ok: false, remaining: 0 };
  }
  const next = count + 1;
  await kv.put(key, String(next), { expirationTtl: 7200 });
  return { ok: true, remaining: maxPerHour - next };
}

export async function hashIp(ip: string): Promise<string> {
  const enc = new TextEncoder().encode(ip.trim() || "unknown");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 32);
}
