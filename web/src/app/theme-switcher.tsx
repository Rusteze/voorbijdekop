"use client";

import React, { useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme";

function resolveTheme(mode: ThemeMode) {
  if (mode === "light") return "light";
  return "dark";
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "dark") return "dark";
  return "light";
}

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode());

  const resolved = useMemo(() => {
    if (typeof window === "undefined") return "light";
    return resolveTheme(mode);
  }, [mode]);

  useEffect(() => {
    const applyResolved = () => {
      const next = resolveTheme(mode);
      const el = document.documentElement;
      el.classList.remove("light", "dark");
      el.classList.add(next);
    };

    applyResolved();
  }, [mode]);

  useEffect(() => {
    try {
      // Migreer oude "system" waarde naar "light" zodat OS-thema niet meer leidend is.
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "system") {
        window.localStorage.setItem(STORAGE_KEY, "light");
      }
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const option = (value: ThemeMode, title: string, subtitle?: string) => {
    const selected = mode === value;
    return (
      <label
        key={value}
        className={
          "flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-2 transition-colors " +
          (selected ? "bg-[var(--text)] text-[var(--bg)]" : "bg-transparent text-[var(--muted)] hover:bg-black/5")
        }
      >
        <input
          type="radio"
          name="theme"
          value={value}
          checked={selected}
          onChange={() => setMode(value)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={
            "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border transition-colors " +
            (selected ? "border-[var(--bg)] bg-[var(--bg)]" : "border-[var(--muted)] bg-transparent")
          }
        />
        <span className="flex-1">
          <span className={"block text-sm font-medium leading-snug" + (selected ? "" : "")}>{title}</span>
          {subtitle ? (
            <span
              className={
                "block text-xs leading-snug " + (selected ? "text-[var(--bg)]/80" : "text-[var(--muted)]")
              }
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      </label>
    );
  };

  return (
    <div>
      <div className="text-sm font-semibold text-[var(--text)]">Weergave</div>
      <div className="mt-3 space-y-2">
        {option("light", "Licht")}
        {option("dark", "Donker")}
      </div>
    </div>
  );
}

