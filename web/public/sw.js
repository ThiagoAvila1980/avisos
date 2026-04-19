/* Service worker: PWA + ngrok + Web Push (eventos push / clique). */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  try {
    const url = new URL(req.url);
    if (url.origin === self.location.origin) {
      const headers = new Headers(req.headers);
      headers.set("ngrok-skip-browser-warning", "true");
      event.respondWith(fetch(new Request(req, { headers })));
      return;
    }
  } catch {
    /* ignorar */
  }
  event.respondWith(fetch(req));
});

self.addEventListener("push", (event) => {
  let title = "Avisos";
  let body = "Nova notificação.";
  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed.title) title = String(parsed.title);
      if (parsed.body) body = String(parsed.body);
    } catch {
      const t = event.data.text();
      if (t) body = t;
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      vibrate: [120, 80, 120],
      data: { url: "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
