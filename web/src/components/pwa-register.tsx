"use client";

import { useEffect } from "react";

function isSecureContextForSw(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  return (
    protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

/**
 * Regista `/public/sw.js` depois do `load` para o Chrome conseguir marcar o site como instalável (WebAPK).
 * Em `http://IP:3000` na LAN o SW não regista — use HTTPS (ex.: ngrok).
 *
 * Nota: em `next dev` o Chrome muitas vezes **não** oferece “Instalar app”; teste com `npm run build && npm run start`.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !isSecureContextForSw()) return;

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .catch((err) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[PWA] Falha ao registar service worker:", err);
          }
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);
  return null;
}
