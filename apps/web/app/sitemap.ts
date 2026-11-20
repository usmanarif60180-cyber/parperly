import type { MetadataRoute } from "next";
import tools from "../../../packages/tool-registry/tools.json";
import brand from "../../../packages/config/brand.json";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "tools",
    "workflows",
    "about",
    "help",
    "privacy",
    "security",
    "terms",
    "cookies",
    "contact",
    "desktop",
    "developer",
    "pricing",
    ...tools.map((t) => "tools/" + t.id),
  ].map((p) => ({
    url: brand.siteUrl + "/" + (p ? p + "/" : ""),
    changeFrequency: "weekly",
    priority: p ? 0.7 : 1,
  }));
}
