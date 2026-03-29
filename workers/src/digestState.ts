import type { StoryJson } from "./digestSend.js";
import { storyListFingerprint } from "./digestFingerprint.js";

/** Legacy KV-key (alleen nog voor migratie). */
export async function digestLegacyFpKvKey(email: string): Promise<string> {
  const enc = new TextEncoder().encode(email.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `digest:lastfp:${hex.slice(0, 40)}`;
}

export async function digestStateKvKey(email: string): Promise<string> {
  const enc = new TextEncoder().encode(email.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `digest:state:${hex.slice(0, 40)}`;
}

/** Kalenderdag Europe/Amsterdam als YYYY-MM-DD. */
export function amsterdamDateString(ms: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(ms));
}

export type DigestSubscriberState = {
  fp?: string;
  lastSentDay?: string;
  /** Unix-ms van succesvolle sends, voor rolling 7 dagen. */
  weekSendTimes?: number[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function pruneWeekSendTimes(times: number[] | undefined, now: number): number[] {
  const cutoff = now - WEEK_MS;
  return (times ?? []).filter((t) => t > cutoff).sort((a, b) => a - b);
}

export async function loadDigestSubscriberState(
  kv: KVNamespace,
  email: string
): Promise<DigestSubscriberState> {
  const key = await digestStateKvKey(email);
  const raw = await kv.get(key);
  if (raw) {
    try {
      const o = JSON.parse(raw) as DigestSubscriberState;
      if (o && typeof o === "object") return o;
    } catch {
      /* legacy */
    }
  }
  const legacy = await kv.get(await digestLegacyFpKvKey(email));
  if (legacy && legacy.length > 0 && !legacy.startsWith("{")) {
    return { fp: legacy, weekSendTimes: [] };
  }
  return {};
}

export async function saveDigestSubscriberState(kv: KVNamespace, email: string, state: DigestSubscriberState): Promise<void> {
  const key = await digestStateKvKey(email);
  await kv.put(key, JSON.stringify(state));
}

/** Na succesvolle mail: fp, dag, weeklijst bijwerken. Verwijdert legacy key indien aanwezig. */
export async function persistAfterSuccessfulSend(
  kv: KVNamespace,
  email: string,
  top: StoryJson[],
  nowMs: number,
  prev: DigestSubscriberState
): Promise<void> {
  const fp = storyListFingerprint(top);
  const day = amsterdamDateString(nowMs);
  const weekSendTimes = pruneWeekSendTimes(prev.weekSendTimes, nowMs);
  weekSendTimes.push(nowMs);
  const state: DigestSubscriberState = {
    fp,
    lastSentDay: day,
    weekSendTimes
  };
  await saveDigestSubscriberState(kv, email, state);
  try {
    await kv.delete(await digestLegacyFpKvKey(email));
  } catch {
    /* best-effort */
  }
}
