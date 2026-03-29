"use client";

import Link from "next/link";
import { useState } from "react";
import { submitWithFallback } from "@/lib/submissions";
import { useVoorbijDekop } from "./voorbijdekop-state";

const FOLLOWED_TOPICS_KEY = "followed-topics-v1";

function readFollowedTopicsFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLLOWED_TOPICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

type Variant = "sidebar" | "menu";

export function DigestSignupCard({ variant = "sidebar" }: { variant?: Variant }) {
  const DIGEST_ENDPOINT = process.env.NEXT_PUBLIC_DIGEST_ENDPOINT;
  const { topic } = useVoorbijDekop();
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveMode, setSaveMode] = useState<"remote" | "local" | null>(null);

  const isMenu = variant === "menu";

  return (
    <div
      className={
        isMenu
          ? "rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
          : "mb-5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
      }
    >
      <div className="text-xs font-semibold tracking-wide text-zinc-500">Dagelijkse digest</div>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
        Ontvang dagelijks een korte update per e-mail. Je ontvangt eerst een bevestigingslink; daarna wordt je adres
        alleen gebruikt voor de digest. Zie{" "}
        <Link href="/privacy" className="font-medium text-red-900 underline underline-offset-2 dark:text-red-200">
          privacy &amp; cookies
        </Link>{" "}
        voor gegevensverwerking en afmelden.
      </p>
      <form
        className={`mt-3 flex gap-2 ${isMenu ? "flex-col" : ""}`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!email.trim()) return;
          try {
            const followedTopics = readFollowedTopicsFromStorage();
            const result = await submitWithFallback({
              endpoint: DIGEST_ENDPOINT,
              storageKey: "digest-signups-v1",
              payload: {
                email: email.trim().toLowerCase(),
                createdAt: new Date().toISOString(),
                topic: topic === "alle" ? null : topic,
                topics:
                  followedTopics.length > 0
                    ? followedTopics
                    : topic !== "alle"
                      ? [topic]
                      : []
              }
            });
            setSaveMode(result.persisted);
            setSaved(true);
            setEmail("");
          } catch {
            // ignore
          }
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSaved(false);
            setSaveMode(null);
          }}
          placeholder="jij@voorbeeld.nl"
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          className={`shrink-0 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 ${isMenu ? "w-full" : ""}`}
        >
          Aanmelden
        </button>
      </form>
      {saved ? (
        <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          {saveMode === "remote" ? "Online opgeslagen." : "Lokaal opgeslagen."}
        </div>
      ) : null}
    </div>
  );
}
