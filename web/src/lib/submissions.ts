"use client";

type JsonRecord = Record<string, unknown>;

async function postJson(endpoint: string, payload: JsonRecord) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`submit failed: ${res.status}`);
}

function saveLocal(storageKey: string, payload: JsonRecord) {
  const raw = window.localStorage.getItem(storageKey);
  const arr = raw ? JSON.parse(raw) : [];
  const next = Array.isArray(arr) ? arr : [];
  next.push(payload);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
}

export async function submitWithFallback(options: {
  endpoint?: string;
  storageKey: string;
  payload: JsonRecord;
}) {
  const { endpoint, storageKey, payload } = options;
  if (endpoint && endpoint.trim()) {
    try {
      await postJson(endpoint, payload);
      return { persisted: "remote" as const };
    } catch {
      // fall through to local fallback
    }
  }
  saveLocal(storageKey, payload);
  return { persisted: "local" as const };
}
