import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor Node autocontido em .next/standalone. A imagem Docker
  // copia só isso, sem o node_modules inteiro.
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
          // Só HTTPS neste subdomínio por um ano. Sem includeSubDomains: a
          // regra não alcança os outros endereços do domínio.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          // Aplicação de demonstração: nenhum buscador deve indexá-la.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
