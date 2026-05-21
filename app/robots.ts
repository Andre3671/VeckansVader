import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Don't crawl the API — it's for consumers, not search index.
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://veckansvader.se/sitemap.xml",
    host: "https://veckansvader.se",
  };
}
