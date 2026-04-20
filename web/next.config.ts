import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next 16: se existir `webpack` custom, o build pede também entrada `turbopack`
   * (pode ficar vazio).
   */
  turbopack: {},
  /** Imagem Docker mais leve (`web/Dockerfile`). */
  output: "standalone",
  /** `web-push` usa `http`/`https` do Node; externo evita erro "Can't resolve 'http'" no Webpack em dev. */
  serverExternalPackages: [
    "better-sqlite3",
    "web-push",
    "https-proxy-agent",
    "agent-base",
  ],
  /** Garante o binário nativo do SQLite no trace `standalone`. */
  outputFileTracingIncludes: {
    "/*": ["./node_modules/better-sqlite3/**/*"],
  },
  /**
   * HMR / `/_next/*` em dev: IP na LAN e túneis ngrok (origem ≠ localhost).
   * Wildcards: ver `isCsrfOriginAllowed` no Next — `*.ngrok-free.app` cobre URLs como `xxxx.ngrok-free.app`.
   */
  /**
   * `next dev --webpack` empacota rotas API de forma que o `.node` do SQLite
   * falha (503 / ERR_DLOPEN_FAILED). Forçar external só em dev no servidor.
   */
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer && Array.isArray(config.externals)) {
      (config.externals as unknown[]).push({
        "better-sqlite3": "commonjs better-sqlite3",
      });
    }
    return config;
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.1.73",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.73:3000",
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
