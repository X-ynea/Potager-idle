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
    tiers: [{ n: 10, c: 50, x: 20 }, { n: 100, c: 300, x: 80, deco: "gnome" }, { n: 1000, c: 2000, x: 300, title: "Main verte", bonus: "xp" }] },
  { id: "double", cat: "garden", name: "Récolte double", desc: "Obtenir une récolte double", value: () => st("doubles"), tiers: [{ n: 1, c: 50, x: 15 }] },
  { id: "full", cat: "garden", name: "Jardin plein", desc: "Avoir toutes ses parcelles plantées en même temps", value: () => st("fullGarden"), tiers: [{ n: 1, c: 40, x: 15 }] },
  { id: "wet", cat: "garden", name: "Toujours humide", desc: n => `Récolter ${n} plantes qui n’ont jamais eu soif`, value: () => st("neverDry"), tiers: [{ n: 20, c: 150, x: 40, deco: "birdbath" }] },
  { id: "collector", cat: "garden", name: "Collectionneur", desc: "Récolter chacune des 12 plantes de base", value: () => ORDER.filter(k => !PLANTS[k].hybrid && !PLANTS[k].only && S.discovered.includes(k)).length,
    tiers: [{ n: 12, c: 400, x: 100, title: "Collectionneur", deco: "scarecrow" }] },
  { id: "seasons", cat: "garden", name: "Quatre saisons", desc: "Récolter les 8 plantes exclusives des saisons", value: () => ORDER.filter(k => PLANTS[k].only && S.discovered.includes(k)).length,
    tiers: [{ n: 2, c: 150, x: 40 }, { n: 8, c: 1500, x: 300, title: "Jardinier des saisons" }] },

  { id: "gold", cat: "garden", name: "Chercheur d’or", desc: n => n === 1 ? "Trouver une récolte dorée" : `Trouver ${n} récoltes dorées différentes`, value: () => (S.goldenFound || []).length,
    tiers: [{ n: 1, c: 100, x: 30 }, { n: 5, c: 600, x: 150 }, { n: 20, c: 4000, x: 600, title: "Chercheur d’or" }] },
  { id: "yearround", cat: "garden", name: "Le tour de l’année", desc: "Jouer pendant chacune des 4 saisons", value: () => (S.stats.seasonsSeen || []).length,
    tiers: [{ n: 4, c: 1000, x: 250, title: "Fidèle des saisons" }] },
  { id: "seasonfriends", cat: "village", name: "Amis de passage", desc: "Livrer une commande à chacun des 4 voisins de saison", value: () => (S.stats.served || []).filter(i => VILLAGERS[i]?.season).length,
    tiers: [{ n: 1, c: 150, x: 40 }, { n: 4, c: 1200, x: 300 }] },
  { id: "seasoncook", cat: "kitchen", name: "Cuisine de saison", desc: n => `Cuisiner ${n === 8 ? "les 8" : n} recette${n > 1 ? "s" : ""} de saison`, value: () => (S.stats.cookedSet || []).filter(r => RECIPES[r] && Object.keys(RECIPES[r].need).some(k => PLANTS[k]?.only)).length,
    tiers: [{ n: 1, c: 120, x: 30 }, { n: 4, c: 600, x: 150 }, { n: 8, c: 2500, x: 500, title: "Chef des saisons" }] },
  { id: "allvisitors", cat: "daily", name: "Carnet d’observation", desc: "Attraper chacun des 4 visiteurs : papillon, libellule, coccinelle et rouge-gorge", value: () => (S.stats.visitors || []).length,
    tiers: [{ n: 4, c: 800, x: 200, title: "Naturaliste" }] },
  { id: "goldrush", cat: "garden", name: "Ruée vers l’or", desc: n => `Récolter ${n} légumes dorés au total`, value: () => st("golden"),
    tiers: [{ n: 10, c: 800, x: 200 }, { n: 50, c: 5000, x: 800, title: "Orpailleur" }] },
  { id: "goldseasons", cat: "garden", name: "Trésor de saison", desc: "Trouver une récolte dorée d’une plante de chaque saison", value: () => new Set((S.goldenFound || []).map(k => PLANTS[k]?.season).filter(Boolean)).size,
    tiers: [{ n: 4, c: 2000, x: 400 }] },
  { id: "goldall", cat: "garden", name: "Tout l’or du jardin", desc: n => `Trouver toutes les plantes en version dorée (${n})`, value: () => (S.goldenFound || []).filter(k => PLANTS[k] && !PLANTS[k].tuto).length,
    tiers: [{ n: ORDER.length, c: 20000, x: 2000, title: "Roi Midas du potager" }] },
  { id: "first_cross", cat: "lab", name: "Apprenti botaniste", desc: "Réussir son premier croisement", value: () => S.hybrids.length, tiers: [{ n: 1, c: 100, x: 30, title: "Botaniste" }] },
  { id: "herbier", cat: "lab", name: "Herbier complet", desc: "Découvrir tous les hybrides", value: () => S.hybrids.length,
    tiers: [{ n: 8, c: 1500, x: 300, title: "Grand botaniste", bonus: "coins", deco: "hive" }] },
  { id: "experimenter", cat: "lab", name: "Expérimentateur", desc: n => `Faire ${n} croisements, même ratés`, value: () => st("crosses"), tiers: [{ n: 25, c: 300, x: 80 }] },

  { id: "first_dish", cat: "kitchen", name: "Premier plat", desc: "Cuisiner sa première recette", value: () => st("cooked"), tiers: [{ n: 1, c: 30, x: 10 }] },
  { id: "chef", cat: "kitchen", name: "Chef", desc: n => `Cuisiner ${fmt(n)} plats`, value: () => st("cooked"),
    tiers: [{ n: 10, c: 100, x: 30 }, { n: 50, c: 500, x: 120 }, { n: 200, c: 2500, x: 400, title: "Chef étoilé", bonus: "cook" }] },
  { id: "book", cat: "kitchen", name: "Livre de recettes", desc: "Connaître toutes les recettes", value: () => S.recipes.length, tiers: [{ n: RORDER.length, c: 1000, x: 200, title: "Gourmet" }] },
  { id: "feast", cat: "kitchen", name: "Grand festin", desc: "Cuisiner le Gâteau des moissons", value: () => st("gateau"), tiers: [{ n: 1, c: 3000, x: 500, title: "Maître des moissons", deco: "rabbit" }] },

  { id: "neighbor", cat: "village", name: "Bon voisin", desc: n => `Livrer ${n} commandes`, value: () => st("orders"),
    tiers: [{ n: 10, c: 100, x: 30 }, { n: 50, c: 600, x: 150, deco: "wheelbarrow" }, { n: 150, c: 2000, x: 400, title: "Pilier du village" }] },
  { id: "friends", cat: "village", name: "Ami de tous", desc: "Livrer une commande à chacun des voisins", value: () => (S.stats.served || []).length,
    tiers: [{ n: VILLAGERS.length, c: 500, x: 120, title: "Ami du village", deco: "signpost" }] },
  { id: "bigdelivery", cat: "village", name: "Grosse livraison", desc: "Livrer une commande de 500 pièces ou plus", value: () => st("bigOrder"), tiers: [{ n: 1, c: 200, x: 50 }] },

  { id: "fortune", cat: "eco", name: "Petite fortune", desc: n => `Avoir ${fmt(n)} pièces en même temps`, value: () => st("maxCoins"),
    tiers: [{ n: 1000, c: 0, x: 50 }, { n: 10000, c: 0, x: 200 }, { n: 100000, c: 0, x: 800, title: "Magnat du potager", deco: "well" }] },
  { id: "equipped", cat: "eco", name: "Bien équipé", desc: "Acheter toutes les améliorations", value: () => Object.keys(UPG).filter(u => S.upg[u] >= UPG[u].steps.length).length,
    tiers: [{ n: Object.keys(UPG).length, c: 2000, x: 300 }] },
  { id: "domain", cat: "eco", name: "Domaine", desc: n => `Avoir les ${n} parcelles`, value: () => S.plots.length, tiers: [{ n: MAX_PLOTS, c: 1000, x: 200, title: "Propriétaire", deco: "fence" }] },
  { id: "levels", cat: "eco", name: "Jardinier confirmé", desc: n => `Atteindre le niveau ${n}`, value: () => S.level,
    tiers: [{ n: 5, c: 100, x: 0 }, { n: 10, c: 500, x: 0 }, { n: 20, c: 2000, x: 0, title: "Jardinier émérite" }, { n: 30, c: 6000, x: 0, title: "Maître jardinier" }] },

  { id: "butterflies", cat: "daily", name: "Petits visiteurs", desc: n => `Attraper ${n} visiteurs ailés (papillons, libellules, coccinelles, rouges-gorges)`, value: () => st("butterflies"),
    tiers: [{ n: 10, c: 40, x: 15 }, { n: 50, c: 200, x: 60, deco: "birdhouse" }, { n: 200, c: 800, x: 200, title: "Ami des petites bêtes" }] },
  { id: "snails", cat: "daily", name: "Jardinier vigilant", desc: n => `Libérer ${n} bacs bloqués (escargots, herbes folles, feuilles, gel)`, value: () => st("weeds"), tiers: [{ n: 50, c: 300, x: 80 }] },
  { id: "comeback", cat: "daily", name: "Bon retour", desc: "Revenir après plus de 8 heures d’absence", value: () => st("comeback"), tiers: [{ n: 1, c: 50, x: 15 }] },
  { id: "loyal", cat: "daily", name: "Fidèle au poste", desc: n => `Récupérer le cadeau du jour ${n} jours d’affilée`, value: () => Math.max(st("bestRun"), st("bestStreak")), tiers: [{ n: 7, c: 500, x: 120, title: "Fidèle", deco: "bench" }, { n: 15, c: 1500, x: 250 }, { n: 30, c: 4000, x: 500, title: "Pilier du potager" }] },
  { id: "early", cat: "daily", name: "Lève-tôt", desc: "Récolter avant 8 h", value: () => st("early"), tiers: [{ n: 1, c: 50, x: 15 }] },
  { id: "night", cat: "daily", name: "Oiseau de nuit", desc: "Récolter après 22 h", value: () => st("night"), tiers: [{ n: 1, c: 50, x: 15, deco: "lantern" }] },

  { id: "whynot", cat: "hidden", hidden: true, name: "Pourquoi pas ?", desc: "Croiser une plante avec elle-même", value: () => st("selfCross"), tiers: [{ n: 1, c: 100, x: 30 }] },
  { id: "patience", cat: "hidden", hidden: true, name: "Patience", desc: "Laisser une plante mûre plus de 24 h avant de la récolter", value: () => st("patience"), tiers: [{ n: 1, c: 100, x: 30 }] },
  { id: "sellall", cat: "hidden", hidden: true, name: "Tout vendre", desc: "Vendre toute sa récolte d’un coup pour plus de 1 000 pièces", value: () => st("bigSale"), tiers: [{ n: 1, c: 200, x: 50 }] },
  { id: "petsnail", cat: "hidden", hidden: true, name: "Escargot de compagnie", desc: "Laisser un escargot sur un bac plus d’une heure", value: () => st("petSnail"), tiers: [{ n: 1, c: 100, x: 30 }] },
  { id: "monoculture", cat: "hidden", hidden: true, name: "Monoculture", desc: "Avoir tous ses bacs plantés de la même plante", value: () => st("monoculture"), tiers: [{ n: 1, c: 150, x: 40 }] },
  { id: "offseason", cat: "hidden", hidden: true, name: "Hors saison", desc: "Récolter une plante de saison en dehors de sa saison", value: () => st("offSeason"), tiers: [{ n: 1, c: 200, x: 50 }] },
  { id: "overwater", cat: "hidden", hidden: true, name: "Noyade", desc: "Arroser le même bac 10 fois d’affilée", value: () => st("overWater"), tiers: [{ n: 1, c: 100, x: 30 }] },
  { id: "refuser", cat: "hidden", hidden: true, name: "Difficile en affaires", desc: "Refuser 10 commandes de voisins", value: () => st("refused"), tiers: [{ n: 10, c: 150, x: 40 }] },
];
// XP des succès réduite d’un quart (2.12), arrondie à 5.
ACHIEVEMENTS.forEach(ac => ac.tiers.forEach(t => { if (t.x) t.x = Math.max(5, Math.round(t.x * .75 / 5) * 5); }));
const DECOS = {
  gnome: "Nain de jardin", scarecrow: "Épouvantail", fence: "Petite clôture", birdbath: "Bain d’oiseaux", birdhouse: "Nichoir",
  hive: "Ruche", wheelbarrow: "Brouette de légumes", bench: "Banc fleuri", signpost: "Panneau du village", lantern: "Lanterne",
  rabbit: "Lapin doré", well: "Puits",
};
const DECO_ORDER = Object.keys(DECOS);
// v3 : l'arrosoir et la boîte aux lettres deviennent le bain d'oiseaux et le panneau du village
// (pour ne pas les confondre avec l'arrosage d'un ami et la boîte aux lettres du jardin).
const DECO_RENAME = { can: "birdbath", mailbox: "signpost" };
/* Taille relative de chaque décoration dans le jardin, proche des proportions réelles. */
const DECO_SCALE = { gnome: .62, scarecrow: 1.3, fence: .9, birdbath: .8, birdhouse: .85, hive: .85, wheelbarrow: .9, bench: 1, signpost: 1.05, lantern: 1.2, rabbit: .7, well: 1.25 };
const decoSource = d => { for (const ach of ACHIEVEMENTS) for (let i = 0; i < ach.tiers.length; i++) if (ach.tiers[i].deco === d) return { ach, i }; return null; };
const decoUnlocked = d => { const s = decoSource(d); return !!s && ((S.ach || {})[s.ach.id] || 0) > s.i; };
const BONUS_TEXT = { xp: "+5 % d’XP sur tout", coins: "+5 % de pièces sur tout", cook: "Cuisson 10 % plus rapide" };
const hasBonus = b => ACHIEVEMENTS.some(a => a.tiers.some((t, i) => t.bonus === b && (S.ach || {})[a.id] > i));
const xpMult = () => hasBonus("xp") ? 1.05 : 1;
const coinMult = () => hasBonus("coins") ? 1.05 : 1;
const cookMult = () => hasBonus("cook") ? .9 : 1;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
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
    const rew = [t.c ? `+${fmt(t.c)} pièces` : "", t.x ? `+${t.x} XP` : "", t.title ? `titre « ${t.title} »` : "", t.bonus ? BONUS_TEXT[t.bonus] : "", t.deco ? `déco « ${DECOS[t.deco]} »` : ""].filter(Boolean).join(" · ");
    toast(`<button class="ach-toast" data-act="achGo" data-arg="${a.id}" aria-label="Voir le succès ${name}">${TROPHY}<span><b>Succès : ${name}</b><br>${rew}</span></button>`, 5500);
    buzz([10, 40, 10]); SFX.play("success");
  }
}
const TROPHY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M10 13h4l-.5 4h-3z" fill="currentColor"/><rect x="7.5" y="17" width="9" height="3" rx="1" fill="currentColor"/></svg>`;

function viewAch() {
  S.ach = S.ach || {};
  const total = ACHIEVEMENTS.reduce((t, a) => t + a.tiers.length, 0);
  const done = ACHIEVEMENTS.reduce((t, a) => t + (S.ach[a.id] || 0), 0);
  const titles = ACHIEVEMENTS.flatMap(a => a.tiers.map((t, i) => ({ t, i, a }))).filter(o => o.t.title && (S.ach[o.a.id] || 0) > o.i).map(o => o.t.title);
  const bonuses = ACHIEVEMENTS.flatMap(a => a.tiers.map((t, i) => ({ t, i, a }))).filter(o => o.t.bonus && (S.ach[o.a.id] || 0) > o.i).map(o => BONUS_TEXT[o.t.bonus]);
  const tabAch = UI.achTab || "todo";
  // Obtenus : dernier palier atteint ; En cours : prochain palier à atteindre.
  const cardDone = a => {
    const lv = S.ach[a.id] || 0, max = a.tiers.length, t = a.tiers[lv - 1];
    const rew = [t.c ? `${coin}${fmt(t.c)}` : "", t.x ? `+${t.x} XP` : "", t.title ? `« ${t.title} »` : "", t.bonus ? BONUS_TEXT[t.bonus] : "", t.deco ? `déco « ${DECOS[t.deco]} »` : ""].filter(Boolean).join(" · ");
    return `<div class="ach done${UI.achFlash === a.id ? " flash" : ""}" data-ach="${a.id}">
      <div class="ach-ico">${TROPHY}${max > 1 ? `<span class="ach-tier">${"★".repeat(lv)}${"☆".repeat(max - lv)}</span>` : ""}</div>
      <div class="ach-txt"><b>${a.name}${max > 1 ? " " + ROMAN[lv] : ""}</b><span>${achDesc(a, t.n)}</span><span class="ach-rew ok">Obtenu${rew ? " · " + rew : ""}</span></div></div>`;
  };
  const card = a => {
    const lv = S.ach[a.id] || 0, max = a.tiers.length, doneAll = lv >= max;
    const hiddenNow = a.hidden && !lv;
    const t = a.tiers[Math.min(lv, max - 1)];
    const v = Math.min(a.value(), t.n);
    const name = hiddenNow ? "???" : a.name + (max > 1 ? " " + ROMAN[Math.min(lv + (doneAll ? 0 : 1), max)] : "");
    const desc = hiddenNow ? "Succès caché" : achDesc(a, t.n);
    const rew = [t.c ? `${coin}${fmt(t.c)}` : "", t.x ? `+${t.x} XP` : "", t.title ? `« ${t.title} »` : "", t.bonus ? BONUS_TEXT[t.bonus] : "", t.deco ? `déco « ${DECOS[t.deco]} »` : ""].filter(Boolean).join(" · ");
    return `<div class="ach ${doneAll ? "done" : lv ? "part" : ""} ${hiddenNow ? "secret" : ""}">
      <div class="ach-ico">${TROPHY}${max > 1 ? `<span class="ach-tier">${"★".repeat(lv)}${"☆".repeat(max - lv)}</span>` : ""}</div>
      <div class="ach-txt"><b>${name}</b><span>${desc}</span>
        ${hiddenNow ? "" : doneAll ? `<span class="ach-rew ok">Obtenu${rew ? " · " + rew : ""}</span>` : `<div class="pbar"><i style="width:${(v / t.n * 100).toFixed(1)}%"></i></div><span class="ach-rew"><span class="num">${fmt(v)} / ${fmt(t.n)}</span>${rew ? " · " + rew : ""}</span>`}
      </div></div>`;
  };
  return `<div class="sheet tall" role="dialog" aria-modal="true" aria-label="Succès">
    <div class="sheet-head"><h2>Succès</h2>${SHEET_X}</div>
    <div class="ach-sum"><div class="ach-ico big">${TROPHY}</div><div><b class="num">${done} / ${total}</b><span>paliers obtenus</span><div class="pbar"><i style="width:${(done / total * 100).toFixed(1)}%"></i></div></div></div>
    <div class="set-group"><h3>Titre affiché</h3>
      ${titles.length ? `<div class="basket">${["", ...titles].map(ti => `<button class="chip title-chip" data-act="setTitle" data-arg="${ti}" aria-pressed="${(S.title || "") === ti}">${ti || "Aucun"}</button>`).join("")}</div>`
        : `<p class="small muted" style="margin:0">Certains succès débloquent un titre à afficher à côté de ton niveau.</p>`}
      ${bonuses.length ? `<p class="small" style="margin:0"><b>Bonus actifs :</b> ${bonuses.join(" · ")}</p>` : ""}
    </div>
    ${(() => {
      const todo = ACHIEVEMENTS.filter(a => (S.ach[a.id] || 0) < a.tiers.length), got = ACHIEVEMENTS.filter(a => (S.ach[a.id] || 0) > 0);
      const list = tabAch === "done" ? got : todo, render1 = tabAch === "done" ? cardDone : card;
      return `<div class="subtabs" style="grid-template-columns:1fr 1fr">${[["todo", "En cours", todo.length], ["done", "Obtenus", got.length]].map(([k, l, n]) => `<button data-act="achTab" data-arg="${k}" aria-pressed="${tabAch === k}">${l} <span class="num">${n}</span></button>`).join("")}</div>`
        + (list.length ? ACH_CATS.map(([c, l]) => { const items = list.filter(a => a.cat === c); return items.length ? `<div class="set-group"><h3>${l}</h3>${items.map(render1).join("")}</div>` : ""; }).join("")
          : `<div class="empty-note"><span>${tabAch === "done" ? "Aucun succès obtenu pour l’instant. Ta première récolte t’en rapportera un !" : "Bravo, tu as tout obtenu !"}</span></div>`);
    })()}
  </div>`;
}
