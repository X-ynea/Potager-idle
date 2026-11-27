/* Service worker de Potager idle : rend le jeu jouable hors-ligne.
   À chaque mise à jour du jeu, augmente VERSION pour que les téléphones téléchargent la nouvelle version. */
const VERSION = "potager-v476";
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
  "js/friends.js",
  "js/visit.js",
  "js/water.js",
  "js/trade.js",
  "js/like.js",
  "js/goals.js",
  "js/news.js",
  "js/balades.js",
  "js/jardin.js",
  "js/cloud-config.js",
  "js/cloud.js",
  "confidentialite.html",
  "js/seasons.js",
  "js/sound.js",
  "js/env.js",
  "js/typo.js",
  "js/game.js",
  "assets/img/manifest.js",
  "assets/img/interface/xp-leaf.webp",
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
    caches.keys().then(async keys => {
      // Avant d'effacer l'ancienne version, on garde ce qu'elle avait déjà (images vues, etc.) :
      // le jeu reste complet hors-ligne juste après une mise à jour.
      const now = await caches.open(VERSION);
      for (const k of keys.filter(k => k !== VERSION)) {
        const old = await caches.open(k);
        for (const req of await old.keys()) if (!(await now.match(req, { ignoreSearch: true }))) await now.put(req, await old.match(req));
        await caches.delete(k);
      }
    })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Réseau d'abord : on a toujours la dernière version quand on est en ligne.
  // Sans réseau, ou si le réseau ne répond pas au bout de 3 s (réseau très faible, mode avion
  // qui fait attendre), on prend la copie en cache : le jeu ne reste jamais bloqué au démarrage.
  const fallback = () => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : null));
  event.respondWith(new Promise(resolve => {
    let done = false; const finish = r => { if (!done && r) { done = true; resolve(r); } };
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      finish(res);
    }).catch(() => fallback().then(hit => finish(hit || Response.error())));
    setTimeout(() => fallback().then(finish), 3000);
  }));
});

// Toutes les images du jeu, gardées pour jouer hors-ligne (une seule fois chacune).
// La liste (assets/img/files.txt) est créée à la publication du site.
self.addEventListener("message", event => { if (event.data === "precache") event.waitUntil(precacheImages()); });
async function precacheImages() {
  const r = await fetch("assets/img/files.txt", { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok) return;
  const names = (await r.text()).split(/\s+/).filter(n => /\.(webp|png)$/.test(n));
  const c = await caches.open(VERSION);
  for (const n of names) {
    const url = "assets/img/" + n;
    if (await c.match(url, { ignoreSearch: true })) continue;
    try { const res = await fetch(url); if (res.ok) await c.put(url, res); } catch (e) { return; } // plus de réseau : on reprendra plus tard
  }
}

// Toucher une notification ouvre (ou ramène au premier plan) le jeu.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
