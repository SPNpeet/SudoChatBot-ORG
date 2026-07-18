import type { MetadataRoute } from "next";

const SITE = "https://sudochatbot.online";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/login`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/data-deletion`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
