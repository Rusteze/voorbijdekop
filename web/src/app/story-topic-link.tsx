"use client";

import Link from "next/link";
import { topicLabel } from "@/lib/storyUtils";
import { resolveTopicFromAi } from "@/lib/storyTopicsRegistry";

type Props = {
  topic?: string | null;
  category?: string | null;
};

/** Toont het onderwerp als label; link naar voorpagina met hetzelfde topic gefilterd. */
export function StoryTopicLink({ topic, category }: Props) {
  const raw = (topic ?? category ?? "").toString().trim();
  const canonical = resolveTopicFromAi(raw || "overig");
  const href = `/?topic=${encodeURIComponent(canonical)}`;
  const label = topicLabel(canonical);

  return (
    <p className="mt-4 text-sm text-gray-500 dark:text-gray-300">
      <span className="text-gray-500 dark:text-gray-400">Onderwerp: </span>
      <Link
        href={href}
        className="font-medium text-gray-800 underline-offset-2 hover:underline dark:text-gray-200"
        title="Ga naar de voorpagina met dit onderwerp gefilterd"
      >
        {label}
      </Link>
    </p>
  );
}
