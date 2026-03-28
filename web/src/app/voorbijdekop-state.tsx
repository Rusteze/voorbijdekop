/* Client-side state shared between header and pages */
"use client";

import { usePathname } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { GeneratedStory } from "@/lib/generated";

type TopicId = NonNullable<GeneratedStory["topic"]> | "alle";

type VoorbijDekopState = {
  query: string;
  setQuery: (q: string) => void;
  topic: TopicId;
  setTopic: (t: TopicId) => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  aiInfoOpen: boolean;
  openAiInfo: () => void;
  closeAiInfo: () => void;
};

const Ctx = createContext<VoorbijDekopState | null>(null);

export function VoorbijDekopProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<TopicId>("alle");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openSettings = () => setSettingsOpen(true);
  const closeSettings = () => setSettingsOpen(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = () => setSearchOpen(true);
  /** Sluit overlay en wist zoekterm: filter hoort bij de voorpagina / “klaar met zoeken”. */
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  // Zoekterm is bedoeld voor de story-lijst op `/`; op detailpagina’s niet laten hangen.
  useEffect(() => {
    if (pathname !== "/") setQuery("");
  }, [pathname]);

  const [aiInfoOpen, setAiInfoOpen] = useState(false);
  const openAiInfo = () => setAiInfoOpen(true);
  const closeAiInfo = () => setAiInfoOpen(false);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      topic,
      setTopic,
      settingsOpen,
      openSettings,
      closeSettings,
      searchOpen,
      openSearch,
      closeSearch,
      aiInfoOpen,
      openAiInfo,
      closeAiInfo,
    }),
    [query, topic, settingsOpen, searchOpen, aiInfoOpen, closeSearch]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoorbijDekop() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVoorbijDekop must be used within VoorbijDekopProvider");
  return v;
}

