import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained Node server in .next/standalone. The Docker
  // image copies only that, not the whole node_modules.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HTTPS only on this subdomain for a year. No includeSubDomains: the
          // rule does not reach the domain's other addresses.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          // Demo application: no search engine should index it.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
