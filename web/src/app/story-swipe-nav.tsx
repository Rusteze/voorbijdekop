"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAllStories } from "@/lib/generated";
import { buildStoryFeed } from "@/lib/storyFeed";
import { useVoorbijDekop } from "./voorbijdekop-state";

const SWIPE_MIN_PX = 56;
const HORIZ_DOMINANCE = 1.35;
const COOLDOWN_MS = 340;

/**
 * Mobiel: veeg naar links = volgende in de feed (na het nieuwste eerst steeds ouder);
 * veeg naar rechts = terug naar nieuwer, of vanaf het nieuwste verhaal terug naar de homepage.
 * Alleen actief op smalle viewport + grove pointer (typisch telefoon), niet bij open overlays.
 */
export function StorySwipeNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { topic, query, searchOpen, settingsOpen, aiInfoOpen } = useVoorbijDekop();
  const [stories, setStories] = useState<any[]>(() => (typeof window !== "undefined" ? getAllStories() : []));
  const [sourceFilter, setSourceFilter] = useState("alle");
  const [swipeEnabled, setSwipeEnabled] = useState(false);
  const cooldownRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    const apply = () => setSwipeEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem("vdk-source-filter");
      if (s) setSourceFilter(s);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/stories.json", { cache: "no-store" });
        if (!res.ok) return;
        const parsed = (await res.json()) as any[];
        if (!cancelled && Array.isArray(parsed)) setStories(parsed);
      } catch {
        if (!cancelled) setStories(getAllStories());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slug = useMemo(() => {
    if (pathname === "/") return null;
    if (!pathname.startsWith("/story/")) return undefined;
    const rest = pathname.slice("/story/".length);
    const seg = rest.split("/")[0];
    return seg || undefined;
  }, [pathname]);

  const feedFiltered = useMemo(() => {
    if (!stories.length) return [];
    return buildStoryFeed(stories, { topic, query, sourceFilter });
  }, [stories, topic, query, sourceFilter]);

  const feedFallback = useMemo(
    () => buildStoryFeed(stories, { topic: "alle", query: "", sourceFilter: "alle" }),
    [stories]
  );

  const navFeed = useMemo(() => {
    if (slug === null || slug === undefined) return feedFiltered;
    const inFiltered = feedFiltered.some((s) => s.slug === slug);
    return inFiltered ? feedFiltered : feedFallback;
  }, [feedFiltered, feedFallback, slug]);

  const vibrate = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      // ignore
    }
  };

  const goOlder = useCallback(() => {
    const now = Date.now();
    if (now - cooldownRef.current < COOLDOWN_MS) return;

    if (slug === null) {
      const first = navFeed[0];
      if (first) {
        cooldownRef.current = now;
        router.push(`/story/${first.slug}`);
        vibrate();
      }
      return;
    }
    if (slug === undefined) return;

    const idx = navFeed.findIndex((s) => s.slug === slug);
    if (idx === -1) return;
    const next = navFeed[idx + 1];
    if (next) {
      cooldownRef.current = now;
      router.push(`/story/${next.slug}`);
      vibrate();
    }
  }, [navFeed, router, slug]);

  const goNewer = useCallback(() => {
    const now = Date.now();
    if (now - cooldownRef.current < COOLDOWN_MS) return;

    if (slug === null || slug === undefined) return;

    const idx = navFeed.findIndex((s) => s.slug === slug);
    if (idx === -1) return;
    if (idx <= 0) {
      cooldownRef.current = now;
      router.push("/");
      vibrate();
      return;
    }
    const prev = navFeed[idx - 1];
    if (prev) {
      cooldownRef.current = now;
      router.push(`/story/${prev.slug}`);
      vibrate();
    }
  }, [navFeed, router, slug]);

  useEffect(() => {
    if (!swipeEnabled) return;
    if (slug === undefined) return;
    if (searchOpen || settingsOpen || aiInfoOpen) return;

    let startX = 0;
    let startY = 0;
    let active = false;
    let pointerId: number | null = null;

    const isInteractive = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return false;
      return Boolean(
        el.closest("a,button,input,textarea,select,label,[role='slider'],[data-no-swipe-nav]")
      );
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (isInteractive(e.target)) return;
      active = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (!active || e.pointerType !== "touch") return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      active = false;
      pointerId = null;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < SWIPE_MIN_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZ_DOMINANCE) return;

      if (dx < 0) goOlder();
      else goNewer();
    };

    const onCancel = (e: PointerEvent) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      active = false;
      pointerId = null;
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [swipeEnabled, slug, searchOpen, settingsOpen, aiInfoOpen, goOlder, goNewer]);

  return null;
}
