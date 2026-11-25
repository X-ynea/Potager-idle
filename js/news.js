"use strict";
/* ---------------- Fenêtre « Du nouveau au potager ! » de la v3 ----------------
   Une seule fois par appareil, pour les joueurs qui avaient déjà une partie (les nouveaux la découvrent
   avec Mamie Lapine). Ensuite, Mamie Lapine présente chaque nouveauté au bon moment (js/tuto.js).
   Version de test : Paramètres › « Revoir la fenêtre de la v3 ». */
const NEWS3_KEY = "potager-news-v3c" + (IS_TEST ? "-test" : ""); // « c » : réaffichée une fois (3.0.1 : elle se fermait toute seule après la synchronisation)
const NEWS3_ITEMS = [
  [() => FR_ICONS.people, "Un onglet Amis", "Partage ton code ami, ajoute tes proches et discutez ensemble."],
  ["🌱", "Visite leur jardin", "Découvre leurs bacs, leurs décos et leur herbier."],
  ["💧", "Un coup d’arrosoir", "Une fois par jour, arrose le jardin d’un ami : ses plantes poussent 20 % plus vite pendant 2 h."],
  ["⇄", "Des échanges", "Récoltes, plats ou pièces, pour une valeur à peu près égale. Tout arrive dans ta boîte aux lettres."],
  ["❤️", "« J’aime ton jardin »", "Un cœur par ami et par semaine, juste pour le plaisir."],
  ["🎯", "Les objectifs de la semaine", "Avec tes amis, et avec tous les jardiniers. La première réussite de chaque saison donne une déco rare."],
  ["✨", "4 hybrides et 4 recettes", "Un hybride par saison à découvrir dans la Serre, et un bon petit plat pour chacun."],
];
function news3HTML() {
  return `<div class="gate-card news-card news3" role="dialog" aria-modal="true" aria-label="Du nouveau au potager">
    <img class="gate-logo" src="assets/img/xp-leaf.webp" alt="">
    <h1>Du nouveau au potager ! 🌱</h1>
    <p class="news3-sub">Le potager s’ouvre à tes amis.</p>
    <div class="news3-list">${NEWS3_ITEMS.map(([i, t, d]) => `<div class="news3-item"><span class="news3-ico">${typeof i === "function" ? i() : i}</span><span><b>${t}</b><small>${d}</small></span></div>`).join("")}</div>
    <p class="small muted" style="margin:0">Mamie Lapine te montrera tout ça au fil du jeu.</p>
    <button class="btn big" data-act="news3Close">C’est parti !</button>
  </div>`;
}
function showNews3() {
  let g = document.getElementById("gate");
  if (!g) { g = document.createElement("div"); g.id = "gate"; document.body.appendChild(g); }
  g.style.backgroundImage = `url("assets/img/bg-${season()}.webp")`;
  g.innerHTML = news3HTML();
}
function checkNews3() {
  if (!FRIENDS_ON || !CLOUD.enabled() || !CLOUD.signedIn || CLOUD.blocked || document.getElementById("gate")) return;
  let seen = true; try { seen = !!localStorage.getItem(NEWS3_KEY); } catch (e) {}
  if (seen) return;
  try { localStorage.setItem(NEWS3_KEY, "1"); } catch (e) {}
  if ((S.stats?.harvest || 0) > 0 || S.level > 1) { closeModal(); showNews3(); resetTuto3(); } // les nouveaux joueurs ne la voient pas
}
addEventListener("load", () => setTimeout(checkNews3, 2200));
// Conseils de Mamie Lapine sur la v3 : ils (re)commencent avec la fenêtre, sans refaire les premiers pas.
const TUTO3_IDS = ["friends", "friends2", "visit", "trade", "watered", "weekly", "hybrids3", "mail"];
// Seuls les conseils de la v3 restent : les autres (premiers pas, Serre, cuisine…) sont marqués comme vus.
function onlyNewTips(T) { for (const t of TUTO) if (!TUTO3_IDS.includes(t.id)) T.seen[t.id] = true; }
function resetTuto3() {
  const T = tutoState();
  // Joueur qui avait coupé Mamie Lapine (ou sauté les premiers pas) : elle ne revient que pour la v3.
  if (T.off || TUTO.some(t => t.basic && !T.seen[t.id])) onlyNewTips(T);
  T.off = false; T.f.v3fix = true;
  for (const id of TUTO3_IDS) delete T.seen[id];
  for (const f of ["tab_friends", "visited", "trade_opened", "mail_opened"]) delete T.f[f];
  save();
}
// 3.0.2 : réparation des parties où la 3.0.1 avait relancé les premiers pas chez un ancien joueur.
addEventListener("load", () => setTimeout(() => {
  const T = tutoState(); if (T.f.v3fix || S.level < 2) return;
  if (TUTO.some(t => t.basic && !T.seen[t.id])) onlyNewTips(T);
  T.f.v3fix = true; save(); tutoUpdate();
}, 1500));
const NEWS3_ACTS = {
  news3Close() { document.getElementById("gate")?.remove(); SFX.play("success"); render(true); },
  news3Replay() { closeModal(); showNews3(); resetTuto3(); },
};
