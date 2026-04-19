import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Imagem Docker mais leve (`web/Dockerfile`). */
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  /** Garante o binário nativo do SQLite no trace `standalone`. */
  outputFileTracingIncludes: {
    "/*": ["./node_modules/better-sqlite3/**/*"],
  },
  /**
   * HMR / `/_next/*` em dev: IP na LAN e túneis ngrok (origem ≠ localhost).
   * Wildcards: ver `isCsrfOriginAllowed` no Next — `*.ngrok-free.app` cobre URLs como `xxxx.ngrok-free.app`.
   */
  allowedDevOrigins: [
    "192.168.1.73",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
