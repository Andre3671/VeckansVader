import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/cities";

const BASE = "https://veckansvader.se";

/**
 * Sitemap: homepage + API docs + one URL per city. Cities are updated
 * (lastModified) often because their forecast revalidates every 30 min.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${BASE}/vader`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE}/api-docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    ...CITIES.map((c) => ({
      url: `${BASE}/vader/${c.slug}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  ];
}
