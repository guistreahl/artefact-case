import type { MetadataRoute } from "next";

// Nenhum robô é bem-vindo. Os que respeitam o robots.txt param aqui; os que
// não respeitam encontram o desafio do Cloudflare e o limite de alterações.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
