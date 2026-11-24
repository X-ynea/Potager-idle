/* Service worker de Potager idle : rend le jeu jouable hors-ligne.
   À chaque mise à jour du jeu, augmente VERSION pour que les téléphones téléchargent la nouvelle version. */
const VERSION = "potager-v276";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/data.js",
  "js/art.js",
  "js/achievements.js",
  "js/tuto.js",
  "js/profile.js",
  "js/cloud-config.js",
  "js/cloud.js",
  "confidentialite.html",
  "js/seasons.js",
  "js/sound.js",
  "js/typo.js",
  "js/game.js",
  "fonts/fredoka-latin.woff2",
  "fonts/nunito-latin.woff2",
  "icons/favicon-32.png",
  "icons/favicon-64.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Réseau d'abord : on a toujours la dernière version quand on est en ligne.
  // Hors-ligne seulement, on se rabat sur la copie en cache.
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("index.html")))
  );
});

// Toucher une notification ouvre (ou ramène au premier plan) le jeu.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
