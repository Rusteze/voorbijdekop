import type { MetadataRoute } from "next";
import { getAllStories } from "@/lib/generated.server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voorbijdekop.pages.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const stories = getAllStories();
  const storyEntries: MetadataRoute.Sitemap = stories.map((s: any) => ({
    url: `${SITE_URL}/story/${s.slug}`,
    lastModified: s.generatedAt ? new Date(s.generatedAt) : new Date(),
    changeFrequency: "hourly",
    priority: 0.8
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1
    },
    ...storyEntries
  ];
}
