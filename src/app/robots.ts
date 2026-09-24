import type { MetadataRoute } from "next";

// No robot is welcome. The ones that honour robots.txt stop here; the ones
// that do not run into Cloudflare's challenge and the change limit.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
