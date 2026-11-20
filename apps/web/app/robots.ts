import type { MetadataRoute } from "next";
import brand from "../../../packages/config/brand.json";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/account/" },
    sitemap: brand.siteUrl + "/sitemap.xml",
  };
}
