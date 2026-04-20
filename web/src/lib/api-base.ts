/**
 * Base pública da API (sem barra final), ex.: `https://api.exemplo.com`.
 * Em build, `NEXT_PUBLIC_*` fica embutido no cliente.
 * Vazio = mesma origem (dev local ou PWA servido pelo mesmo Next da API).
 */
export function getPublicApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof env === "string" && env.trim()) {
    return env.replace(/\/+$/, "");
  }
  return "";
}

export function apiUrl(path: string): string {
  const base = getPublicApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}${p}`;
  // Evita mixed content se NEXT_PUBLIC_API_BASE_URL estiver como http:// em produção HTTPS.
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.startsWith("http://")
  ) {
    url = `https://${url.slice("http://".length)}`;
  }
  return url;
}
