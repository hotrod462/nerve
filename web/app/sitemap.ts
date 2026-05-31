import type { MetadataRoute } from "next";
import { listRuns } from "@/lib/loadRun";
import { SITE_URL } from "@/lib/geo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/compare`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/matrix`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/llms.txt`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const runs = listRuns().filter((r) => !r.manifest.contrast);
  const trackRoutes: MetadataRoute.Sitemap = runs.map((run) => ({
    url: `${SITE_URL}/tracks/${encodeURIComponent(run.id)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...trackRoutes];
}
