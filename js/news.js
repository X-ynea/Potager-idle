"use strict";
/* ---------------- Fenêtre « Du nouveau au potager ! » de la v3 ----------------
   Une seule fois par appareil, pour les joueurs qui avaient déjà une partie (les nouveaux la découvrent
   avec Mamie Lapine). Ensuite, Mamie Lapine présente chaque nouveauté au bon moment (js/tuto.js).
   Version de test : Paramètres › « Revoir la fenêtre de la v3 ». */
const NEWS3_KEY = "potager-news-v3" + (IS_TEST ? "-test" : "");
const NEWS3_ITEMS = [
  [() => FR_ICONS.people, "Un onglet Amis", "Partage ton code ami, ajoute tes proches et discutez ensemble."],
  ["🌱", "Visite leur jardin", "Découvre leurs bacs, leurs décos et leur herbier."],
  ["💧", "Un coup d’arrosoir", "Une fois par jour, arrose le jardin d’un ami : ses plantes poussent 20 % plus vite pendant 2 h."],
  ["⇄", "Des échanges", "Récoltes, plats ou pièces, pour une valeur à peu près égale. Tout arrive dans ta boîte aux lettres."],
  ["❤️", "« J’aime ton jardin »", "Un cœur par ami et par semaine, juste pour le plaisir."],
  ["🎯", "Les objectifs de la semaine", "Avec tes amis, et avec tous les jardiniers. La première réussite de chaque saison donne une déco rare."],
  ["✨", "4 nouveaux hybrides", "Un par saison, à découvrir dans la Serre."],
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
  if ((S.stats?.harvest || 0) > 0 || S.level > 1) { closeModal(); showNews3(); } // les nouveaux joueurs ne la voient pas
}
addEventListener("load", () => setTimeout(checkNews3, 2200));
const NEWS3_ACTS = {
  news3Close() { document.getElementById("gate")?.remove(); SFX.play("success"); render(true); },
  news3Replay() { closeModal(); showNews3(); },
};
