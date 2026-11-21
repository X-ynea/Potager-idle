"use strict";
/* Succès. Chaque succès a un ou plusieurs paliers (tiers) : n = objectif, c = pièces, x = XP,
   title = titre débloqué, bonus = bonus permanent. value() lit la progression dans la partie. */
const ACH_CATS = [
  ["garden", "Jardinage"], ["lab", "Serre et hybrides"], ["kitchen", "Cuisine"], ["village", "Village"],
  ["eco", "Économie et progression"], ["daily", "Petits moments du quotidien"], ["hidden", "Succès cachés"],
];
const st = k => (S.stats && S.stats[k]) || 0;
const ACHIEVEMENTS = [
  { id: "first_harvest", cat: "garden", name: "Premier radis", desc: "Faire sa première récolte", value: () => st("harvest"), tiers: [{ n: 1, c: 20, x: 10 }] },
  { id: "green", cat: "garden", name: "Main verte", desc: n => `Récolter ${fmt(n)} plantes`, value: () => st("harvest"),
    tiers: [{ n: 10, c: 50, x: 20 }, { n: 100, c: 300, x: 80 }, { n: 1000, c: 2000, x: 300, title: "Main verte", bonus: "xp" }] },
  { id: "double", cat: "garden", name: "Récolte double", desc: "Obtenir une récolte double", value: () => st("doubles"), tiers: [{ n: 1, c: 50, x: 15 }] },
  { id: "full", cat: "garden", name: "Jardin plein", desc: "Avoir toutes ses parcelles plantées en même temps", value: () => st("fullGarden"), tiers: [{ n: 1, c: 40, x: 15 }] },
  { id: "wet", cat: "garden", name: "Toujours humide", desc: n => `Récolter ${n} plantes qui n’ont jamais eu soif`, value: () => st("neverDry"), tiers: [{ n: 20, c: 150, x: 40 }] },
  { id: "collector", cat: "garden", name: "Collectionneur", desc: "Récolter chacune des 12 plantes de base", value: () => ORDER.filter(k => !PLANTS[k].hybrid && S.discovered.includes(k)).length,
    tiers: [{ n: 12, c: 400, x: 100, title: "Collectionneur" }] },

  { id: "first_cross", cat: "lab", name: "Apprenti botaniste", desc: "Réussir son premier croisement", value: () => S.hybrids.length, tiers: [{ n: 1, c: 100, x: 30, title: "Botaniste" }] },
  { id: "herbier", cat: "lab", name: "Herbier complet", desc: "Découvrir tous les hybrides", value: () => S.hybrids.length,
    tiers: [{ n: 8, c: 1500, x: 300, title: "Grand botaniste", bonus: "coins" }] },
  { id: "experimenter", cat: "lab", name: "Expérimentateur", desc: n => `Faire ${n} croisements, même ratés`, value: () => st("crosses"), tiers: [{ n: 25, c: 300, x: 80 }] },

  { id: "first_dish", cat: "kitchen", name: "Premier plat", desc: "Cuisiner sa première recette", value: () => st("cooked"), tiers: [{ n: 1, c: 30, x: 10 }] },
  { id: "chef", cat: "kitchen", name: "Chef", desc: n => `Cuisiner ${fmt(n)} plats`, value: () => st("cooked"),
    tiers: [{ n: 10, c: 100, x: 30 }, { n: 50, c: 500, x: 120 }, { n: 200, c: 2500, x: 400, title: "Chef étoilé", bonus: "cook" }] },
  { id: "book", cat: "kitchen", name: "Livre de recettes", desc: "Connaître toutes les recettes", value: () => S.recipes.length, tiers: [{ n: RORDER.length, c: 1000, x: 200, title: "Gourmet" }] },
  { id: "feast", cat: "kitchen", name: "Grand festin", desc: "Cuisiner le Gâteau des moissons", value: () => st("gateau"), tiers: [{ n: 1, c: 3000, x: 500, title: "Maître des moissons" }] },

  { id: "neighbor", cat: "village", name: "Bon voisin", desc: n => `Livrer ${n} commandes`, value: () => st("orders"),
    tiers: [{ n: 10, c: 100, x: 30 }, { n: 50, c: 600, x: 150 }, { n: 150, c: 2000, x: 400, title: "Pilier du village" }] },
  { id: "friends", cat: "village", name: "Ami de tous", desc: "Livrer une commande à chacun des voisins", value: () => (S.stats.served || []).length,
    tiers: [{ n: VILLAGERS.length, c: 500, x: 120, title: "Ami du village" }] },
  { id: "bigdelivery", cat: "village", name: "Grosse livraison", desc: "Livrer une commande de 500 pièces ou plus", value: () => st("bigOrder"), tiers: [{ n: 1, c: 200, x: 50 }] },

  { id: "fortune", cat: "eco", name: "Petite fortune", desc: n => `Avoir ${fmt(n)} pièces en même temps`, value: () => st("maxCoins"),
    tiers: [{ n: 1000, c: 0, x: 50 }, { n: 10000, c: 0, x: 200 }, { n: 100000, c: 0, x: 800, title: "Magnat du potager" }] },
  { id: "equipped", cat: "eco", name: "Bien équipé", desc: "Acheter toutes les améliorations", value: () => Object.keys(UPG).filter(u => S.upg[u] >= UPG[u].steps.length).length,
    tiers: [{ n: Object.keys(UPG).length, c: 2000, x: 300 }] },
  { id: "domain", cat: "eco", name: "Domaine", desc: n => `Avoir les ${n} parcelles`, value: () => S.plots.length, tiers: [{ n: MAX_PLOTS, c: 1000, x: 200, title: "Propriétaire" }] },
  { id: "levels", cat: "eco", name: "Jardinier confirmé", desc: n => `Atteindre le niveau ${n}`, value: () => S.level,
    tiers: [{ n: 5, c: 100, x: 0 }, { n: 10, c: 500, x: 0 }, { n: 20, c: 2000, x: 0, title: "Jardinier émérite" }] },

  { id: "butterflies", cat: "daily", name: "Chasseur de papillons", desc: n => `Attraper ${n} papillons`, value: () => st("butterflies"),
    tiers: [{ n: 10, c: 40, x: 15 }, { n: 50, c: 200, x: 60 }, { n: 200, c: 800, x: 200, title: "Chasseur de papillons" }] },
  { id: "snails", cat: "daily", name: "Anti-escargots", desc: n => `Retirer ${n} escargots`, value: () => st("weeds"), tiers: [{ n: 50, c: 300, x: 80 }] },
  { id: "comeback", cat: "daily", name: "Bon retour", desc: "Revenir après plus de 8 heures d’absence", value: () => st("comeback"), tiers: [{ n: 1, c: 50, x: 15 }] },
  { id: "loyal", cat: "daily", name: "Fidèle au poste", desc: "Récupérer le cadeau du jour 7 jours d’affilée", value: () => st("bestStreak"), tiers: [{ n: 7, c: 500, x: 120, title: "Fidèle" }] },
  { id: "early", cat: "daily", name: "Lève-tôt", desc: "Récolter avant 8 h", value: () => st("early"), tiers: [{ n: 1, c: 50, x: 15 }] },
  { id: "night", cat: "daily", name: "Oiseau de nuit", desc: "Récolter après 22 h", value: () => st("night"), tiers: [{ n: 1, c: 50, x: 15 }] },

  { id: "whynot", cat: "hidden", hidden: true, name: "Pourquoi pas ?", desc: "Croiser une plante avec elle-même", value: () => st("selfCross"), tiers: [{ n: 1, c: 100, x: 30 }] },
  { id: "patience", cat: "hidden", hidden: true, name: "Patience", desc: "Laisser une plante mûre plus de 24 h avant de la récolter", value: () => st("patience"), tiers: [{ n: 1, c: 100, x: 30 }] },
  { id: "sellall", cat: "hidden", hidden: true, name: "Tout vendre", desc: "Vendre toute sa récolte d’un coup pour plus de 1 000 pièces", value: () => st("bigSale"), tiers: [{ n: 1, c: 200, x: 50 }] },
];
const BONUS_TEXT = { xp: "+5 % d’XP sur tout", coins: "+5 % de pièces sur tout", cook: "Cuisson 10 % plus rapide" };
const hasBonus = b => ACHIEVEMENTS.some(a => a.tiers.some((t, i) => t.bonus === b && (S.ach || {})[a.id] > i));
const xpMult = () => hasBonus("xp") ? 1.05 : 1;
const coinMult = () => hasBonus("coins") ? 1.05 : 1;
const cookMult = () => hasBonus("cook") ? .9 : 1;
const ROMAN = ["", "I", "II", "III"];
const achDesc = (a, n) => typeof a.desc === "function" ? a.desc(n) : a.desc;

/* Vérifie les succès ; distribue les récompenses des nouveaux paliers. */
function checkAch() {
  S.ach = S.ach || {};
  for (const a of ACHIEVEMENTS) {
    let lv = S.ach[a.id] || 0;
    const v = a.value();
    while (lv < a.tiers.length && v >= a.tiers[lv].n) {
      const t = a.tiers[lv]; lv++; S.ach[a.id] = lv;
      S.coins += t.c; if (t.x) addXp(t.x);
      ACH_QUEUE.push({ a, lv, t });
    }
  }
  if (ACH_QUEUE.length) showAchToasts();
}
const ACH_QUEUE = [];
function showAchToasts() {
  while (ACH_QUEUE.length) {
    const { a, lv, t } = ACH_QUEUE.shift();
    const name = a.name + (a.tiers.length > 1 ? " " + ROMAN[lv] : "");
    const rew = [t.c ? `+${fmt(t.c)} pièces` : "", t.x ? `+${t.x} XP` : "", t.title ? `titre « ${t.title} »` : "", t.bonus ? BONUS_TEXT[t.bonus] : ""].filter(Boolean).join(" · ");
    toast(`<span class="ach-toast">${TROPHY}<span><b>Succès : ${name}</b><br>${rew}</span></span>`, 5500);
    buzz([10, 40, 10]);
  }
}
const TROPHY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M10 13h4l-.5 4h-3z" fill="currentColor"/><rect x="7.5" y="17" width="9" height="3" rx="1" fill="currentColor"/></svg>`;

function viewAch() {
  S.ach = S.ach || {};
  const total = ACHIEVEMENTS.reduce((t, a) => t + a.tiers.length, 0);
  const done = ACHIEVEMENTS.reduce((t, a) => t + (S.ach[a.id] || 0), 0);
  const titles = ACHIEVEMENTS.flatMap(a => a.tiers.map((t, i) => ({ t, i, a }))).filter(o => o.t.title && (S.ach[o.a.id] || 0) > o.i).map(o => o.t.title);
  const bonuses = ACHIEVEMENTS.flatMap(a => a.tiers.map((t, i) => ({ t, i, a }))).filter(o => o.t.bonus && (S.ach[o.a.id] || 0) > o.i).map(o => BONUS_TEXT[o.t.bonus]);
  const card = a => {
    const lv = S.ach[a.id] || 0, max = a.tiers.length, doneAll = lv >= max;
    const hiddenNow = a.hidden && !lv;
    const t = a.tiers[Math.min(lv, max - 1)];
    const v = Math.min(a.value(), t.n);
    const name = hiddenNow ? "???" : a.name + (max > 1 ? " " + ROMAN[Math.min(lv + (doneAll ? 0 : 1), max)] : "");
    const desc = hiddenNow ? "Succès caché" : achDesc(a, t.n);
    const rew = [t.c ? `${coin}${fmt(t.c)}` : "", t.x ? `+${t.x} XP` : "", t.title ? `« ${t.title} »` : "", t.bonus ? BONUS_TEXT[t.bonus] : ""].filter(Boolean).join(" · ");
    return `<div class="ach ${doneAll ? "done" : lv ? "part" : ""} ${hiddenNow ? "secret" : ""}">
      <div class="ach-ico">${TROPHY}${max > 1 ? `<span class="ach-tier">${"★".repeat(lv)}${"☆".repeat(max - lv)}</span>` : ""}</div>
      <div class="ach-txt"><b>${name}</b><span>${desc}</span>
        ${hiddenNow ? "" : doneAll ? `<span class="ach-rew ok">Obtenu${rew ? " · " + rew : ""}</span>` : `<div class="pbar"><i style="width:${(v / t.n * 100).toFixed(1)}%"></i></div><span class="ach-rew"><span class="num">${fmt(v)} / ${fmt(t.n)}</span>${rew ? " · " + rew : ""}</span>`}
      </div></div>`;
  };
  return `<div class="sheet tall" role="dialog" aria-modal="true" aria-label="Succès">
    <div class="sheet-head"><h2>Succès</h2><button class="btn ghost sm" data-act="close">Fermer</button></div>
    <div class="ach-sum"><div class="ach-ico big">${TROPHY}</div><div><b class="num">${done} / ${total}</b><span>paliers obtenus</span><div class="pbar"><i style="width:${(done / total * 100).toFixed(1)}%"></i></div></div></div>
    <div class="set-group"><h3>Titre affiché</h3>
      ${titles.length ? `<div class="basket">${["", ...titles].map(ti => `<button class="chip title-chip" data-act="setTitle" data-arg="${ti}" aria-pressed="${(S.title || "") === ti}">${ti || "Aucun"}</button>`).join("")}</div>`
        : `<p class="small muted" style="margin:0">Certains succès débloquent un titre à afficher à côté de ton niveau.</p>`}
      ${bonuses.length ? `<p class="small" style="margin:0"><b>Bonus actifs :</b> ${bonuses.join(" · ")}</p>` : ""}
    </div>
    ${ACH_CATS.map(([c, l]) => `<div class="set-group"><h3>${l}</h3>${ACHIEVEMENTS.filter(a => a.cat === c).map(card).join("")}</div>`).join("")}
  </div>`;
}
