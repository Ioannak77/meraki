// Meraki offline support.
// Pages: network first, so you always get the latest when online; the saved copy when offline.
// Built files (_next/static, icons, fonts): saved the first time, then served from the cache (their names change on each build).

const CACHE = "meraki-v2";
const BASE = "/meraki";
const PAGES = ["", "tasks/", "cleaning/", "finances/", "groceries/", "tracker/", "self-care/", "settings/", "calendar/", "insights/"].map(
  (p) => `${BASE}/${p}`,
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(PAGES.map((p) => cache.add(p).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  const isStatic = url.pathname.startsWith(`${BASE}/_next/static/`) || /\.(png|svg|ico|woff2?)$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pages and page data (RSC payloads for client-side navigation).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === "navigate" ? caches.match(`${BASE}/`) : Response.error())),
      ),
  );
});

// Phone notifications, sent by the meraki worker (see src/lib/push.ts).
self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(msg.title || "Meraki", {
      body: msg.body || "",
      tag: msg.tag || "meraki",
      icon: `${BASE}/icon-192.png`,
      badge: `${BASE}/icon-192.png`,
      data: { url: msg.url || `${BASE}/` },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || `${BASE}/`, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin + BASE));
      if (open) return open.navigate(url).then((c) => (c || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
