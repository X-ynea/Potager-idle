/* Service worker du Petit Potager : rend le jeu jouable hors-ligne.
   À chaque mise à jour du jeu, augmente VERSION pour que les téléphones téléchargent la nouvelle version. */
const VERSION = "potager-v3";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/data.js",
  "js/art.js",
  "js/game.js",
  "fonts/fredoka-latin.woff2",
  "fonts/nunito-latin.woff2",
  "icons/icon.svg",
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
  // Page : réseau d'abord (pour voir les mises à jour), cache si hors-ligne.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("index.html")));
    return;
  }
  // Fichiers du jeu : cache d'abord, réseau sinon.
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
