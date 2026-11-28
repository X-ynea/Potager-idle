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
    <img class="gate-logo" src="assets/img/interface/xp-leaf.webp" alt="">
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
  g.style.backgroundImage = `url("assets/img/jardin/bg-${season()}.webp")`;
  g.innerHTML = news3HTML();
}
function checkNews3() {
  if (!FRIENDS_ON || !CLOUD.enabled() || !CLOUD.signedIn || CLOUD.blocked || document.getElementById("gate")) return;
  const seen = true; // v4 sortie : la fenêtre de la v3 ne s'affiche plus (celle de la v4 la remplace)
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
// Parties d'avant la 3.0.3 : Mamie coupée (ancien « off ») = conseils terminés, sauf ceux de la v3 tant
// qu'elle ne les a pas présentés. Et réparation des parties où la 3.0.1 avait relancé les premiers pas.
addEventListener("load", () => setTimeout(() => {
  const T = tutoState(); let changed = false;
  if (T.off) { if (T.f.v3fix) for (const x of TUTO) T.seen[x.id] = true; else onlyNewTips(T); T.off = false; T.f.v3fix = true; changed = true; }
  if (!T.f.v3fix && S.level >= 2) { if (TUTO.some(x => x.basic && !T.seen[x.id])) onlyNewTips(T); T.f.v3fix = true; changed = true; }
  if (changed) { save(); tutoUpdate(); }
}, 1500));
const NEWS3_ACTS = {
  news3Close() { if (document.querySelector("#gate .news4")) news4Seen(); document.getElementById("gate")?.remove(); SFX.play("success"); render(true); },
  news3Replay() { closeModal(); showNews3(); resetTuto3(); },
};

/* ---------------- Fenêtre « Du nouveau au potager ! » de la v4 ----------------
   Une seule fois par appareil, pour les joueurs qui avaient déjà une partie. Elle remplace celle de la v3
   (qui n'est plus montrée ensuite). Les scénarios de Mamie Lapine (Balades, jardin commun) arrivent ensuite
   tout seuls, au niveau voulu. Version de test : Paramètres › « Revoir la fenêtre de la v4 ». */
const NEWS4_KEY = "potager-news-v4" + (IS_TEST ? "-test" : "");
const n4img = src => `<img src="assets/img/${src}.webp" alt="">`;
const NEWS4_ITEMS = () => [
  [SIGNPOST, "Un onglet Balades", "Cinq petits jeux de 30 secondes : la ruche, la pêche, la forêt, le memory et la cueillette. Trois parties par jour pour chacun."],
  [n4img("balades/wild-miel"), "Des trouvailles de balade", "Miel, algues, mûres, châtaignes… On ne peut pas les cultiver, mais on peut les cuisiner, les vendre et les échanger."],
  [n4img("plats/dish-pique_nique"), "12 nouvelles recettes", "Du thé à la menthe au grand pique-nique, et une recette pour chaque nouvel hybride."],
  [n4img("voisins/villager-12"), "Deux nouveaux voisins", "Margot la Cane et Firmin le Renard raffolent de tes trouvailles."],
  [n4img("plantes/cerise-crop"), "Trois nouveaux hybrides", "De nouvelles variétés se cachent dans la Serre. À toi de les trouver !"],
  ...(FRIENDS_ON ? [[n4img("interface/ui-portal"), "Le jardin commun", "Dès le niveau 5, un petit jardin à cultiver avec 3 amis au plus, pour livrer ensemble des commandes toute la journée."],
    [BOARD_ICON, "Un tableau entre amis", "Ton meilleur score de la semaine à chaque jeu, à côté de celui de tes amis."]] : []),
  [n4img("decos/deco-boat"), "4 décos et 4 succès", "Une barque, un panier de cueillette, un hôtel à insectes et le banc de l’amitié à gagner."],
  [n4img("atelier/stove-on"), "L’Atelier", "La Cuisine et la Serre sont maintenant réunies dans un seul onglet."],
];
function news4HTML() {
  return `<div class="gate-card news-card news3 news4" role="dialog" aria-modal="true" aria-label="Du nouveau au potager">
    <img class="gate-logo" src="assets/img/interface/xp-leaf.webp" alt="">
    <h1>Du nouveau au potager ! 🌱</h1>
    <p class="news3-sub">Partons en balade !</p>
    <div class="news3-list">${NEWS4_ITEMS().map(([i, t, d]) => `<div class="news3-item"><span class="news3-ico">${i}</span><span><b>${t}</b><small>${d}</small></span></div>`).join("")}</div>
    <p class="small muted" style="margin:0">Mamie Lapine te montrera tout ça au fil du jeu.</p>
    <button class="btn big" data-act="news3Close">C’est parti !</button>
  </div>`;
}
function showNews4() {
  let g = document.getElementById("gate");
  if (!g) { g = document.createElement("div"); g.id = "gate"; document.body.appendChild(g); }
  g.style.backgroundImage = `url("assets/img/jardin/bg-${season()}.webp")`;
  g.innerHTML = news4HTML();
}
function checkNews4() {
  // On attend la fin de la connexion (sinon l'écran de connexion la remplace, puis disparaît avec elle).
  if (document.getElementById("gate") || (CLOUD.enabled() && (!CLOUD.signedIn || CLOUD.blocked))) { setTimeout(checkNews4, 2000); return; }
  if (!checkNews4.calm) { checkNews4.calm = true; setTimeout(checkNews4, 2500); return; } // connexion toute fraîche : la partie en ligne arrive
  let seen = true; try { seen = !!localStorage.getItem(NEWS4_KEY); } catch (e) {}
  if (seen) return;
  if ((S.stats?.harvest || 0) > 0 || S.level > 1) { closeModal(); showNews4(); } // les nouveaux joueurs ne la voient pas
  else news4Seen();
}
// Vue seulement quand on la ferme avec « C'est parti ! » (si elle disparaît avant, elle reviendra).
function news4Seen() { try { localStorage.setItem(NEWS4_KEY, "1"); localStorage.setItem(NEWS3_KEY, "1"); } catch (e) {} }
addEventListener("load", () => setTimeout(checkNews4, 1900)); // avant celle de la v3 (2,2 s), qui attend la même chose
NEWS3_ACTS.news4Replay = () => { closeModal(); showNews4(); };
