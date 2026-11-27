"use strict";
/* Numéro de version affiché dans les Paramètres.
   À chaque mise à jour : changer APP_VERSION, le ?v= dans index.html et VERSION dans sw.js. */
const APP_VERSION = "3.1.60" + (IS_TEST ? "-test" : "");
/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s);
const now = () => Date.now();
const fmt = n => Math.floor(n).toLocaleString("fr-FR");
// Version courte pour la barre du haut : 9 999, puis 38,9k, 123k, 4,5 M… (arrondi vers le bas : jamais plus que ce qu'on a).
const fmtShort = n => { n = Math.floor(n); const cut = (v, d) => (Math.floor(v * 10 ** d) / 10 ** d).toLocaleString("fr-FR");
  return n < 1e4 ? fmt(n) : n < 1e5 ? cut(n / 1e3, 1) + "k" : n < 1e6 ? cut(n / 1e3, 0) + "k" : n < 1e7 ? cut(n / 1e6, 2) + "M" : n < 1e9 ? cut(n / 1e6, n < 1e8 ? 1 : 0) + "M" : cut(n / 1e9, 1) + "Md"; };
// XP de la barre du haut : 1049 / 1530 devient 1k / 1,5k (le détail est dans le profil).
const fmtXp = n => { n = Math.floor(n); return n < 1e3 ? String(n) : n < 1e6 ? (Math.floor(n / 100) / 10).toLocaleString("fr-FR") + "k" : fmtShort(n); };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const coin = '<span class="coin" aria-hidden="true"></span>';
// Temps de pousse affiché : arrondi à la minute (les comptes à rebours gardent les secondes).
const growDur = ms => ms < 60000 ? dur(ms) : dur(Math.round(ms / 60000) * 60000);
function dur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m} min ${String(r).padStart(2, "0")}` : `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
// Courbe d’XP (2.4) : début rapide, puis environ 3 à 4 semaines pour atteindre le niveau 15.
const xpNeed = l => Math.round(7.5 * l * l + 37.5 * l); // 2.16 : +25 % par rapport à la 2.12
const xpNeed4 = l => Math.round(6 * l * l + 30 * l); // courbe 2.12 à 2.15, pour convertir les parties
const xpNeedOld = l => Math.round(15 * Math.pow(l, 1.6)); // ancienne courbe, pour convertir les parties
const waterMs = () => UPG.water.values[S.upg.water] * 60000;
const speed = () => UPG.fert.values[S.upg.fert];
// Arrosage d'un ami : +20 % de pousse pendant 2 h (un 2ᵉ arrosage prolonge, sans s'additionner).
const FW_BONUS = .2, FW_MS = 2 * 3600e3;
const boostedAt = t => (S.friendWater || []).some(w => t >= w.at && t < w.at + FW_MS);
// Vitesse d’une plante : compost, +25 % pour une plante de saison, +20 % après l'arrosage d'un ami (bonus additionnés).
const plantSpeed = (k, boost) => speed() * (1 + (inSeason(k) ? SEASON_BONUS - 1 : 0) + (boost ? FW_BONUS : 0));
const growSpeed = k => plantSpeed(k, boostedAt(now())); // vitesse de pousse actuelle d’une plante
// Nombre de voisins qui peuvent attendre une commande en même temps (3, puis 4 et 5 avec le Banc des voisins).
const maxOrders = () => UPG.village.values[S.upg.village || 0];
const stoves = () => UPG.stove.values[S.upg.stove];
const cnt = (bag, k) => bag[k] || 0;
/* Récoltes dorées : clé "gold_<plante>", rangées à part, valent 10 fois plus. */
const GOLD_CHANCE = .02;
const isGold = k => typeof k === "string" && k.startsWith("gold_");
const goldBase = k => k.slice(5);
const goldArt = k => `<span class="gold-art">${cropArt(k)}</span>`;
const itemName = k => isGold(k) ? `${PLANTS[goldBase(k)].name} d’or` : PLANTS[k] ? PLANTS[k].name : WILD[k] ? WILD[k].name : RECIPES[k].name;
const itemArt = k => isGold(k) ? goldArt(goldBase(k)) : PLANTS[k] ? cropArt(k) : WILD[k] ? wildArt(k) : dishArt(k);
const itemBag = k => isGold(k) ? S.golden : PLANTS[k] ? S.crops : WILD[k] ? S.wild : S.dishes;
const itemVal = k => isGold(k) ? PLANTS[goldBase(k)].sell * 10 : PLANTS[k] ? PLANTS[k].sell : WILD[k] ? WILD[k].sell : RECIPES[k].sell;
const itemXp = k => isGold(k) ? PLANTS[goldBase(k)].xp * 3 : PLANTS[k] ? PLANTS[k].xp : RECIPES[k].xp;
const itemDesc = k => isGold(k) ? `Une ${PLANTS[goldBase(k)].name.toLowerCase()} rarissime, qui brille comme un trésor. Elle vaut dix fois le prix normal.` : (PLANTS[k] || WILD[k] || RECIPES[k]).desc;
// Une plante déjà récoltée reste disponible, même si son niveau de déblocage a changé.
// Niveau à partir duquel une plante est accessible (pour un hybride : quand ses deux parents le sont).
const plantLvl = k => PLANTS[k].hybrid ? Math.max(...PLANTS[k].parents.map(p => PLANTS[p].lvl)) : PLANTS[k].lvl;
const seedAvailable = k => { const d = PLANTS[k]; return d.hybrid ? S.hybrids.includes(k) : d.lvl <= S.level || S.discovered.includes(k); };
// Graines achetables maintenant : les plantes exclusives ne sont vendues que pendant leur saison.
const seedBuyable = k => seedAvailable(k) && (!PLANTS[k].only || PLANTS[k].season === season());
const seasonNote = k => { const d = PLANTS[k]; if (!d?.season) return ""; const z = SEASONS[d.season];
  return `Plante ${z.of} : pousse 25 % plus vite ${d.season === "ete" ? "l’été" : d.season === "hiver" ? "l’hiver" : d.season === "automne" ? "l’automne" : "au printemps"}${d.only ? `. Graines vendues seulement à cette saison` : ""}.`; };

/* ---------------- State ---------------- */
const SAVE_KEY = IS_TEST ? "petit-potager-test" : "petit-potager-v1"; // la version de test a sa propre sauvegarde
let S;
function fresh() {
  const t = now();
  const P = () => ({ seed: null, grown: 0, last: t, waterUntil: 0, weed: false, lastSeed: null });
  const s = {
    v: 1, xpCurve2: true, xpCurve3: true, xpCurve4: true, xpCurve5: true, coins: 25, xp: 0, level: 1, settings: { theme: "light", vibrate: true, sound: true, volume: .6, notif: false },
    plots: Array.from({ length: 6 }, P),
    seeds: { radis: 3, laitue: 2 }, crops: {}, dishes: {}, wild: {}, games: {}, recipes: [], discovered: [], hybrids: [], golden: {}, goldenFound: [], decoSlots: [null, null, null], friendWater: [],
    upg: { water: 0, basket: 0, hose: 0, gloves: 0, fert: 0, stove: 0, auto: 0, village: 0 },
    cooking: [], lab: null, orders: [], nextOrderAt: t + 45000,
    stats: { harvest: 0, butterflies: 0, cooked: 0, orders: 0, weeds: 0 }, last: t, lastPick: "radis",
  };
  // Un jardin déjà commencé pour la première visite
  Object.assign(s.plots[0], { seed: "radis", grown: 180000, waterUntil: t + 300000 });
  Object.assign(s.plots[1], { seed: "laitue", grown: 150000, waterUntil: t + 300000 });
  Object.assign(s.plots[2], { seed: "radis", grown: 60000, waterUntil: t + 300000 });
  return s;
}
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) {}
  return null;
}
function migrate(s) {
  // Hybrides remplacés (0.19.0) : on convertit graines, récoltes, découvertes et parcelles.
  const HYB_MAP = { rubis: "coeur", basilomate: "lanterne", bledor: "azur", citrouillotte: "amethyste" };
  const DISH_MAP = { confiture: "gnocchis", pesto: "lanterne_soupe" };
  const remap = (bag, map) => { if (!bag) return; for (const [o, n] of Object.entries(map)) if (bag[o]) { bag[n] = (bag[n] || 0) + bag[o]; delete bag[o]; } };
  remap(s.seeds, HYB_MAP); remap(s.crops, HYB_MAP); remap(s.dishes, DISH_MAP);
  if (s.hybrids) s.hybrids = [...new Set(s.hybrids.map(k => HYB_MAP[k] || k))];
  if (s.discovered) s.discovered = [...new Set(s.discovered.map(k => HYB_MAP[k] || k))];
  if (s.recipes) s.recipes = [...new Set(s.recipes.map(r => DISH_MAP[r] || r))];
  for (const p of s.plots || []) { if (HYB_MAP[p.seed]) p.seed = HYB_MAP[p.seed]; if (HYB_MAP[p.lastSeed]) p.lastSeed = HYB_MAP[p.lastSeed]; }
  if (s.cooking) for (const c of s.cooking) if (DISH_MAP[c.r]) c.r = DISH_MAP[c.r];
  if (s.lab) { if (HYB_MAP[s.lab.a]) s.lab.a = HYB_MAP[s.lab.a]; if (HYB_MAP[s.lab.b]) s.lab.b = HYB_MAP[s.lab.b]; }
  if (s.orders) s.orders = s.orders.filter(o => Object.keys(o.items).every(k => PLANTS[k] || RECIPES[k]));
  // Panier et gants sont à acheter pour tout le monde : on retire ceux offerts par la version 0.17.0.
  if (!s.decoSlots) s.decoSlots = [null, null, null];
  s.decoSlots = s.decoSlots.map(d => DECO_RENAME[d] || d);
  // 2.9.5 : recettes apprises alors que leur hybride n'était pas découvert → retirées et remboursées.
  if (!s.hybRefund && Array.isArray(s.recipes)) {
    const bad = s.recipes.filter(r => RECIPES[r] && Object.keys(RECIPES[r].need).some(k => PLANTS[k]?.hybrid && !(s.hybrids || []).includes(k)));
    if (bad.length) { s.recipes = s.recipes.filter(r => !bad.includes(r)); s.coins = (s.coins || 0) + bad.reduce((t, r) => t + RECIPES[r].price, 0); s.hybRefundMsg = bad.map(r => RECIPES[r].name); }
    s.hybRefund = true;
  }
  if (s.title === "Chasseur de papillons") s.title = "Ami des petites bêtes"; // succès renommé (2.6.3)
  // Nouvelle courbe d’XP : on garde le niveau et la même proportion de la barre en cours.
  if (!s.xpCurve2) { s.xp = Math.round((s.xp || 0) / xpNeedOld(s.level || 1) * (20 * (s.level || 1) ** 2)); s.xpCurve2 = true; }
  const L = s.level || 1, c3 = 8 * L * L + 60 * L;
  if (!s.xpCurve3) { s.xp = Math.min(c3 - 1, Math.round((s.xp || 0) / (20 * L ** 2) * c3)); s.xpCurve3 = true; }
  if (!s.xpCurve4) { s.xp = Math.min(xpNeed4(L) - 1, Math.round((s.xp || 0) / c3 * xpNeed4(L))); s.xpCurve4 = true; }
  if (!s.xpCurve5) { s.xp = Math.min(xpNeed(L) - 1, Math.round((s.xp || 0) / xpNeed4(L) * xpNeed(L))); s.xpCurve5 = true; }
  if (s.upg && !s.upgBought017) { s.upg.basket = 0; s.upg.gloves = 0; s.upgBought017 = true; }
  const f = fresh(); for (const k in f) if (!(k in s)) s[k] = f[k]; for (const k in f.upg) if (!(k in s.upg)) s.upg[k] = 0; for (const k in f.stats) if (!(k in s.stats)) s.stats[k] = 0; for (const k in f.settings) if (!(k in s.settings)) s.settings[k] = f.settings[k]; return s; }
let lastSaveAt = 0;
function save() { try { S.last = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); lastSaveAt = S.last; } catch (e) {} }

/* ---------------- Simulation ---------------- */
const DRY_RATE = .25; // vitesse de pousse quand la terre est sèche
/* Pousse d'une parcelle jusqu'à t (sert aussi pour le jardin d'un ami en visite).
   Le temps est découpé aux arrosages d'amis : à chaque arrosage, le bac est arrosé et le bonus démarre ou s'arrête. */
function growPlot(p, t) {
  const fw = S.friendWater || [];
  if (fw.length && p.last < t) {
    const cuts = [];
    for (const w of fw) for (const x of [w.at, w.at + FW_MS]) if (x > p.last && x < t) cuts.push(x);
    for (const c of cuts.sort((a, b) => a - b)) {
      growSeg(p, c);
      for (const w of fw) if (w.at === c) p.waterUntil = Math.max(p.waterUntil, c + waterMs());
    }
  }
  growSeg(p, t);
}
function growSeg(p, t) {
  if (p.seed) {
    const sp = plantSpeed(p.seed, boostedAt(p.last));
    const need = PLANTS[p.seed].time * 1000;
    if (p.grown < need && !p.weed) {
      // Arrosée : pleine vitesse. Terre sèche : la plante pousse quand même, au ralenti (DRY_RATE).
      const wu = S.upg.auto ? Infinity : p.waterUntil;
      const wet = Math.max(0, Math.min(t, wu) - p.last), dry = Math.max(0, t - Math.max(p.last, wu));
      const g0 = p.grown, gWet = wet * sp;
      p.grown = Math.min(need, g0 + gWet + dry * sp * DRY_RATE);
      if (g0 < need && p.grown >= need) // moment où la plante a mûri
        p.ripeAt = g0 + gWet >= need ? p.last + (need - g0) / sp : Math.max(p.last, wu) + (need - g0 - gWet) / (sp * DRY_RATE);
      if (!S.upg.auto && t >= p.waterUntil && p.grown < need) p.wasDry = true;
    }
  }
  p.last = t;
}
function tick(t) {
  const sz = season(); if (!(S.stats.seasonsSeen || []).includes(sz)) S.stats.seasonsSeen = [...(S.stats.seasonsSeen || []), sz];
  for (const p of S.plots) growPlot(p, t);
  if (S.plots.length && S.plots.every(p => p.seed)) S.stats.fullGarden = 1;
  // Succès caché « Patience » : une plante mûre depuis plus de 24 h (débloqué sans attendre la récolte).
  for (const p of S.plots) if (p.seed && !p.weed && p.grown >= PLANTS[p.seed].time * 1000) {
    if (!p.ripeAt) p.ripeAt = t; // plante mûre sans date connue (ancienne sauvegarde) : on compte à partir de maintenant
    if (t - p.ripeAt > 24 * 3600000) S.stats.patience = 1;
  }
  // Succès cachés : escargot gardé plus d'une heure, tous les bacs plantés de la même plante.
  if (S.plots.length >= 6 && S.plots.every(p => p.seed && p.seed === S.plots[0].seed)) S.stats.monoculture = 1;
  S.stats.maxCoins = Math.max(st("maxCoins"), S.coins);
  S.orders = S.orders.filter(o => Object.keys(o.items).every(k => (PLANTS[k] || RECIPES[k]) && knownItem(k)));
  if (S.orders.length < maxOrders() && t >= S.nextOrderAt) { S.orders.push(genOrder()); S.nextOrderAt = t + rand(90, 150) * 1000; }
}
function plotState(p, t) {
  if (!p.seed) return "empty";
  if (p.weed) return "weed";
  if (p.grown >= PLANTS[p.seed].time * 1000) return "ripe";
  if (!S.upg.auto && t >= p.waterUntil) return "dry";
  return "growing";
}
function plotStage(p) { const f = p.grown / (PLANTS[p.seed].time * 1000); return f >= 1 ? 3 : f >= .55 ? 2 : f >= .2 ? 1 : 0; }

function addXp(n) {
  n = Math.round(n * xpMult());
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++;
    LEVEL_QUEUE.push(S.level);
  }
  if (LEVEL_QUEUE.length) setTimeout(showLevelUp, 0); // après l'action en cours (une autre fenêtre passe d'abord)
}
/* Fenêtre « Niveau X ! » avec tout ce qui vient d'être débloqué. */
const LEVEL_QUEUE = [];
function unlockItems(L) {
  const out = [];
  for (const k of ORDER) if (!PLANTS[k].hybrid && PLANTS[k].lvl === L) out.push({ art: seedArt(k), name: PLANTS[k].name, kind: PLANTS[k].only ? `Plante ${SEASONS[PLANTS[k].season].of}, en vente à sa saison` : "Nouvelle graine au marché" });
  for (const r of RORDER) if (RECIPES[r].lvl === L) out.push({ art: dishArt(r), name: RECIPES[r].name, kind: "Nouvelle recette au marché" });
  for (const u in UPG) { const i = UPG[u].steps.findIndex(s => s.lvl === L); if (i >= 0) out.push({ art: `<img src="assets/img/${UPG[u].img || "ameliorations/upg-" + u}.webp" alt="">`, name: UPG[u].name, kind: `${UPG[u].desc(UPG[u].values[i + 1])}`, buy: UPG[u].steps[i].cost }); }
  PLOT_STEPS.forEach(s => { if (s.lvl === L) out.push({ art: `<img src="assets/img/ameliorations/upg-plot.webp" alt="">`, name: "Nouvelle parcelle", kind: "Un bac de plus dans le jardin", buy: s.cost }); });
  if (L === 3) out.push({ art: `<img src="assets/img/atelier/greenhouse.webp" alt="">`, name: "La Serre à hybrides", kind: "Croise tes récoltes" });
  for (const id of GORDER) if (GAMES[id].lvl === L) out.push({ art: gameArt(id), name: GAMES[id].name, kind: L === BALADES_LVL ? "Les Balades ouvrent : un premier petit jeu" : "Nouveau jeu dans les Balades" });
  return out;
}
/* ---------------- Cadeau du jour ---------------- */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function dailyOffer() {
  const today = dayKey();
  S.daily = S.daily || { last: null, streak: 0, offer: null };
  if (S.daily.last === today) return null;               // déjà récupéré aujourd'hui
  if (S.daily.offer && S.daily.offer.day === today) return S.daily.offer;
  const y = new Date(); y.setDate(y.getDate() - 1);
  // Série de jours d'affilée (sans plafond) ; la frise de 7 jours repart à 1 chaque semaine.
  const run = S.daily.last === dayKey(y) ? (S.daily.run || S.daily.streak || 0) + 1 : 1;
  const streak = (run - 1) % 7 + 1, big = streak === 7;
  const pool = ORDER.filter(k => !PLANTS[k].hybrid && !PLANTS[k].only && seedAvailable(k));
  // Une sorte de graine, 2 graines. Fin de semaine : 1 graine de saison et 1 graine d'hybride en plus.
  const seeds = {};
  if (pool.length) seeds[pick(pool)] = 2;
  if (big) {
    const sz = ORDER.filter(k => PLANTS[k].only && PLANTS[k].season === season() && PLANTS[k].lvl <= S.level);
    // À défaut de graine de saison ou d'hybride : 2 graines d'une autre sorte à la place.
    const extra = () => { const o = pool.filter(k => !seeds[k]); if (o.length) seeds[pick(o)] = 2; };
    if (sz.length) seeds[pick(sz)] = 1; else extra();
    if (S.hybrids.length) seeds[pick(S.hybrids)] = 1; else extra();
  }
  const boost = big ? 2.5 : 1 + (streak - 1) * .15;
  S.daily.offer = { day: today, streak, run, big, seeds, coins: Math.round((10 + S.level * 4) * boost), xp: Math.round((5 + S.level * 2) * boost) };
  return S.daily.offer;
}
function showDaily() {
  const o = dailyOffer();
  if (!o || !$("#modal").hidden || LEVEL_QUEUE.length || tutoBasicsPending()) return;
  modalView = () => `<div class="sheet levelup" role="dialog" aria-modal="true" aria-label="Cadeau du jour">
    <div class="lv-badge daily-gift">${GIFT}</div>
    <h2>${o.big ? "Cadeau de la semaine !" : "Cadeau du jour"}</h2>
    <p class="muted" style="margin:0">${o.big ? "Une semaine complète : voici un gros cadeau !" : o.streak > 1 ? "Ton cadeau grossit chaque jour de la semaine." : "Reviens chaque jour pour un cadeau plus gros."}</p>
    ${(o.run || 1) > 1 ? `<p class="daily-run">Série : <b class="num">${o.run} jours</b> d’affilée</p>` : ""}
    <div class="daily-streak">${Array.from({ length: 7 }, (_, i) => `<span class="${i < o.streak ? "on" : ""}${i === 6 ? " gift" : ""}">${i === 6 ? GIFT : i + 1}</span>`).join("")}</div>
    <div class="lv-list">
      ${Object.entries(o.seeds).map(([k, n]) => `<div class="lv-item"><div class="lv-art">${seedArt(k)}</div><div><b>${n} graine${n > 1 ? "s" : ""} de ${PLANTS[k].name.toLowerCase()}</b><span>Directement dans ton inventaire</span></div></div>`).join("")}
      <div class="lv-item"><div class="lv-art"><span class="coin" style="width:100%;height:100%"></span></div><div><b class="num">${fmt(o.coins)} pièces</b><span>Pour le marché</span></div></div>
      <div class="lv-item"><div class="lv-art"><img src="assets/img/interface/xp-leaf.webp" alt=""></div><div><b class="num">+${o.xp} XP</b><span>Pour monter de niveau</span></div></div>
    </div>
    <button class="btn big" data-act="claimDaily">Récupérer</button></div>`;
  $("#modal").innerHTML = modalView(); openModal();
}
const GIFT = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="26" width="44" height="32" rx="5" fill="#ff8f78"/><rect x="6" y="18" width="52" height="12" rx="4" fill="#ffa68f"/><rect x="28" y="18" width="8" height="40" fill="#f4c03e"/><path d="M32 18c-6-10-18-8-14 0zM32 18c6-10 18-8 14 0z" fill="none" stroke="#f4c03e" stroke-width="5" stroke-linecap="round"/></svg>`;

/* ---------------- Objectifs du jour ---------------- */
// Chaque jour, 3 petites quêtes de types différents, adaptées au niveau.
const QUEST_TYPES = [
  { id: "harvestK", w: 5, make: () => { const pool = ORDER.filter(k => !PLANTS[k].hybrid && PLANTS[k].lvl <= S.level); const k = pick(pool);
      const n = Math.max(3, Math.min(15, Math.round(2400 / PLANTS[k].time * (1 + S.level / 10)))); return { k, n, text: `Récolter ${n} ${PLANTS[k].name.toLowerCase()}${n > 1 && !/s$/.test(PLANTS[k].name) ? "s" : ""}`, base: PLANTS[k].sell * n }; } },
  { id: "harvest", w: 3, make: () => { const n = 10 + S.level * 2; return { n, text: `Faire ${n} récoltes`, base: n * 8 }; } },
  { id: "cook", w: 4, lvl: 2, make: () => { const n = 2 + Math.floor(S.level / 4); return { n, text: `Cuisiner ${n} plats`, base: n * 45 }; } },
  { id: "deliver", w: 4, make: () => { const n = 1 + Math.floor(S.level / 5); return { n, text: `Livrer ${n} commande${n > 1 ? "s" : ""} au village`, base: n * 60 }; } },
  { id: "water", w: 3, make: () => { const n = 10 + S.level; return { n, text: `Arroser ${n} fois`, base: n * 5 }; } },
  { id: "butterfly", w: 2, make: () => { const n = 2 + Math.floor(S.level / 6); return { n, text: `Attraper ${n} ${n > 1 ? VISITOR().plural : VISITOR().name}`, base: n * 30 }; } },
  { id: "snail", w: 2, make: () => { const n = 3 + Math.floor(S.level / 5); return { n, text: PEST().quest(n), base: n * 15 }; } },
  { id: "cross", w: 3, lvl: 3, make: () => { const n = 1 + Math.floor(S.level / 7); return { n, text: `Faire ${n} croisement${n > 1 ? "s" : ""} dans la serre`, base: n * 70 }; } },
  { id: "sell", w: 3, make: () => { const n = Math.round((60 + S.level * 40) / 10) * 10; return { n, text: `Gagner ${fmt(n)} pièces au marché`, base: n * .4 }; } },
];
function dailyQuests() {
  const today = dayKey();
  if (S.quests && S.quests.day === today) return S.quests;
  const types = QUEST_TYPES.filter(q => S.level >= (q.lvl || 1)), list = [];
  while (list.length < 3) {
    const t = weightedPick(types.filter(q => !list.some(l => l.type === q.id)), q => q.w);
    const q = t.make();
    list.push({ type: t.id, k: q.k || null, n: q.n, text: q.text, prog: 0, claimed: false, coins: Math.round((q.base * .6 + 20 + S.level * 4) * .8), xp: Math.round(8 + S.level * 3) });
  }
  S.quests = { day: today, list, bonus: false };
  return S.quests;
}
function questProgress(type, amount = 1, k = null) {
  if (typeof weeklyProgress === "function") weeklyProgress(type, amount, k); // objectifs de la semaine
  const Q = dailyQuests();
  for (const q of Q.list) if (!q.claimed && q.type === type && (!q.k || q.k === k) && q.prog < q.n) q.prog = Math.min(q.n, q.prog + amount);
  if (type === "harvestK") questProgress("harvest", amount);
}
function questsHTML() {
  const Q = dailyQuests();
  const doneAll = Q.list.every(q => q.claimed);
  return `<section class="panel quests"><div class="row spread"><h2>Objectifs du jour</h2><span class="small muted num">${Q.list.filter(q => q.claimed).length} / 3</span></div>
    ${Q.list.map((q, i) => { const ok = q.prog >= q.n; return `<div class="quest ${q.claimed ? "claimed" : ok ? "ready" : ""}">
      <div class="q-ico">${q.k ? cropArt(q.k) : q.type === "butterfly" ? visitorArt(VISITOR().key) : q.type === "snail" ? pestIcon(PEST().key) : QUEST_ICONS[q.type]}</div>
      <div class="q-txt"><b>${q.text}</b><div class="pbar"><i style="width:${(q.prog / q.n * 100).toFixed(1)}%"></i></div>
        <span class="small muted num">${fmt(q.prog)} / ${fmt(q.n)} · ${coin}${fmt(q.coins)} · +${q.xp} XP</span></div>
      ${q.claimed ? `<span class="q-done">✓</span>` : `<button class="btn sm" data-act="claimQuest" data-arg="${i}" ${ok ? "" : "disabled"}>Récupérer</button>`}
    </div>`; }).join("")}
    ${doneAll && !Q.bonus ? `<button class="btn big peach" data-act="claimQuestBonus">Bonus des 3 objectifs · ${coin}${fmt(50 + S.level * 15)}</button>` : ""}
    ${Q.bonus ? `<p class="small muted" style="margin:0;text-align:center">Tous les objectifs sont faits. Nouveaux objectifs demain !</p>` : ""}
  </section>`;
}
const QUEST_ICONS = {
  harvest: `<img src="assets/img/ameliorations/upg-basket.webp" alt="">`, cook: `<img src="assets/img/atelier/stove-on.webp" alt="">`,
  deliver: `<img src="assets/img/voisins/villager-0.webp" alt="">`, water: `<img src="assets/img/ameliorations/upg-water.webp" alt="">`,
  butterfly: `<img src="assets/img/interface/ui-butterfly.webp" alt="">`, snail: `<img src="assets/img/interface/ui-snail.webp" alt="">`,
  cross: `<img src="assets/img/atelier/cauldron.webp" alt="">`, sell: `<img src="assets/img/interface/ui-coin.webp" alt="">`,
};

function showLevelUp() {
  if (!LEVEL_QUEUE.length || !$("#modal").hidden) return;
  const levels = LEVEL_QUEUE.splice(0);
  const items = levels.flatMap(unlockItems);
  const L = levels[levels.length - 1];
  const big = levels.some(l => l % 3 === 0); // grand palier tous les 3 niveaux
  modalView = () => `<div class="sheet levelup${big ? " big" : ""}" role="dialog" aria-modal="true" aria-label="Niveau ${L}">
    ${big ? `<span class="lv-tag">Grand palier</span>` : ""}
    <div class="lv-badge"><img src="assets/img/interface/xp-leaf.webp" alt=""><span class="num">${L}</span></div>
    <h2>Niveau ${L} !</h2>
    ${items.length ? `<p class="muted" style="margin:0">Tu as maintenant accès à :</p>
      <div class="lv-list">${items.map(it => `<div class="lv-item"><div class="lv-art">${it.art}</div><div><b>${it.name}</b><span>${it.kind}</span>${it.buy ? `<span class="lv-buy">À acheter dans Marché › Bonus · ${coin}${fmt(it.buy)}</span>` : ""}</div></div>`).join("")}</div>`
      : `<p class="muted" style="margin:0">Ta main verte s’affirme. Continue comme ça !</p>`}
    <button class="btn big" data-act="close">Super !</button></div>`;
  $("#modal").innerHTML = modalView(); openModal(); buzz([15, 50, 15]); SFX.play("level");
}
function unlocksAt(L) {
  const out = [];
  for (const k of ORDER) if (!PLANTS[k].hybrid && PLANTS[k].lvl === L) out.push(`graines de ${PLANTS[k].name.toLowerCase()}`);
  for (const r of RORDER) if (RECIPES[r].lvl === L) out.push(`recette « ${RECIPES[r].name} »`);
  for (const u in UPG) if (UPG[u].steps.some(s => s.lvl === L)) out.push(UPG[u].name.toLowerCase());
  if (PLOT_STEPS.some(s => s.lvl === L)) out.push("une parcelle");
  if (L === 3) out.push("la Serre à hybrides");
  return out;
}
function earn(n, x, y, xp, cls) {
  n = Math.round(n * coinMult());
  if (n > 0) SFX.play("coin");
  S.coins += n;
  if (xp) addXp(xp);
  if (x != null) floatText(`+${fmt(n)}${xp ? ` · +${xp} XP` : ""}`, x, y, cls || true);
}

/* Commandes des voisins : variées, faisables, et sans répétitions trop rapprochées. */
const ORDER_LINES = [
  "Tu aurais ça pour moi ?", "J’en rêve depuis ce matin !", "C’est pour un repas entre voisins.",
  "Je te paierai bien, promis !", "Mon panier est tout vide…", "Une petite douceur pour aujourd’hui ?",
];
/* Un hybride encore inconnu ne doit jamais apparaître (pas de spoiler), même via une recette. */
const knownItem = k => PLANTS[k] ? (!PLANTS[k].hybrid || S.hybrids.includes(k)) : WILD[k] ? true : Object.keys(RECIPES[k].need).every(knownItem);
// Ingrédient de balade : on peut s'en procurer si on en a, ou si son jeu est ouvert.
const wildReachable = k => cnt(S.wild, k) > 0 || GORDER.some(id => !gameLocked(id) && (GAMES[id].gives || []).includes(k));
function dishFeasible(r) {
  return knownItem(r) && Object.keys(RECIPES[r].need).every(k => WILD[k] ? wildReachable(k) : seedBuyable(k) || cnt(S.crops, k) > 0);
}
function weightedPick(items, weight) {
  const w = items.map(weight), tot = w.reduce((a, b) => a + b, 0);
  if (tot <= 0) return pick(items);
  let r = Math.random() * tot;
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
/* Types de commandes, du plus simple au plus exigeant.
   lvl = niveau minimum ; need = ce qu'il faut avoir débloqué ; w = fréquence ; bonus = prime de difficulté. */
const ORDER_TYPES = [
  { id: "c1",  label: "Facile",    stars: 1, lvl: 1, w: 6, bonus: 1.15, plan: ["c"] },
  { id: "c2",  label: "Facile",    stars: 1, lvl: 2, w: 5, bonus: 1.25, plan: ["c", "c"] },
  { id: "d1",  label: "Moyenne",   stars: 2, lvl: 2, w: 4, bonus: 1.3,  plan: ["d"], need: "dish" },
  { id: "dc",  label: "Moyenne",   stars: 2, lvl: 4, w: 4, bonus: 1.4,  plan: ["d", "c"], need: "dish" },
  { id: "c3",  label: "Moyenne",   stars: 2, lvl: 5, w: 3, bonus: 1.45, plan: ["c", "c", "c"] },
  { id: "hc",  label: "Difficile", stars: 3, lvl: 4, w: 3, bonus: 1.6,  plan: ["h", "c"], need: "hyb" },
  { id: "hcc", label: "Difficile", stars: 3, lvl: 7, w: 2, bonus: 1.75, plan: ["h", "c", "c"], need: "hyb" },
  { id: "dh",  label: "Difficile", stars: 3, lvl: 6, w: 2, bonus: 1.9,  plan: ["d", "h"], need: "dish+hyb" },
  // Grands jardins (8 parcelles et plus) : commandes de plusieurs plats.
  { id: "dd",  label: "Difficile", stars: 3, lvl: 8, w: 3, bonus: 1.7,  plan: ["d", "d"], need: "dish", plots: 8 },
  { id: "ddc", label: "Difficile", stars: 3, lvl: 12, w: 2, bonus: 1.85, plan: ["d", "d", "c"], need: "dish", plots: 10 },
];
/* Effort pour obtenir un objet : prix de vente, corrigé par le temps de pousse et la rareté. */
function itemEffort(k, q) {
  if (PLANTS[k]) {
    const d = PLANTS[k];
    return d.sell * q * (1 + d.time / 3600) * (d.hybrid ? 1.5 : 1);
  }
  if (WILD[k]) return WILD[k].sell * q * 1.6; // ingrédient de balade : parties limitées par jour
  const r = RECIPES[k]; // un plat : sa valeur + l'effort de ses ingrédients + le temps de cuisson
  const ing = Object.entries(r.need).reduce((t, [i, n]) => t + itemEffort(i, n), 0);
  return (r.sell * .6 + ing * .5) * (1 + r.time / 1200) * q;
}
function genOrder() {
  const hist = S.orderHist || [];
  const busy = new Set(S.orders.flatMap(o => Object.keys(o.items)));
  // Plus un objet a été demandé récemment (ou est déjà demandé), moins il a de chances de revenir.
  const freshness = k => { if (busy.has(k)) return .05; const i = hist.lastIndexOf(k); return i < 0 ? 1 : .15 + .85 * (hist.length - 1 - i) / Math.max(1, hist.length); };
  const crops = ORDER.filter(k => !PLANTS[k].hybrid && seedBuyable(k));
  const hybs = ORDER.filter(k => PLANTS[k].hybrid && seedAvailable(k));
  // Toutes les recettes accessibles à ce niveau (apprises ou non) : ça donne envie d’acheter celles qui manquent.
  const dishes = RORDER.filter(r => RECIPES[r].lvl <= S.level && dishFeasible(r));
  const ok = t => S.level >= t.lvl && S.plots.length >= (t.plots || 0) && (!t.need || (t.need.includes("dish") ? dishes.length : true) && (t.need.includes("hyb") ? hybs.length : true))
    && t.plan.filter(x => x === "c").length <= crops.length;
  const types = ORDER_TYPES.filter(ok);
  const type = weightedPick(types, t => t.w * (t.id === S.lastOrderType ? .3 : 1));
  const items = {};
  // Plus le jardin est grand, plus les voisins en demandent : ×1 à 6 parcelles, jusqu’à ×2 à 12.
  const big = Math.min(2, S.plots.length / 6);
  const qtyCrop = k => Math.max(1, Math.min(Math.round(5 * big), Math.round(rand(.7, 1.3) * 900 / PLANTS[k].time * big))); // pousses courtes : on en demande plus
  const take = (list, w = freshness) => weightedPick(list.filter(x => !items[x]), w);
  for (const slot of type.plan) {
    if (slot === "c") { const k = take(crops); if (k) items[k] = qtyCrop(k); }
    if (slot === "h") { const k = take(hybs); if (k) items[k] = Math.max(1, Math.round((Math.random() < .7 ? 1 : 2) * big)); }
    if (slot === "d") { const r = take(dishes); if (r) items[r] = Math.random() < big - 1 ? 2 : 1; } // grand jardin : parfois deux fois le même plat
  }
  if (!Object.keys(items).length) { const k = pick(crops); items[k] = qtyCrop(k); }
  // Hors saison (1 commande sur 8) : un voisin réclame une plante exclusive déjà récoltée, ou un plat qui en contient.
  // Il faut avoir gardé des graines ou des récoltes : la commande rapporte 30 % de plus.
  let offSeason = false;
  const outEx = ORDER.filter(k => PLANTS[k].only && PLANTS[k].season !== season() && S.discovered.includes(k));
  if (outEx.length && Math.random() < 1 / 8) {
    const outDish = RORDER.filter(r => RECIPES[r].lvl <= S.level && knownItem(r) && Object.keys(RECIPES[r].need).some(k => outEx.includes(k))
      && Object.keys(RECIPES[r].need).every(k => outEx.includes(k) || (WILD[k] ? wildReachable(k) : seedBuyable(k) || cnt(S.crops, k) > 0)));
    for (const k in items) delete items[k];
    if (outDish.length && Math.random() < .4) items[pick(outDish)] = 1;
    else { const k = pick(outEx); items[k] = Math.max(1, qtyCrop(k) - 1); }
    offSeason = true;
  }
  S.orderHist = hist.concat(Object.keys(items)).slice(-10);
  S.lastOrderType = type.id;
  let effort = 0, xp = 0;
  for (const k in items) { effort += itemEffort(k, items[k]); xp += itemXp(k) * items[k]; }
  const used = new Set(S.orders.map(o => o.v));
  // Les voisins de saison ne passent que pendant leur saison, et demandent volontiers les plantes de saison.
  // Jamais deux fois le même voisin en même temps.
  const here = VILLAGERS.map((_, i) => i).filter(i => (!VILLAGERS[i].season || VILLAGERS[i].season === season()) && (!VILLAGERS[i].balade || !gameLocked(VILLAGERS[i].balade)));
  const free = here.filter(i => !used.has(i) && i !== S.lastVillager);
  const guest = free.find(i => VILLAGERS[i].season);
  // v4 : un voisin des Balades passe volontiers chercher un de ses plats préférés.
  const fan = free.find(i => VILLAGERS[i].likes && Object.keys(items).some(k => VILLAGERS[i].likes.includes(k)));
  const v = fan != null && Math.random() < .75 ? fan
    : guest != null && Object.keys(items).some(k => inSeason(k)) && Math.random() < .7 ? guest : free.length ? pick(free) : pick(here.filter(i => !used.has(i)));
  S.lastVillager = v;
  const lines = VILLAGERS[v].say.concat(ORDER_LINES);
  // Hors saison : toujours « Difficile », avec le meilleur bonus de difficulté, puis +30 %.
  const bonus = offSeason ? Math.max(...ORDER_TYPES.map(t => t.bonus)) * 1.3 : type.bonus;
  return { id: Math.random().toString(36).slice(2, 9), v, say: pick(lines), items, type: type.id, stars: offSeason ? 3 : type.stars, label: offSeason ? "Difficile" : type.label,
    offSeason, coins: Math.round((effort * bonus + 2) * .8), xp: Math.round((xp * .8 + 3) * bonus) }; // 2.16 : −20 % de pièces, moins d’XP
}

/* ---------------- Actions ---------------- */
let tab = "garden", msub = "seeds", labSel = [null, null], atelierSub = "kitchen"; // Atelier : Cuisine ou Serre, la dernière ouverte
const A = {
  tab(arg) { if (arg === "atelier") arg = atelierSub; if (arg === "kitchen" || arg === "lab") atelierSub = arg; tab = arg; if (typeof FR !== "undefined") FR.hlTrade = false; tutoFlag("tab_" + arg); render(true); window.scrollTo({ top: 0 }); },
  plot(i, ev) {
    const t = now(); tick(t);
    const p = S.plots[+i]; const st = plotState(p, t);
    const { x, y } = pos(ev);
    if (st === "empty") { if (cnt(S.seeds, "radis_eclair")) return A.plant(`${i}:radis_eclair`, ev); return openPicker(+i); }
    if (st === "weed") { p.weed = false; S.stats.weeds++; questProgress("snail"); SFX.play("snail"); earn(1, x, y, 2, "gain-" + PEST().key); floatText(PEST().act, x, y - 26, "gain-" + PEST().key); }
    else if (st === "ripe") harvest(+i, x, y);
    else { const W = UI.spam || {}; UI.spam = W.i === +i && t - W.t < 1500 ? { i: +i, n: W.n + 1, t } : { i: +i, n: 1, t }; if (UI.spam.n >= 10) S.stats.overWater = 1; // arrosé 10 fois d'affilée
      p.waterUntil = t + waterMs(); tutoFlag("watered"); questProgress("water"); SFX.play("water"); floatText("Arrosé !", x, y); }
    commit();
  },
  plant(arg, ev) {
    // arg = "graine" (bac choisi au départ, puis le prochain bac vide) ou "bac:graine".
    let [i, k] = arg.includes(":") ? arg.split(":") : [null, arg];
    if (i == null) i = PICK.plot != null && !S.plots[PICK.plot]?.seed ? PICK.plot : S.plots.findIndex(p => !p.seed);
    const p = S.plots[+i]; const d = PLANTS[k];
    if (!p || p.seed) return;
    if (!cnt(S.seeds, k)) { if (S.coins < d.cost || !seedBuyable(k)) return; S.coins -= d.cost; S.seeds[k] = 1; }
    S.seeds[k]--; const t = now();
    Object.assign(p, { seed: k, grown: 0, last: t, planted: t, waterUntil: t + waterMs(), weed: false, lastSeed: k, wasDry: false, ripeAt: 0 });
    if (d.tuto) p.waterUntil = t; // la graine de Mamie arrive assoiffée : on apprend à arroser
    if (!d.tuto) S.lastPick = k; PICK.plot = null; tutoFlag("planted");
    // Petit rebond du bouton (la fenêtre reste ouverte et se redessine : l'état est gardé un instant).
    PICK.flash = k; clearTimeout(PICK.flashT); PICK.flashT = setTimeout(() => { PICK.flash = null; }, 600);
    if (ev) { const { x, y } = pos(ev); floatText(`${d.name} planté`, x, y); }
    buzz(8); SFX.play("plant");
    // La fenêtre reste ouverte tant qu'il reste des bacs vides.
    if (!S.plots.some(q => !q.seed)) closeModal();
    commit();
  },
  harvestAll(_, ev) {
    const t = now(); tick(t); let n = 0;
    S.plots.forEach((p, i) => { if (plotState(p, t) === "ripe") { harvest(i); n++; } });
    if (n) { const { x, y } = pos(ev); floatText(`${n} récolte${n > 1 ? "s" : ""}`, x, y); }
    commit();
  },
  snailsAll(_, ev) {
    const t = now(); tick(t); let n = 0;
    for (const p of S.plots) if (plotState(p, t) === "weed") { p.weed = false; S.stats.weeds++; n++; }
    if (n) { SFX.play("snail"); questProgress("snail", n); const { x, y } = pos(ev); earn(n, x, y, 2 * n, "gain-" + PEST().key); }
    commit();
  },
  waterAll(_, ev) {
    const t = now(); tick(t); let n = 0;
    for (const p of S.plots) { const st = plotState(p, t); if (st === "dry" || st === "growing") { p.waterUntil = t + waterMs(); n++; } }
    if (n) { SFX.play("water"); questProgress("water", n); tutoFlag("watered"); }
    const { x, y } = pos(ev); floatText(n ? "Tout est arrosé !" : "Rien à arroser", x, y); commit();
  },
  msub(arg) { msub = arg; render(true); },
  buySeed(arg) { const [k, q] = arg.split(":"); const n = +q, c = PLANTS[k].cost * n; if (S.coins < c || !seedBuyable(k)) return; S.coins -= c; S.seeds[k] = cnt(S.seeds, k) + n; commit(); },
  sell(arg, ev) {
    const [k, mode] = arg.split(":"); const bag = itemBag(k); const n = mode === "all" ? cnt(bag, k) : Math.min(1, cnt(bag, k));
    if (!n) return; bag[k] -= n; questProgress("sell", itemVal(k) * n); const { x, y } = pos(ev); earn(itemVal(k) * n, x, y); commit();
  },
  sellCrops(_, ev) {
    let tot = 0; for (const k in S.crops) { tot += S.crops[k] * PLANTS[k].sell; S.crops[k] = 0; }
    if (tot >= 1000) S.stats.bigSale = 1;
    if (tot) questProgress("sell", tot);
    if (tot) { const { x, y } = pos(ev); earn(tot, x, y); } commit();
  },
  buyRecipe(r) { const d = RECIPES[r]; if (S.coins < d.price || S.recipes.includes(r) || d.lvl > S.level || missingHyb(r).length) return; S.coins -= d.price; S.recipes.push(r); toast(`Recette apprise : <b>${d.name}</b>. Direction la Cuisine !`); commit(); },
  buyUpg(u) {
    S.upgBought017 = true; const step = UPG[u].steps[S.upg[u]]; if (!step || S.coins < step.cost || S.level < step.lvl) return; S.coins -= step.cost; S.upg[u]++; SFX.play("success"); commit(); },
  buyPlot() {
    const step = PLOT_STEPS[S.plots.length - 6]; if (!step || S.coins < step.cost || S.level < step.lvl) return;
    S.coins -= step.cost; const t = now(); S.plots.push({ seed: null, grown: 0, last: t, waterUntil: 0, weed: false, lastSeed: null });
    if (modalView === viewPlotShop) closeModal();
    SFX.play("plant"); commit();
  },
  openPlotShop() { modalView = viewPlotShop; $("#modal").innerHTML = viewPlotShop(); openModal(); },
  cook(r) {
    const d = RECIPES[r]; if (S.cooking.length >= stoves()) return;
    for (const k in d.need) if (cnt(itemBag(k), k) < d.need[k]) return;
    for (const k in d.need) itemBag(k)[k] -= d.need[k];
    S.cooking.push({ r, end: now() + d.time * 1000 * cookMult() }); commit();
  },
  serve(i, ev) {
    const c = S.cooking[+i]; if (!c || c.end > now()) return;
    SFX.play("cook"); questProgress("cook"); S.cooking.splice(+i, 1); S.dishes[c.r] = cnt(S.dishes, c.r) + 1; S.stats.cooked++; S.stats.cookedSet = [...new Set([...(S.stats.cookedSet || []), c.r])]; if (c.r === "gateau") S.stats.gateau = st("gateau") + 1;
    const { x, y } = pos(ev); addXp(RECIPES[c.r].xp); floatText(`+${RECIPES[c.r].xp} XP`, x, y); commit();
  },
  labPick(k) {
    if (PLANTS[k]?.hybrid) return;
    if (S.lab) return;
    // On peut choisir deux fois la même récolte si on en a au moins deux (ça ne donne rien… mais on peut essayer).
    const room = k2 => cnt(S.crops, k2) - labSel.filter(x => x === k2).length;
    if (!labSel[0]) labSel[0] = k;
    else if (!labSel[1]) { if (labSel[0] === k && room(k) < 1) labSel[0] = null; else labSel[1] = k; }
    else if (labSel.includes(k)) labSel[labSel.lastIndexOf(k)] = null;
    else labSel[1] = k;
    render(true);
  },
  labClear(i) { labSel[+i] = null; render(true); },
  labStart() {
    const [a, b] = labSel; if (!a || !b || S.lab) return;
    if (a === b ? cnt(S.crops, a) < 2 : (!cnt(S.crops, a) || !cnt(S.crops, b))) return;
    S.crops[a]--; S.crops[b]--; S.lab = { a, b, end: now() + LAB_TIME * 1000 }; labSel = [null, null]; commit();
  },
  labCollect() {
    const L = S.lab; if (!L || L.end > now()) return; S.lab = null; S.stats.crosses = st("crosses") + 1; questProgress("cross");
    const h = HYBRID_BY_PAIR[pairKey(L.a, L.b)];
    if (h) {
      S.seeds[h] = cnt(S.seeds, h) + 2;
      if (!S.hybrids.includes(h)) { S.hybrids.push(h); addXp(25); openReveal(h, true); releaseMysterySeeds(h); }
      else { addXp(6); openReveal(h, false); }
    } else if (L.a === L.b) {
      S.seeds[L.a] = cnt(S.seeds, L.a) + 1; addXp(1); S.stats.selfCross = (S.stats.selfCross || 0) + 1;
      toast(`Une ${PLANTS[L.a].name.toLowerCase()} avec une ${PLANTS[L.a].name.toLowerCase()}… ça donne une ${PLANTS[L.a].name.toLowerCase()}. Qui l’eût cru ? Tu récupères 1 graine.`, 6000);
    } else {
      const back = pick([L.a, L.b]); S.seeds[back] = cnt(S.seeds, back) + 1; addXp(3);
      const promising = [L.a, L.b].find(k => ORDER.some(x => PLANTS[x].hybrid && !S.hybrids.includes(x) && PLANTS[x].parents.includes(k)));
      toast(`Pas de nouvelle variété cette fois. Tu récupères 1 graine de ${PLANTS[back].name.toLowerCase()}.${promising ? ` Le ${PLANTS[promising].name.toLowerCase()} semble prometteur avec un autre partenaire…` : ""}`, 6000);
    }
    commit();
  },
  deliver(id, ev) {
    const o = S.orders.find(o => o.id === id); if (!o) return;
    for (const k in o.items) if (cnt(itemBag(k), k) < o.items[k]) return;
    for (const k in o.items) itemBag(k)[k] -= o.items[k];
    S.orders = S.orders.filter(x => x !== o); S.stats.orders++; questProgress("deliver");
    S.stats.served = [...new Set([...(S.stats.served || []), o.v])]; if (o.coins >= 500) S.stats.bigOrder = 1;
    const { x, y } = pos(ev); earn(o.coins, x, y, o.xp);
    if (S.orders.length < maxOrders()) S.nextOrderAt = Math.min(S.nextOrderAt, now() + 60000);
    commit();
  },
  dismiss(id) { S.stats.refused = st("refused") + 1; S.orders = S.orders.filter(o => o.id !== id); S.nextOrderAt = now() + 60000; commit(); },
  close() { closeModal(); },
  decoFlip(i) { S.decoFlip = S.decoFlip || [false, false, false]; S.decoFlip[+i] = !S.decoFlip[+i]; SFX.play("click"); save(); decoRefresh(+i); },
  decoNudge(arg) {
    const [i, dir] = arg.split(":"); S.decoOff = S.decoOff || [null, null, null];
    const o = { ...decoOff(+i) }, cl = v => Math.max(-DECO_MAX, Math.min(DECO_MAX, v));
    if (dir === "reset") { o.x = 0; o.y = 0; o.s = 0; }
    else if (dir === "bigger" || dir === "smaller") o.s = Math.max(-DECO_SMAX, Math.min(DECO_SMAX, o.s + (dir === "bigger" ? 1 : -1)));
    else { o.x = cl(o.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0)); o.y = cl(o.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0)); }
    S.decoOff[+i] = o.x || o.y || o.s ? o : null; SFX.play("click"); save();
    // Mise à jour sur place : pas de re-rendu de la fenêtre (évite le clignotement).
    decoRefresh(+i);
  },
  openSeason() { modalView = () => viewSeason(false); $("#modal").innerHTML = modalView(); openModal(); },
  toggleLab() { UI.labOpen = !UI.labOpen; render(true); },
  // Toucher le tri actif le retire : retour à l’ordre de base.
  setSort(arg) { const [c, m] = arg.split(":"); const cur = (S.settings.sort || {})[c]; S.settings.sort = { ...(S.settings.sort || {}), [c]: cur === m ? "none" : m }; commit(); },
  hideInstall() { S.settings.hideInstall = true; commit(); toast("D’accord ! Tu pourras toujours l’installer depuis les réglages."); },
  toggleDecoEdit() { UI.editDeco = !UI.editDeco; render(true); },
  decoPick(i) {
    if (!UI.editDeco && !S.decoSlots[+i]) return; modalView = () => viewDecoPick(+i); $("#modal").innerHTML = modalView(); openModal();
    // Garder le jardin visible au-dessus de la fenêtre.
    $(".garden")?.scrollIntoView({ block: "start", behavior: "smooth" });
  },
  decoSlots(d) { modalView = () => viewDecoSlots(d); $("#modal").innerHTML = modalView(); openModal(); },
  decoPlace(arg) {
    // arg = "emplacement:déco[:keep]" ; keep = depuis la fenêtre de choix, qui reste ouverte.
    const [i, d, keep] = arg.split(":"); const slot = +i;
    if (d && S.decoSlots[slot] === d) return;
    // Nouvelle déco : position, taille et sens repartent de zéro.
    const fresh = j => { if (S.decoOff) S.decoOff[j] = null; if (S.decoFlip) S.decoFlip[j] = false; };
    S.decoSlots.forEach((x, j) => { if (d && x === d && j !== slot) { S.decoSlots[j] = null; fresh(j); } }); // une déco n'occupe qu'un emplacement
    S.decoSlots[slot] = d || null; fresh(slot);
    SFX.play("plant");
    if (!keep || !d) { closeModal(); }
    commit();
  },
  claimQuest(i, ev) {
    const q = dailyQuests().list[+i]; if (!q || q.claimed || q.prog < q.n) return;
    q.claimed = true; S.stats.quests = (S.stats.quests || 0) + 1;
    const { x, y } = pos(ev); earn(q.coins, x, y, q.xp); SFX.play("success"); commit();
  },
  claimQuestBonus(_, ev) {
    const Q = dailyQuests(); if (Q.bonus || !Q.list.every(q => q.claimed)) return;
    Q.bonus = true; const { x, y } = pos(ev); earn(50 + S.level * 15, x, y, 10 + S.level * 2); SFX.play("level");
    commit();
  },
  // Toucher le message d'un succès : liste « Obtenus », défilée jusqu'au succès, qui s'illumine un instant.
  achGo(id, ev) {
    document.querySelectorAll(".toast:has(.ach-toast)").forEach(t => t.remove());
    UI.achTab = "done"; UI.achFlash = id; modalView = viewAch; $("#modal").innerHTML = viewAch(); openModal();
    document.querySelector(`#modal [data-ach="${id}"]`)?.scrollIntoView({ block: "center" });
    clearTimeout(A._achT); A._achT = setTimeout(() => { UI.achFlash = null; }, 2000);
  },
  openAch() { modalView = viewAch; $("#modal").innerHTML = viewAch(); openModal(); },
  setTitle(t) { S.title = t || ""; commit(); },
  achTab(t) { UI.achTab = t; render(true); $("#modal .sheet")?.scrollTo?.({ top: 0 }); },
  chipName(k, ev) {
    // Un plat : direction la Cuisine sur cette recette (ou le Marché si elle n'est pas encore apprise).
    if (RECIPES[k]) return S.recipes.includes(k) ? A.cookGo(k) : A.goRecipe(k);
    const el = ev.target.closest(".need-chip"); if (!el) return;
    document.querySelectorAll(".need-chip.show").forEach(c => c !== el && c.classList.remove("show"));
    el.classList.toggle("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200);
  },
  plantInfo(k) { openPlantInfo(k); },
  claimDaily(_, ev) {
    const o = dailyOffer(); if (!o) return closeModal();
    for (const [k, n] of Object.entries(o.seeds)) S.seeds[k] = cnt(S.seeds, k) + n;
    S.coins += o.coins;
    const run = o.run || 1;
    S.daily.last = o.day; S.daily.streak = o.streak; S.daily.run = run; S.daily.offer = null; S.stats.bestStreak = Math.max(st("bestStreak"), o.streak); S.stats.bestRun = Math.max(st("bestRun"), run);
    const { x, y } = pos(ev); closeModal(); addXp(o.xp); buzz([15, 40, 15]); SFX.play("success");
    floatText(`+${fmt(o.coins)} pièces · +${o.xp} XP`, x, y, true);
    commit();
  },
  pickCat(c) { PICK.cat = c; render(true); $("#modal .sheet")?.scrollTo?.({ top: 0 }); },
  setTestSeason(k) { try { k ? localStorage.setItem("potager-test-saison", k) : localStorage.removeItem("potager-test-saison"); } catch (e) {} applyTheme(); render(true); },
  openSettings() { modalView = viewSettings; $("#modal").innerHTML = viewSettings(); openModal(); },
  setTheme(th) { S.settings.theme = th; applyTheme(); commit(); },
  toggleSound() { S.settings.sound = !S.settings.sound; commit(); SFX.play("success"); },
  setVolume(v) { S.settings.volume = +v; SFX.play("coin"); save(); },
  async toggleNotif() {
    if (S.settings.notif) { S.settings.notif = false; return commit(); }
    const r = await NOTIF.enable();
    if (r === "granted") { S.settings.notif = true; toast("Notifications activées."); }
    else if (r === "unsupported") toast("Ton navigateur ne permet pas les notifications.");
    else toast("Notifications refusées. Tu peux les autoriser dans les réglages du navigateur.");
    commit();
  },
  toggleVibrate() { S.settings.vibrate = !S.settings.vibrate; if (S.settings.vibrate) buzz(15); commit(); },
  async checkUpdate() {
    const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
    if (!reg) { toast("Mises à jour automatiques indisponibles ici. Recharge la page."); return; }
    toast("Recherche d’une mise à jour…");
    try { await reg.update(); } catch (e) {}
    if (reg.installing || reg.waiting) toast("Nouvelle version trouvée, le jeu va redémarrer.");
    else { toast(`Tu as la dernière version (${APP_VERSION}).`); }
  },
  sel(arg) {
    const i = arg.indexOf(":"), ctx = arg.slice(0, i); UI.sel[ctx] = arg.slice(i + 1); render(true);
    const d = document.getElementById("detail-" + ctx);
    if (d) { const r = d.getBoundingClientRect(); if (r.top < 60 || r.top > innerHeight * .45) d.scrollIntoView({ behavior: "smooth", block: "start" }); }
  },
  invCat(c) { UI.invCat = c; render(true); },
  sellCat(c) { UI.sellCat = c; render(true); },
  invGo(arg) {
    if (arg.startsWith("seed:")) { msub = "seeds"; UI.sel.seeds = arg.slice(5); }
    else { msub = "sell"; UI.sellCat = PLANTS[arg] || isGold(arg) ? "crops" : WILD[arg] ? "wild" : "dishes"; UI.sel.sell = arg; }
    tab = "market"; render(true); window.scrollTo({ top: 0 });
  },
  openInv(k) {
    if (k) { UI.invCat = PLANTS[k] ? "crops" : "dishes"; UI.sel.inv = k; }
    modalView = viewInv; $("#modal").innerHTML = viewInv(); openModal();
  },
  plantFromInv(k) {
    const i = S.plots.findIndex(p => !p.seed);
    if (i < 0) { toast("Toutes les parcelles sont occupées. Récolte d’abord !"); return; }
    closeModal(); tab = "garden"; A.plant(`${i}:${k}`);
  },
  goRecipe(r) { UI.sel.recipes = r; A.goRecipes(); },
  goRecipes() { tab = "market"; msub = "recipes"; render(true); window.scrollTo({ top: 0 }); },
  cookGo(r) { tab = atelierSub = "kitchen"; UI.sel.kitchen = r; render(true); window.scrollTo({ top: 0 }); },
  dangerOpen(k) { UI.danger = k; modalView = viewDanger; render(true); setTimeout(() => $("#danger-in")?.focus(), 50); },
  dangerCancel() { UI.danger = null; modalView = viewSettings; render(true); },
  async dangerGo() {
    const k = UI.danger, d = DANGER[k], i = $("#danger-in");
    if (!d || !i || norm(i.value) !== d.word) return;
    UI.danger = null; buzz([20, 60, 20]);
    if (k === "reset") {
      const keep = { settings: S.settings, profile: S.profile }; S = Object.assign(fresh(), keep); S.orders = [genOrder(), genOrder()];
      closeModal(); commit(); toast("Nouveau jardin. Bonne pousse !");
      if (typeof CLOUD !== "undefined" && CLOUD.signedIn) { try { await CLOUD.push(); } catch (e) {} } // la sauvegarde en ligne suit tout de suite
    } else {
      closeModal();
      try { await CLOUD.deleteAccount(); toast("Compte en ligne supprimé."); showGate(); } catch (e) { toast("Suppression impossible pour le moment."); }
    }
  },

};
function harvest(i, x, y) {
  const p = S.plots[i], d = PLANTS[p.seed];
  const k = d.tuto ? d.img : p.seed; // le radis éclair donne un vrai radis
  if (d.tuto) tutoFlag("eclair");
  const gold = !d.tuto && Math.random() < GOLD_CHANCE, firstGold = gold && !S.goldenFound.includes(k);
  const n = !gold && Math.random() < .08 ? 2 : 1;
  if (gold) {
    const gk = "gold_" + k; S.golden[gk] = cnt(S.golden, gk) + 1;
    if (!S.goldenFound.includes(k)) S.goldenFound.push(k);
    S.stats.golden = st("golden") + 1;
  } else S.crops[k] = cnt(S.crops, k) + n;
  S.stats.harvest++;
  questProgress("harvestK", n, k);
  if (n > 1) S.stats.doubles = st("doubles") + 1;
  if (!p.wasDry) S.stats.neverDry = st("neverDry") + 1;
  const hr = new Date().getHours(); if (hr < 8) S.stats.early = 1; if (hr >= 22) S.stats.night = 1;
  if (p.ripeAt && now() - p.ripeAt > 24 * 3600000) S.stats.patience = 1;
  if (d.only && d.season !== season()) S.stats.offSeason = 1; // plante de saison récoltée hors de sa saison
  if (!S.discovered.includes(k)) S.discovered.push(k);
  addXp(d.xp);
  Object.assign(p, { seed: null, grown: 0, weed: false, lastSeed: k, wasDry: false, ripeAt: 0 });
  if (gold) { buzz([20, 60, 20, 60, 20, 60, 50]); SFX.play("discover"); doubleBurst(i, k, true); setTimeout(() => showGoldPop(k, firstGold), 450); return; }
  buzz(n > 1 ? [15, 50, 15, 50, 30] : 12); SFX.play(n > 1 ? "double" : "harvest");
  if (n > 1) doubleBurst(i, k);
  else if (x != null) floatText(`+1 ${d.name} · +${d.xp} XP`, x, y);
}
/* Saison : fiche (bouton en haut du jardin) et annonce au changement de saison. */
function viewSeason(arrived) {
  const s = season(), z = SEASONS[s], nx = nextSeason(s);
  const plants = ORDER.filter(k => PLANTS[k].season === s);
  return `<div class="sheet season-sheet sz-bg-${s}" role="dialog" aria-modal="true" aria-label="${z.name}">
    <div class="ss-head">${seasonIcon(s, "big")}<div><h2>${arrived ? z.arrive : z.name}</h2><span class="muted small">Encore ${seasonDaysLeft()} jour${seasonDaysLeft() > 1 ? "s" : ""}, puis ${SEASONS[nx].name.toLowerCase()}</span></div></div>
    <p class="ss-intro">${z.intro}</p>
    <p class="small muted" style="margin:0">Les graines de saison ne sont vendues que cette semaine : garde-en quelques-unes, les voisins en redemanderont hors saison !</p>
    <h3 class="cat-title">Plantes de saison <span class="muted small">poussent 25 % plus vite</span></h3>
    <div class="ss-plants">${plants.map(k => { const ok = seedAvailable(k) || S.discovered.includes(k); return `<span class="chip${ok ? "" : " locked"}">${cropArt(k)}${ok ? PLANTS[k].name : `Niv. ${PLANTS[k].lvl}`}</span>`; }).join("")}</div>
    <div class="ss-facts">
      <div><span class="ss-ico">${visitorArt(z.visitor.key)}</span><span>Visiteur : <b>${z.visitor.name}</b></span></div>
      <div><span class="ss-ico">${pestIcon(z.pest.key)}</span><span>Bloque les bacs : <b>${z.pest.name}</b></span></div>
    </div>
    ${arrived ? `<button class="btn big" data-act="close">C’est parti !</button>` : SHEET_X}</div>`;
}
function showSeason() {
  if (S.season === season()) return;
  if (!$("#modal").hidden || LEVEL_QUEUE.length || tutoBasicsPending()) return;
  S.season = season(); save();
  modalView = () => viewSeason(true); $("#modal").innerHTML = modalView(); openModal(); SFX.play("success");
}
/* Récolte dorée : petite fenêtre au centre de l'écran, avec halo tournant et étincelles.
   Elle se ferme d'un toucher, ou toute seule au bout de quelques secondes. */
// « Première trouvaille » : jamais trouvée avant (et pas seulement absente du stock, qu’on a pu vendre).
function showGoldPop(k, first) {
  document.querySelector(".goldpop")?.remove();
  const d = PLANTS[k];
  const el = document.createElement("div"); el.className = "goldpop"; el.setAttribute("role", "status");
  el.innerHTML = `<div class="gp-card">
    <div class="gp-stage"><div class="gp-rays"></div>${Array.from({ length: 8 }, (_, j) => `<i class="gp-spark" style="--a:${j * 45}deg;--d:${(j % 3) * .25}s"></i>`).join("")}<div class="gp-art">${goldArt(k)}</div></div>
    <b class="gp-title">Récolte dorée !</b>
    <span class="gp-name">${d.name} d’or${first ? " · première trouvaille" : ""}</span>
    <span class="gp-val">Vaut ${coin}${fmt(d.sell * 10)}</span>
  </div>`;
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
  el.addEventListener("click", close); setTimeout(close, 4200);
  document.body.appendChild(el);
}
/* Récolte double : « ×2 » doré, deux récoltes qui jaillissent et des étincelles au-dessus du bac. */
function doubleBurst(i, k, gold) {
  const el = document.querySelector(`[data-plot="${i}"]`); if (!el) return;
  const r = el.getBoundingClientRect();
  const b = document.createElement("div");
  b.className = "double-burst" + (gold ? " gold" : "");
  b.style.left = r.left + r.width / 2 + "px"; b.style.top = r.top + r.height * .45 + "px";
  b.innerHTML = gold ? `<span class="db-x2">Or !</span><span class="db-crop a solo">${goldArt(k)}</span>` + Array.from({ length: 12 }, (_, j) => `<i class="db-spark" style="--a:${j * 30}deg"></i>`).join("") : `<span class="db-x2">×2</span><span class="db-crop a">${cropArt(k)}</span><span class="db-crop b">${cropArt(k)}</span>` +
    Array.from({ length: 8 }, (_, j) => `<i class="db-spark" style="--a:${j * 45}deg"></i>`).join("");
  $("#fx").appendChild(b); setTimeout(() => b.remove(), 1700);
}
function pos(ev) {
  if (ev && ev.clientX) return { x: ev.clientX, y: ev.clientY };
  const r = ev && ev.target && ev.target.getBoundingClientRect ? ev.target.getBoundingClientRect() : null;
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
}
function commit() { save(); render(true); }
function buzz(p) { if (!S.settings.vibrate) return; try { navigator.vibrate?.(p); } catch (e) {} }

/* ---------------- Paramètres ---------------- */
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const th = S.settings.theme;
  document.documentElement.dataset.theme = th;
  document.documentElement.dataset.season = season(); // couleurs de l’interface selon la saison
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  document.getElementById("theme-color")?.setAttribute("content", bg || "#fdf3e7");
}
darkQuery.addEventListener?.("change", () => S && applyTheme());
const CHEVRON = `<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_RESET = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function savedAgo() {
  const s = Math.round((now() - (lastSaveAt || S.last || now())) / 1000);
  return s < 10 ? "à l’instant" : s < 60 ? `il y a ${s} s` : `il y a ${Math.round(s / 60)} min`;
}
/* Téléphone ou tablette : écran tactile comme pointeur principal (pas de souris). */
const isPhone = () => matchMedia("(pointer: coarse)").matches;
function viewSettings() {
  const th = S.settings.theme;
  return `<div class="sheet tall" role="dialog" aria-modal="true" aria-label="Paramètres">
    <div class="sheet-head"><h2>Paramètres</h2>${SHEET_X}</div>
    ${installPrompt ? `<div class="install"><p>Installe le jeu sur ton téléphone pour y jouer comme une vraie appli.</p><button class="btn sm" data-act="install">Installer</button></div>` : ""}
    <div class="set-group"><h3>Apparence</h3>
      <div class="seg">${[["light", "Clair"], ["dark", "Sombre"], ["system", "Auto"]].map(([k, l]) => `<button data-act="setTheme" data-arg="${k}" aria-pressed="${th === k}">${l}</button>`).join("")}</div>
    </div>
    ${IS_TEST ? `<div class="set-group"><h3>Version de test</h3>
      <div class="set-row"><span>Fenêtre « Du nouveau » et conseils de la v3</span><button class="btn ghost sm" data-act="news3Replay">Revoir</button></div>
      <span class="small muted">Saison</span>
      <div class="seg seg5 test-season">${[["", "Auto"], ...SEASON_ORDER.map(k => [k, SEASONS[k].name])].map(([k, l]) => `<button data-act="setTestSeason" data-arg="${k}" aria-pressed="${(testSeason() || "") === k}">${l}</button>`).join("")}</div></div>` : ""}
    <div class="set-group"><h3>Confort</h3>
      <div class="set-row"><span>Sons</span><button class="switch" role="switch" data-act="toggleSound" aria-checked="${S.settings.sound}" aria-label="Sons"></button></div>
      ${S.settings.sound ? `<div class="set-row"><span>Volume</span><input type="range" id="vol" min="0" max="1" step="0.05" value="${S.settings.volume ?? .6}" data-input="setVolume" aria-label="Volume"></div>` : ""}
      <div class="set-row"><span>Vibrations à la récolte</span><button class="switch" role="switch" data-act="toggleVibrate" aria-checked="${S.settings.vibrate}" aria-label="Vibrations"></button></div>
      <div class="set-row"><span>Notifications<small class="set-sub">Plantes prêtes ou assoiffées, plats et croisements terminés${FRIENDS_ON ? ", messages, échanges reçus et jardin commun" : ""}</small></span><button class="switch" role="switch" data-act="toggleNotif" aria-checked="${!!S.settings.notif}" aria-label="Notifications"></button></div>
      ${S.settings.notif ? `<p class="small muted" style="margin:0">Elles arrivent tant que le jeu tourne en arrière-plan. Si ton téléphone ferme complètement l’appli, elles s’arrêtent jusqu’à la prochaine ouverture.</p>` : ""}
      <div class="set-row"><span>Conseils de Mamie Lapine</span><button class="btn ghost sm" data-act="tutoReset">Revoir</button></div>
    </div>
    <div class="set-group danger"><h3>Zone sensible</h3>
      <button class="set-link" data-act="dangerOpen" data-arg="reset">${ICON_RESET}<span><b>Recommencer à zéro</b><small>Efface ta progression, ton compte est gardé</small></span></button>
      ${typeof cloudDangerHTML === "function" ? cloudDangerHTML() : ""}
    </div>
    <div class="set-group"><h3>À propos</h3>
      <button class="btn ghost" data-act="checkUpdate">Vérifier les mises à jour</button>
      <p class="version">Potager idle · version ${APP_VERSION}</p>
    </div>
  </div>`;
}

/* Confirmation des actions définitives : ce qui part, ce qui reste, et un mot à écrire. */
const norm = v => v.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const DANGER = {
  reset: { title: "Recommencer à zéro", word: "RECOMMENCER", btn: "Tout recommencer",
    lost: () => ["Ton niveau, ton XP et tes pièces", "Tes bacs, graines, récoltes et plats", "Tes hybrides, recettes, décorations et améliorations", "Tes succès et tes titres"],
    kept: () => ["Ton profil : pseudo, photo et bannière", "Tes réglages", ...(typeof CLOUD !== "undefined" && CLOUD.signedIn ? [FRIENDS_ON ? "Ton compte Discord, tes amis et tes messages" : "Ton compte Discord"] : [])],
    note: "Ta sauvegarde en ligne est remplacée par la nouvelle partie." },
  account: { title: "Supprimer mon compte", word: "SUPPRIMER", btn: "Supprimer mon compte",
    lost: () => FRIENDS_ON ? ["Ta sauvegarde en ligne", "Ton profil visible par tes amis et ton code ami", "Tes amis, tes demandes et tes messages", "Les joueurs que tu as bloqués"] : ["Ta sauvegarde en ligne", "Ton lien avec ton compte Discord"],
    kept: () => ["La partie sur cet appareil"],
    note: "Tu devras te reconnecter avec Discord pour continuer à jouer : un nouveau compte sera créé avec ta partie." },
};
function viewDanger() {
  const d = DANGER[UI.danger]; if (!d) return viewSettings();
  return `<div class="sheet danger-sheet" role="dialog" aria-modal="true" aria-label="${d.title}">
    <div class="sheet-head"><h2>${d.title}</h2><button class="btn ghost sm" data-act="dangerCancel">Annuler</button></div>
    <div class="dz-cols">
      <div class="dz-box lost"><h3>Supprimé</h3><ul>${d.lost().map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div class="dz-box kept"><h3>Gardé</h3><ul>${d.kept().map(x => `<li>${x}</li>`).join("")}</ul></div>
    </div>
    <p class="small muted" style="margin:0">${d.note} <b>C’est définitif.</b></p>
    <label class="dz-field"><span>Pour confirmer, écris <b>${d.word}</b></span>
      <input id="danger-in" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" placeholder="${d.word}"></label>
    <button class="btn danger dz-go" data-act="dangerGo"${norm($("#danger-in")?.value || "") === d.word ? "" : " disabled"}>${d.btn}</button>
  </div>`;
}
document.addEventListener("input", ev => {
  if (ev.target.id !== "danger-in") return;
  const b = document.querySelector(".dz-go"), d = DANGER[UI.danger]; if (b && d) b.disabled = norm(ev.target.value) !== d.word;
});
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.id === "danger-in") A.dangerGo(); });

/* ---------------- Views ---------------- */
function views_garden() {
  const t = now();
  const ripe = S.plots.filter(p => plotState(p, t) === "ripe").length;
  const thirsty = S.plots.filter(p => plotState(p, t) === "dry").length;
  const snails = S.plots.filter(p => plotState(p, t) === "weed").length;
  const decoKeys = DECO_ORDER.filter(decoUnlocked), goldKeys = ORDER.map(k => "gold_" + k).filter(k => cnt(S.golden, k) > 0), cropKeys = ORDER.filter(k => cnt(S.crops, k) > 0), wildKeys = WORDER.filter(k => cnt(S.wild, k) > 0), dishKeys = RORDER.filter(r => cnt(S.dishes, r) > 0), seedKeys = ORDER.filter(k => cnt(S.seeds, k) > 0);
  // Inventaire de l’accueil : par ordre alphabétique.
  const abc = (a, b) => byName(a, b, itemName); goldKeys.sort(abc); cropKeys.sort(abc); wildKeys.sort(abc); dishKeys.sort(abc); seedKeys.sort(abc);
  // Toucher un objet mène au marché : graines vers l'achat, récoltes et plats vers la vente.
  const miniTiles = keys => `<div class="tiles mini">${keys.map(k => tile(itemArt(k), { act: "invGo", arg: k, label: itemName(k), count: cnt(itemBag(k), k), badge: PLANTS[k] ? seasonBadge(k) : "" })).join("")}</div>`;
  const seedTiles = keys => `<div class="tiles mini">${keys.map(k => tile(seedArt(k), { act: "invGo", arg: "seed:" + k, label: `Graines de ${PLANTS[k].name.toLowerCase()}`, count: cnt(S.seeds, k), badge: seasonBadge(k) })).join("")}</div>`;
  return `${installPrompt && isPhone() && !S.settings.hideInstall ? `<div class="install"><p>Installe Potager idle sur ton téléphone pour y jouer comme une vraie appli, même hors-ligne.</p><button class="btn sm" data-act="install">Installer</button><button class="install-x" data-act="hideInstall" aria-label="Ne plus proposer">✕</button></div>` : ""}
  <section class="panel">
    <div class="garden-tools">
      ${S.upg.basket ? `<button class="btn" data-act="harvestAll" ${ripe ? "" : "disabled"}>Tout récolter${ripe ? ` (${ripe})` : ""}</button>` : ""}
      ${S.upg.gloves ? `<button class="btn danger" data-act="snailsAll" ${snails ? "" : "disabled"}>${PEST().remove}${snails ? ` (${snails})` : ""}</button>` : ""}
      ${S.upg.hose && !S.upg.auto ? `<button class="btn water" data-act="waterAll">Tout arroser${thirsty ? ` (${thirsty})` : ""}</button>` : ""}
    </div>
    <button class="season-bar sz-bg-${season()}" data-act="openSeason">${seasonIcon(season())}<b>${SEASONS[season()].name}</b><span class="muted">· encore ${seasonDaysLeft()} jour${seasonDaysLeft() > 1 ? "s" : ""}</span><span class="sb-more">Plantes de saison +25 %</span></button>
    <div class="garden-bar"><p class="garden-hint">${S.upg.auto ? "Arroseur automatique actif" : `L’eau tient ${UPG.water.values[S.upg.water]} min`}${S.upg.fert ? ` · <span style="white-space:nowrap">Compost : +${Math.round((speed() - 1) * 100)} %</span>` : ""}</p>${fwLineHTML(t)}</div>
    <div class="garden-zone"><button class="deco-edit${UI.editDeco ? " on" : ""}" data-act="toggleDecoEdit" aria-label="${UI.editDeco ? "Terminer" : "Décorer le jardin"}">${UI.editDeco ? "✓ Terminé" : PENCIL + " Décorer"}</button>
    <div class="garden${UI.editDeco ? " editing" : ""}${UI.editDeco || S.decoSlots.some(Boolean) ? " decorated" : ""}" data-season="${season()}">${seasonFxHTML(season())}
      <div class="plots">
      ${S.plots.map((p, i) => `<button class="plot" data-act="plot" data-arg="${i}" data-plot="${i}"></button>`).join("")}
    </div>${decoRowHTML()}${mailboxHTML()}${sgPortalHTML()}</div></div>
  </section>
  ${dailyQuests().bonus ? "" : questsHTML()}
  ${weeklyHTML()}
  <section class="panel">
    <h2>Inventaire</h2>
    ${cropKeys.length || wildKeys.length || dishKeys.length || seedKeys.length || goldKeys.length || decoKeys.length ? `${goldKeys.length ? `<h3 class="cat-title">Récoltes dorées</h3>${miniTiles(goldKeys)}` : ""}${seedKeys.length ? `<h3 class="cat-title">Graines</h3>${seedTiles(seedKeys)}` : ""}${cropKeys.length ? `<h3 class="cat-title">Ingrédients</h3>${miniTiles(cropKeys)}` : ""}${wildKeys.length ? `<h3 class="cat-title">Trouvailles de balade</h3>${miniTiles(wildKeys)}` : ""}${dishKeys.length ? `<h3 class="cat-title">Plats</h3>${miniTiles(dishKeys)}` : ""}${decoKeys.length ? `<h3 class="cat-title">Décorations</h3><div class="tiles mini">${decoKeys.map(d => tile(imgSvg(`assets/img/decos/deco-${d}.webp`), { act: "decoSlots", arg: d, label: DECOS[d], check: S.decoSlots.includes(d) })).join("")}</div>` : ""}` : `<p class="muted small" style="margin:0">Ton inventaire est vide. Récolte tes premiers radis !</p>`}
  </section>
  ${dailyQuests().bonus ? questsHTML() : ""}
`;
}
/* Notifications : on prévient quand quelque chose change pendant que le jeu est en arrière-plan. */
let notifPrev = null;
function watchNotifs(t) {
  const snap = {
    ripe: S.plots.filter(p => plotState(p, t) === "ripe").length,
    dry: S.plots.filter(p => plotState(p, t) === "dry").length,
    weed: S.plots.filter(p => plotState(p, t) === "weed").length,
    cook: S.cooking.filter(c => c.end <= t).length,
    lab: S.lab && S.lab.end <= t ? 1 : 0,
  };
  const p = notifPrev; notifPrev = snap;
  if (!p || !document.hidden) return;
  if (snap.ripe > p.ripe) NOTIF.show("ripe", "Récolte prête !", snap.ripe > 1 ? `${snap.ripe} plantes t’attendent au potager.` : "Une plante t’attend au potager.");
  if (snap.dry > p.dry) NOTIF.show("dry", "Tes plantes ont soif", snap.dry > 1 ? `${snap.dry} bacs à arroser.` : "Un bac à arroser.");
  if (snap.weed > p.weed) NOTIF.show("weed", ...PEST().notif);
  if (snap.cook > p.cook) NOTIF.show("cook", "C’est prêt !", "Un plat t’attend en cuisine.");
  if (snap.lab > p.lab) NOTIF.show("lab", "Croisement terminé", "Viens voir ce qui a poussé dans la serre…");
}
/* ---------------- Décorations du jardin : 3 emplacements fixes ---------------- */
const PENCIL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z" fill="currentColor"/><path d="M14.5 6.5l3 3" stroke="var(--panel)" stroke-width="1.4"/></svg>`;
/* Décalage d'une déco dans son emplacement : pas de 10 % de sa taille, ±5 pas. */
const DECO_STEP = 10, DECO_MAX = 5, DECO_SMAX = 3, DECO_SSTEP = .12;
const decoOff = i => ({ x: 0, y: 0, s: 0, ...((S.decoOff || [])[i] || {}) });
const decoStyle = (d, i) => { const o = decoOff(i); return `--ds:${((DECO_SCALE[d] || 1) * (1 + o.s * DECO_SSTEP)).toFixed(3)};--fx:${(S.decoFlip || [])[i] ? -1 : 1};--ox:${o.x * DECO_STEP}%;--oy:${o.y * DECO_STEP}%`; };
function decoRowHTML() {
  const slots = S.decoSlots || [null, null, null];
  if (!UI.editDeco && slots.every(d => !d)) return "";
  return `<div class="deco-row">${slots.map((d, i) => d
    ? `<button class="deco-slot full s${i}" data-act="decoPick" data-arg="${i}" aria-label="${DECOS[d]}" style="${decoStyle(d, i)}"><img src="assets/img/decos/deco-${d}.webp" alt=""></button>`
    : `<button class="deco-slot empty s${i}" data-act="decoPick" data-arg="${i}" aria-label="Emplacement libre"${UI.editDeco ? "" : " hidden"}><span>+</span></button>`).join("")}</div>`;
}
function decoRefresh(i) {
  const d = S.decoSlots[i], g = document.querySelector(`.garden .deco-slot.s${i}`);
  if (g && d) g.setAttribute("style", decoStyle(d, i));
  const a = document.querySelector("#modal .deco-adjust"); if (a) a.outerHTML = decoAdjustHTML(i);
}
// Aperçu + flèches + taille, mis à jour sur place (sans redessiner la fenêtre).
function decoAdjustHTML(slot) {
  const cur = S.decoSlots[slot], o = decoOff(slot);
  return `<div class="deco-adjust"><div class="deco-prev"><span class="deco-slot full" style="${decoStyle(cur, slot)}"><img src="assets/img/decos/deco-${cur}.webp" alt=""></span></div><div class="dpad"><button class="dp up" data-act="decoNudge" data-arg="${slot}:up" aria-label="Monter" ${o.y <= -DECO_MAX ? "disabled" : ""}><svg viewBox="0 0 24 24" style="transform:rotate(0deg)"><path d="M12 6l-7 9h14z" fill="currentColor"/></svg></button><button class="dp left" data-act="decoNudge" data-arg="${slot}:left" aria-label="Vers la gauche" ${o.x <= -DECO_MAX ? "disabled" : ""}><svg viewBox="0 0 24 24" style="transform:rotate(-90deg)"><path d="M12 6l-7 9h14z" fill="currentColor"/></svg></button><button class="dp mid" data-act="decoNudge" data-arg="${slot}:reset" aria-label="Réinitialiser" ${o.x || o.y || o.s ? "" : "disabled"}>⟲</button><button class="dp right" data-act="decoNudge" data-arg="${slot}:right" aria-label="Vers la droite" ${o.x >= DECO_MAX ? "disabled" : ""}><svg viewBox="0 0 24 24" style="transform:rotate(90deg)"><path d="M12 6l-7 9h14z" fill="currentColor"/></svg></button><button class="dp down" data-act="decoNudge" data-arg="${slot}:down" aria-label="Descendre" ${o.y >= DECO_MAX ? "disabled" : ""}><svg viewBox="0 0 24 24" style="transform:rotate(180deg)"><path d="M12 6l-7 9h14z" fill="currentColor"/></svg></button><button class="dp flip${(S.decoFlip || [])[slot] ? " on" : ""}" data-act="decoFlip" data-arg="${slot}" aria-label="Retourner l’image" title="Retourner l’image"><svg viewBox="0 0 24 24"><path d="M11 4v16L3 17z" fill="currentColor"/><path d="M13 4v16l8-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div><div class="dsize"><button class="dp" data-act="decoNudge" data-arg="${slot}:bigger" aria-label="Plus grande" ${o.s >= DECO_SMAX ? "disabled" : ""}>+</button><small>Taille</small><button class="dp" data-act="decoNudge" data-arg="${slot}:smaller" aria-label="Plus petite" ${o.s <= -DECO_SMAX ? "disabled" : ""}>−</button></div></div>`;
}
// Choisir la décoration d'un emplacement.
function viewDecoPick(slot) {
  const cur = S.decoSlots[slot];
  return `<div class="sheet deco-sheet" role="dialog" aria-modal="true" aria-label="Décorations" data-deco-sheet>
    <div class="sheet-head"><h2>Emplacement ${slot + 1}</h2>${SHEET_X}</div>
    ${cur ? decoAdjustHTML(slot) : ""}
    <p class="small muted" style="margin:0;max-width:none;justify-self:stretch">Choisis une décoration. Elle remplace celle déjà en place.</p>
    <div class="deco-grid compact">${[...DECO_ORDER].sort((a, b) => decoUnlocked(b) - decoUnlocked(a)).map(d => { const ok = decoUnlocked(d), src = decoSource(d);
      return `<button class="deco-card${ok ? "" : " locked"}${cur === d ? " sel" : ""}" ${ok ? `data-act="decoPlace" data-arg="${slot}:${d}:keep"` : "disabled"}>
        <img src="assets/img/decos/deco-${d}.webp" alt=""><b>${ok ? DECOS[d] : "???"}</b><span>${ok ? (S.decoSlots.includes(d) && cur !== d ? "Déjà placée" : "") : src ? `Succès « ${src.ach.name}${src.ach.tiers.length > 1 ? " " + ROMAN[src.i + 1] : ""} »` : GOAL_DECO_SRC(d)}</span></button>`; }).join("")}</div>
    ${cur ? `<div class="d-acts"><button class="btn ghost" data-act="decoPlace" data-arg="${slot}:">Retirer</button></div>` : ""}
  </div>`;
}
// Choisir l'emplacement d'une décoration (depuis l'inventaire).
function viewDecoSlots(d) {
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="${DECOS[d]}">
    <div class="sheet-head"><h2>${DECOS[d]}</h2>${SHEET_X}</div>
    <p class="small muted" style="margin:0">Où la placer dans le jardin ?</p>
    <div class="deco-slots-pick">${S.decoSlots.map((c, i) => `<button class="deco-slot ${c ? "full" : "empty"}${c === d ? " sel" : ""}" data-act="decoPlace" data-arg="${i}:${d}">${c ? `<img src="assets/img/decos/deco-${c}.webp" alt="">` : "<span>+</span>"}<small>Emplacement ${i + 1}</small></button>`).join("")}</div>
  </div>`;
}
function ringValues(p, st, t) {
  const grow = Math.min(1, p.grown / (PLANTS[p.seed].time * 1000));
  const water = st === "ripe" || S.upg.auto ? 1 : Math.max(0, Math.min(1, (p.waterUntil - t) / waterMs()));
  return { g: (100 - grow * 100).toFixed(1), w: (100 - water * 100).toFixed(1) };
}
/* Une seule pastille par parcelle : le légume au centre, l'anneau vert = pousse, l'anneau bleu = eau. */
function plotHTML(p, i, t) {
  const st = plotState(p, t);
  if (st === "empty") return `<span><b>+</b>Planter</span>`;
  const d = PLANTS[p.seed];
  let inner = plantArt(p.seed, plotStage(p), true);
  if (st === "dry") inner += `<span class="thirst">${DROP}</span>`; // goutte : la plante a soif
  if (st === "weed") inner += `${pestArt(PEST().key)}<span class="thirst pest-alert"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="#e2473b" stroke-width="2.6" stroke-linecap="round"/></svg></span>`; // escargot + bulle à croix rouge
  if (st === "ripe") return inner + `<span class="thirst ready">${STAR}</span>`; // étoile : prête à récolter (pas de jauges)
  const r = ringValues(p, st, t); // valeurs posées dès la création, sans animation depuis zéro
  inner += `<span class="ring"><svg viewBox="0 0 40 40" aria-hidden="true">
      <circle class="ring-bg" cx="20" cy="20" r="18"/><circle class="ring-water" cx="20" cy="20" r="18" pathLength="100" data-rw="${i}" style="stroke-dashoffset:${r.w}"/>
      <circle class="ring-bg" cx="20" cy="20" r="14"/><circle class="ring-grow" cx="20" cy="20" r="14" pathLength="100" data-rg="${i}" style="stroke-dashoffset:${r.g}"/>
    </svg><span class="ring-ico">${cropArt(p.seed)}</span></span>`;
  return inner;
}
function plotLabel(p, t) {
  const st = plotState(p, t); if (st === "empty") return "Parcelle vide : planter";
  const n = PLANTS[p.seed].name;
  return { ripe: `${n} prêt à récolter`, dry: `${n} a soif : arroser`, weed: `${n} envahi : désherber`, growing: `${n} en train de pousser : arroser` }[st];
}
/* Temps restant avant maturité : pleine vitesse tant que l'eau tient, puis au ralenti (DRY_RATE). */
function plotEta(p, t) {
  const sp = growSpeed(p.seed), left = PLANTS[p.seed].time * 1000 - p.grown;
  if (left <= 0) return 0;
  const wet = S.upg.auto ? Infinity : Math.max(0, p.waterUntil - t);
  return left <= wet * sp ? left / sp : wet + (left - wet * sp) / (sp * DRY_RATE);
}
// Bulle au survol d'un bac (ordinateur) : temps restant, mis à jour chaque seconde.
let tipPlot = -1;
function plotTipText(p, t) {
  if (!p.seed) return "Bac vide : touche pour planter";
  const d = PLANTS[p.seed], st = plotState(p, t);
  if (st === "ripe") return `<b>${d.name}</b> · prêt à récolter`;
  if (st === "weed") return `<b>${d.name}</b> · bloqué, touche pour libérer`;
  return `<b>${d.name}</b> · prêt dans ${dur(plotEta(p, t))}${st === "dry" ? `<br><span class="tip-dry">Terre sèche : pousse au ralenti</span>` : ""}`;
}
function updatePlotTip(t) {
  const tip = document.getElementById("plot-tip"), el = tipPlot >= 0 && document.querySelector(`[data-plot="${tipPlot}"]`);
  if (!tip) return;
  if (!el || tab !== "garden" || !S.plots[tipPlot]) { tip.hidden = true; return; }
  tip.innerHTML = plotTipText(S.plots[tipPlot], t); tip.hidden = false;
  const r = el.getBoundingClientRect();
  tip.style.left = (r.left + r.width / 2) + "px"; tip.style.top = (r.top - 6) + "px";
}
if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.addEventListener("mouseover", ev => { const el = ev.target.closest?.("[data-plot]"); const i = el ? +el.dataset.plot : -1; if (i !== tipPlot) { tipPlot = i; updatePlotTip(now()); } });
  addEventListener("scroll", () => updatePlotTip(now()), { passive: true });
}
function updateGarden(t) {
  document.querySelectorAll("[data-plot]").forEach(el => {
    const i = +el.dataset.plot, p = S.plots[i]; if (!p) return;
    const st = plotState(p, t);
    const sig = st + (p.seed || "") + (p.seed ? plotStage(p) : "");
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig; el.className = "plot " + st; el.innerHTML = plotHTML(p, i, t);
      el.setAttribute("aria-label", plotLabel(p, t));
    }
    if (p.seed) {
      const need = PLANTS[p.seed].time * 1000;
      const r = ringValues(p, st, t);
      const rg = el.querySelector("[data-rg]"); if (rg) rg.style.strokeDashoffset = r.g;
      const rw = el.querySelector("[data-rw]"); if (rw) rw.style.strokeDashoffset = r.w;
    }
  });
}

/* ---------------- Composants : cases, fiche détaillée, ingrédients ---------------- */
const UI = { sel: {}, invCat: "crops", sellCat: "crops" };
const CHECK = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" style="fill:var(--leaf)"/><path d="M4.5 8.2l2.3 2.3 4.7-4.8" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LOCK = `<svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="7" rx="1.6" fill="#8a9a80"/><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="#8a9a80" stroke-width="1.6" fill="none"/></svg>`;
const priceTag = n => `${coin}<span class="num">${fmt(n)}</span>`;
const canCook = r => Object.entries(RECIPES[r].need).every(([k, q]) => cnt(itemBag(k), k) >= q);
const mystery = k => `<div class="sil">${plantArt(k, 3)}</div>`;

function tile(art, o) {
  return `<div class="tile-wrap"><button class="tile${o.sel ? " sel" : ""}${o.locked ? " locked" : ""}" data-act="${o.act}" data-arg="${o.arg || ""}" aria-pressed="${!!o.sel}" aria-label="${o.label}">${art}${o.badge || ""}` +
    (o.count ? `<span class="cnt num">${fmt(o.count)}</span>` : "") +
    (o.want ? `<span class="dot want${o.dot ? " beside" : ""}" title="Demandé par un voisin"></span>` : "") +
    (o.check ? `<span class="tb">${CHECK}</span>` : o.locked ? `<span class="tb">${LOCK}</span>` : o.dot ? `<span class="dot"></span>` : "") +
    `</button>${o.under != null ? `<span class="under">${o.under}</span>` : ""}</div>`;
}
const emptyTiles = n => Array.from({ length: Math.max(0, n) }, () => `<div class="tile-wrap"><div class="tile empty"></div></div>`).join("");
function detail(ctx, art, title, desc, meta, body = "", actions = "") {
  return `<div class="detail" id="detail-${ctx}"><div class="d-head"><div class="d-art">${art}</div><div class="d-txt"><h3>${title}</h3><p>${desc}</p></div></div>` +
    (meta ? `<div class="meta">${meta}</div>` : "") + body + (actions ? `<div class="d-acts">${actions}</div>` : "") + `</div>`;
}
const mi = (label, val) => `<span class="mi"><small>${label}</small><b class="num">${val}</b></span>`;
function ingList(need) {
  return `<div class="ings"><h4>Ingrédients</h4>${Object.entries(need).map(([k, q]) => {
    if (WILD[k]) { const h = cnt(S.wild, k); return `<div class="ing ${h >= q ? "ok" : "miss"}">${wildArt(k)}<span>${WILD[k].name} <small class="muted">· Balades</small></span><b class="num">${h}/${q}</b></div>`; }
    const h = cnt(S.crops, k), known = !PLANTS[k].hybrid || S.hybrids.includes(k);
    return `<div class="ing ${h >= q ? "ok" : "miss"}">${known ? cropArt(k) : mystery(k)}<span>${known ? PLANTS[k].name : "Hybride à découvrir"}</span><b class="num">${h}/${q}</b></div>`;
  }).join("")}</div>`;
}

/* ---------------- Inventaire (récoltes, graines, plats) ---------------- */
const CATS = [["crops", "Récoltes"], ["wild", "Balades"], ["seeds", "Graines"], ["dishes", "Plats"]];
const catBag = c => c === "seeds" ? S.seeds : c === "dishes" ? S.dishes : c === "wild" ? S.wild : S.crops;
const catCount = c => Object.values(catBag(c)).reduce((a, b) => a + b, 0);
function catTabs(cats, cur, act) {
  return `<div class="subtabs" style="grid-template-columns:repeat(${cats.length},1fr)">${cats.map(([c, l]) => `<button data-act="${act}" data-arg="${c}" aria-pressed="${cur === c}">${l} <span class="num">${catCount(c)}</span></button>`).join("")}</div>`;
}
/* Tri des listes (Cuisine, Vente) : gardé dans les réglages. */
const byName = (a, b, n) => n(a).localeCompare(n(b), "fr", { sensitivity: "base" });
function sortBar(ctx, opts) {
  const cur = (S.settings.sort || {})[ctx] || "none";
  return `<div class="sortbar"><span>Trier</span>${opts.map(([k, l]) => `<button class="chip sort-chip" data-act="setSort" data-arg="${ctx}:${k}" aria-pressed="${cur === k}">${l}</button>`).join("")}</div>`;
}
const sortOf = ctx => (S.settings.sort || {})[ctx] || "none"; // "none" = ordre de base
function invBody(ctx, cat) {
  const bag = catBag(cat);
  const keys = (cat === "dishes" ? RORDER : cat === "wild" ? WORDER : ORDER).filter(k => cnt(bag, k) > 0).concat(cat === "crops" ? ORDER.map(k => "gold_" + k).filter(k => cnt(S.golden, k) > 0) : []);
  if (ctx === "sell") { const m = sortOf("sell"); if (m !== "none") keys.sort(m === "name" ? (a, b) => byName(a, b, itemName) : m === "total" ? (a, b) => cnt(itemBag(b), b) * itemVal(b) - cnt(itemBag(a), a) * itemVal(a) : (a, b) => itemVal(b) - itemVal(a)); }
  if (ctx === "sell") keys.sort((a, b) => isGold(b) - isGold(a)); // à la vente, les dorées d’abord (elles ne servent qu’à ça)
  let k = UI.sel[ctx]; if (!keys.includes(k)) k = keys[0];
  let det;
  if (!k) {
    det = `<div class="detail empty-note">${cat === "dishes" ? dishArt("soupe") : plantArt("radis", 2)}<span>${{ crops: "Aucune récolte pour l’instant. Va faire un tour au jardin !", wild: "Rien de la balade pour l’instant. Pêche, promène-toi ou aide les abeilles dans l’onglet Balades !", seeds: "Aucune graine en stock. Le marché en vend.", dishes: "Aucun plat pour l’instant. Ce que tu cuisines arrive ici." }[cat]}</span></div>`;
  } else if (cat === "seeds") {
    const d = PLANTS[k];
    det = detail(ctx, seedArt(k), `Graines de ${d.name.toLowerCase()}`, d.desc, mi("En stock", cnt(bag, k)) + mi("Pousse", growDur(d.time * 1000 / plantSpeed(k))) + mi("Vente", fmt(d.sell)),
      "", `<button class="btn big" data-act="plantFromInv" data-arg="${k}">Planter au jardin</button>`);
  } else {
    const n = cnt(itemBag(k), k), v = itemVal(k);
    const uses = (cat === "crops" || cat === "wild") && !isGold(k) ? RORDER.filter(r => RECIPES[r].need[k]) : [];
    det = detail(ctx, itemArt(k), itemName(k), itemDesc(k), mi("En stock", n) + mi("Prix", fmt(v)) + mi("Total", fmt(n * v)),
      uses.length ? `<p class="uses">Sert pour : ${uses.map(r => RECIPES[r].name).join(", ")}</p>` : "",
      `<button class="btn big ghost" data-act="sell" data-arg="${k}:one">Vendre 1 · ${priceTag(v)}</button><button class="btn big" data-act="sell" data-arg="${k}:all">Vendre tout · ${priceTag(n * v)}</button>`);
  }
  const grid = keys.map(x => tile(cat === "seeds" ? seedArt(x) : itemArt(x), { act: "sel", arg: `${ctx}:${x}`, sel: x === k, label: itemName(x), count: cnt(cat === "seeds" ? bag : itemBag(x), x) })).join("");
  const fill = Math.max(8, Math.ceil(keys.length / 4) * 4) - keys.length;
  return det + (ctx === "sell" && keys.length > 1 ? sortBar("sell", [["price", "Prix"], ["total", "Total"], ["name", "A → Z"]]) : "") + `<div class="tiles">${grid}${emptyTiles(fill)}</div>`;
}
function viewInv() {
  return `<div class="sheet tall" role="dialog" aria-modal="true" aria-label="Inventaire"><div class="sheet-head"><h2>Inventaire</h2>${SHEET_X}</div>${catTabs(CATS, UI.invCat, "invCat")}${invBody("inv", UI.invCat)}</div>`;
}

/* ---------------- Marché ---------------- */
function marketSeeds() {
  let k = UI.sel.seeds; if (!PLANTS[k]) k = ORDER.find(seedAvailable);
  const d = PLANTS[k], av = seedAvailable(k), myst = d.hybrid && !av;
  const det = myst
    ? detail("seeds", mystery(k), "Variété mystère", `Indice : ${d.hint}`, mi("Où la trouver", "Serre"), "", `<button class="btn big ghost" data-act="tab" data-arg="lab">Essayer un croisement</button>`)
    : detail("seeds", seedArt(k), d.name + (d.hybrid ? ` <small class="hy">Hybride</small>` : "") + (d.season ? " " + seasonIcon(d.season) : ""), d.desc + (d.season ? `<br><span class="sz-note">${seasonNote(k)}</span>` : ""),
      mi("Pousse", growDur(d.time * 1000 / plantSpeed(k))) + mi("Vente", fmt(d.sell)) + mi("XP", "+" + d.xp) + mi("En stock", cnt(S.seeds, k)), "",
      av && !seedBuyable(k) ? `<button class="btn big" disabled>En vente ${d.season === "printemps" ? "au printemps" : d.season === "ete" ? "en été" : d.season === "automne" ? "en automne" : "en hiver"}</button>`
      : av ? `<button class="btn big" data-act="buySeed" data-arg="${k}:1" ${S.coins < d.cost ? "disabled" : ""}>Acheter · ${priceTag(d.cost)}</button><button class="btn big ghost" data-act="buySeed" data-arg="${k}:5" ${S.coins < d.cost * 5 ? "disabled" : ""}>×5 · ${priceTag(d.cost * 5)}</button>`
        : `<button class="btn big" disabled>Disponible au niveau ${d.lvl}</button>`);
  const tileFor = x => {
    const p = PLANTS[x], a = seedAvailable(x), m = p.hybrid && !a;
    return tile(m ? mystery(x) : seedArt(x), { act: "sel", arg: "seeds:" + x, sel: x === k, label: m ? "Variété mystère" : p.name, locked: !a && !m, count: cnt(S.seeds, x), badge: m ? "" : seasonBadge(x), under: a ? (seedBuyable(x) ? priceTag(p.cost) : "Hors saison") : m ? "???" : `Niv. ${p.lvl}` });
  };
  // Tri : achetables d'abord (débloquées, en vente et payables), prix de vente, ordre alphabétique ; les verrouillées à la fin.
  const sm = sortOf("seeds"), ok = x => seedBuyable(x) && S.coins >= PLANTS[x].cost;
  const sorter = (a, b) => (seedAvailable(b) - seedAvailable(a)) || (!seedAvailable(a) && PLANTS[a].lvl - PLANTS[b].lvl) || (sm === "name" ? byName(a, b, x => PLANTS[x].name) : sm === "price" ? PLANTS[b].sell - PLANTS[a].sell : sm === "cost" ? PLANTS[a].cost - PLANTS[b].cost : (ok(b) - ok(a)) || byName(a, b, x => PLANTS[x].name)) || (PLANTS[a].lvl - PLANTS[b].lvl);
  const srt = l => sm === "none" ? l.sort((a, b) => seedAvailable(b) - seedAvailable(a) || (!seedAvailable(a) && plantLvl(a) - plantLvl(b))) : l.sort(sorter);
  const base = srt(ORDER.filter(x => !PLANTS[x].hybrid)), hyb = srt(ORDER.filter(x => PLANTS[x].hybrid));
  const found = hyb.filter(seedAvailable).length;
  return det + sortBar("seeds", [["ready", "Achetables"], ["cost", "Achat"], ["price", "Vente"], ["name", "A → Z"]]) + `<h3 class="cat-title">Plantes <span class="muted num">${base.filter(seedAvailable).length} / ${base.length}</span></h3><div class="tiles">${base.map(tileFor).join("")}</div>
    <h3 class="cat-title">Hybrides <span class="muted num">${found} / ${hyb.length}</span></h3><div class="tiles">${hyb.map(tileFor).join("")}</div>`;
}
// Hybrides d'une recette pas encore découverts : on ne peut pas l'apprendre avant.
const missingHyb = r => Object.keys(RECIPES[r].need).filter(k => PLANTS[k]?.hybrid && !S.hybrids.includes(k));
function marketRecipes() {
  let r = UI.sel.recipes;
  if (!RECIPES[r]) r = RORDER.find(x => !S.recipes.includes(x) && RECIPES[x].lvl <= S.level) || RORDER[0];
  const d = RECIPES[r], own = S.recipes.includes(r), lock = d.lvl > S.level, hybLock = !own && missingHyb(r).length > 0;
  const act = own ? `<button class="btn big ghost" data-act="cookGo" data-arg="${r}">Déjà apprise · aller en cuisine</button>`
    : lock ? `<button class="btn big" disabled>Disponible au niveau ${d.lvl}</button>`
    : hybLock ? `<button class="btn big ghost" data-act="tab" data-arg="lab">Découvre d’abord l’hybride à la Serre</button>`
    : `<button class="btn big" data-act="buyRecipe" data-arg="${r}" ${S.coins < d.price ? "disabled" : ""}>Apprendre · ${priceTag(d.price)}</button>`;
  const det = detail("recipes", dishArt(r), d.name, d.desc, mi("Cuisson", dur(d.time * 1000)) + mi("Vente", fmt(d.sell)) + mi("XP", "+" + d.xp), ingList(d.need), act);
  // Disponibles d'abord, recettes bloquées (niveau trop bas) en bas, par niveau croissant.
  const sorted = [...RORDER].sort((x, y) => (RECIPES[x].lvl > S.level) - (RECIPES[y].lvl > S.level) || (RECIPES[x].lvl > S.level ? RECIPES[x].lvl - RECIPES[y].lvl : 0));
  const grid = sorted.map(x => {
    const e = RECIPES[x], o = S.recipes.includes(x), l = e.lvl > S.level, h = !o && !l && missingHyb(x).length > 0;
    return tile(dishArt(x), { act: "sel", arg: "recipes:" + x, sel: x === r, label: e.name, locked: l || h, check: o, under: o ? `<span class="under-name">${e.name}</span>` : l ? `Niv. ${e.lvl}` : h ? "Hybride ?" : priceTag(e.price) });
  }).join("");
  return det + `<div class="tiles">${grid}</div>`;
}
function marketSell() {
  const tot = ORDER.reduce((s, k) => s + cnt(S.crops, k) * PLANTS[k].sell, 0);
  return `${catTabs([["crops", "Récoltes"], ["wild", "Balades"], ["dishes", "Plats"]], UI.sellCat, "sellCat")}
    ${UI.sellCat === "crops" && tot ? `<button class="btn peach" data-act="sellCrops">Vendre toute la récolte · ${priceTag(tot)}</button>` : ""}
    ${invBody("sell", UI.sellCat)}
    <p class="small muted" style="margin:0">Garde des ingrédients pour la Cuisine et les commandes du Village : elles rapportent plus.</p>`;
}
function marketUpgrades() {
    const plotStep = PLOT_STEPS[S.plots.length - 6];
    // Ordre : achetables maintenant, puis à débloquer (par niveau), puis acquis.
    const rows = [], rank = st => st ? (S.level >= st.lvl ? 0 : 1 + st.lvl / 100) : 9;
    rows.push([rank(plotStep), `<div class="item"><img class="upg-img" src="assets/img/ameliorations/upg-plot.webp" alt=""><div class="t"><b>Nouvelle parcelle</b><span>${S.plots.length} / ${MAX_PLOTS} parcelles</span></div><div class="acts">${plotStep ? (S.level < plotStep.lvl ? `<span class="small muted">Niveau ${plotStep.lvl}</span>` : `<button class="btn sm" data-act="buyPlot" ${S.coins < plotStep.cost ? "disabled" : ""}>${coin}${fmt(plotStep.cost)}</button>`) : `<span class="small muted"><b>Complet</b></span>`}</div></div>`]);
    for (const u in UPG) {
      const U = UPG[u], lv = S.upg[u], step = U.steps[lv], cur = U.values[lv], nxt = U.values[lv + 1];
      rows.push([rank(step), `<div class="item"><img class="upg-img" src="assets/img/${U.img || "ameliorations/upg-" + u}.webp" alt=""><div class="t"><b>${U.name}${U.steps.length > 1 ? ` <small class="muted">${lv}/${U.steps.length}</small>` : ""}</b><span>${U.desc(cur)}${step && U.desc(nxt) !== U.desc(cur) ? ` → ${U.desc(nxt)}` : ""}</span></div>
      <div class="acts">${!step ? `<span class="small muted"><b>Acquis</b></span>` : S.level < step.lvl ? `<span class="small muted">Niveau ${step.lvl}</span>` : `<button class="btn sm" data-act="buyUpg" data-arg="${u}" ${S.coins < step.cost ? "disabled" : ""}>${coin}${fmt(step.cost)}</button>`}</div></div>`]);
    }
  return `<div class="list">${rows.sort((a, b) => a[0] - b[0]).map(r => r[1]).join("")}</div>`;
}
function views_market() {
  const sub = [["seeds", "Graines"], ["recipes", "Recettes"], ["sell", "Vendre"], ["upgrades", "Bonus"]];
  const body = { seeds: marketSeeds, recipes: marketRecipes, upgrades: marketUpgrades, sell: marketSell }[msub]();
  return `<section class="panel"><div class="row spread"><h2>Marché</h2><span class="market-purse" title="Tes pièces">${coin}${fmt(S.coins)}</span></div>
    <div class="subtabs">${sub.map(([k, l]) => `<button data-act="msub" data-arg="${k}" aria-pressed="${msub === k}">${l}</button>`).join("")}</div>${body}</section>`;
}

/* ---------------- Cuisine ---------------- */
function views_kitchen() {
  const t = now(), n = stoves();
  const slots = [];
  for (let i = 0; i < n; i++) {
    const c = S.cooking[i];
    if (!c) slots.push(`<div class="stove"><img class="stove-img" src="assets/img/atelier/stove-off.webp" alt=""><span class="muted small">Fourneau libre</span></div>`);
    else if (c.end <= t) slots.push(`<div class="stove done">${dishArt(c.r)}<b class="small">${RECIPES[c.r].name}</b><button class="btn sm" data-act="serve" data-arg="${i}">Récupérer</button></div>`);
    else slots.push(`<div class="stove busy"><div class="stove-pic"><img class="stove-img" src="assets/img/atelier/stove-on.webp" alt=""><span class="stove-dish">${dishArt(c.r)}</span></div><b class="small">${RECIPES[c.r].name}</b><div class="pbar"><i data-pb="${c.end}" data-pd="${RECIPES[c.r].time * 1000}"></i></div><span class="small muted num" data-left="${c.end}"></span></div>`);
  }
  const head = `<section class="panel"><div class="row spread"><h2>Cuisine</h2><span class="small muted">${n} fourneau${n > 1 ? "x" : ""}</span></div><div class="stoves">${slots.join("")}</div></section>`;
  if (!S.recipes.length) return head + `<section class="panel"><div class="empty-note">${dishArt("salade")}<span>${S.level >= 2 ? "Apprends ta première recette au Marché." : "La cuisine ouvre au niveau 2 avec la Salade croquante."}</span>${S.level >= 2 ? `<button class="btn" data-act="goRecipes">Voir les recettes</button>` : ""}</div></section>`;
  let r = UI.sel.kitchen; if (!S.recipes.includes(r)) r = S.recipes.find(canCook) || S.recipes[0];
  const d = RECIPES[r], ok = canCook(r), free = S.cooking.length < n;
  const btn = `<button class="btn big peach" data-act="cook" data-arg="${r}" ${ok && free ? "" : "disabled"}>${!ok ? "Il manque des ingrédients" : !free ? "Fourneaux occupés" : `Cuisiner · ${dur(d.time * 1000)}`}</button>`;
  const det = detail("kitchen", dishArt(r), d.name, d.desc, mi("Cuisson", dur(d.time * 1000)) + mi("Vente", fmt(d.sell)) + mi("XP", "+" + d.xp) + mi("En stock", cnt(S.dishes, r)), ingList(d.need), btn);
  const km = sortOf("kitchen"), rec = [...S.recipes];
  if (km !== "none") rec.sort(km === "name" ? (a, b) => byName(a, b, x => RECIPES[x].name) : km === "price" ? (a, b) => RECIPES[b].sell - RECIPES[a].sell
    : (a, b) => canCook(b) - canCook(a) || byName(a, b, x => RECIPES[x].name));
  const grid = rec.map(x => tile(dishArt(x), { act: "sel", arg: "kitchen:" + x, sel: x === r, label: RECIPES[x].name, count: cnt(S.dishes, x), dot: canCook(x), want: S.orders.some(o => o.items[x]) })).join("") +
    `<div class="tile-wrap"><button class="tile more" data-act="goRecipes" aria-label="Apprendre des recettes">+</button><span class="under">Recettes</span></div>`;
  return head + `<section class="panel">${det}${sortBar("kitchen", [["ready", "Faisables"], ["price", "Prix"], ["name", "A → Z"]])}<div class="tiles">${grid}</div></section>`;
}

function views_lab() {
  const t = now();
  const isKnown = k => S.discovered.includes(k) || S.hybrids.includes(k);
  const herbCard = k => { const d = PLANTS[k], known = isKnown(k); return `
      <button class="herb ${known ? "" : "unknown"} ${S.goldenFound.includes(k) ? "has-gold" : ""}" data-act="plantInfo" data-arg="${k}" aria-label="${known || !d.hybrid ? d.name : "Variété mystère"}">${cropArt(k)}${seasonBadge(k)}<b>${known || !d.hybrid ? d.name : "???"}</b>${known ? `<span class="muted">${fmt(d.sell)} pièces</span>` : d.hybrid ? "" : `<span class="muted">Niveau ${d.lvl}</span>`}</button>`; };
  // Les plantes pas encore découvertes vont à la fin, par niveau de déblocage.
  const byKnown = (a, b) => isKnown(b) - isKnown(a) || plantLvl(a) - plantLvl(b); // découvertes d’abord, puis par niveau d’accès
  const baseK = ORDER.filter(k => !PLANTS[k].hybrid).sort(byKnown), hybK = ORDER.filter(k => PLANTS[k].hybrid).sort(byKnown);
  const herb = `<section class="panel"><div class="row spread"><h2>Herbier</h2><span class="small muted num">${ORDER.filter(isKnown).length} / ${ORDER.length} · <span class="gold-count">★ ${S.goldenFound.length} dorée${S.goldenFound.length > 1 ? "s" : ""}</span></span></div>
    <h3 class="cat-title">Plantes <span class="muted num">${baseK.filter(isKnown).length} / ${baseK.length}</span></h3><div class="herbier">${baseK.map(herbCard).join("")}</div>
    <h3 class="cat-title">Hybrides <span class="muted num">${hybK.filter(isKnown).length} / ${hybK.length}</span></h3>${hybK.some(k => !isKnown(k)) ? `<p class="small muted" style="margin:-4px 0 0">Touche un hybride inconnu pour un indice.</p>` : ""}<div class="herbier">${hybK.map(herbCard).join("")}</div></section>`;
  if (S.level < 3) return `<section class="panel"><h2>Serre</h2><div class="empty-note"><img class="banner-img" src="assets/img/atelier/greenhouse.webp" alt=""><span>La Serre ouvre au niveau 3. Tu pourras y croiser deux récoltes pour découvrir des variétés hybrides.</span></div></section>${herb}`;
  let top;
  if (S.lab) {
    const done = S.lab.end <= t;
    top = `<div class="lab-slots"><div class="slot filled">${cropArt(S.lab.a)}</div><img class="cauldron bubbling" src="assets/img/atelier/cauldron.webp" alt=""><div class="slot filled">${cropArt(S.lab.b)}</div></div>
      ${done ? `<button class="btn peach" data-act="labCollect">Découvrir le résultat</button>` : `<div class="pbar"><i data-pb="${S.lab.end}" data-pd="${LAB_TIME * 1000}"></i></div><span class="small muted num" data-left="${S.lab.end}"></span>`}`;
  } else {
    const have = ORDER.filter(k => cnt(S.crops, k) > 0 && !PLANTS[k].hybrid); // les hybrides ne se croisent pas
    const [a, b] = labSel;
    top = `<div class="lab-slots">${[a, b].map((k, i) => k ? `<button class="slot filled" data-act="labClear" data-arg="${i}" aria-label="Retirer ${PLANTS[k].name}">${cropArt(k)}<small>${PLANTS[k].name}</small></button>` : `<div class="slot"><span class="small muted">Choisis une récolte</span></div>`).join('<img class="cauldron" src="assets/img/atelier/cauldron.webp" alt="">')}</div>
      ${have.length ? `<div class="basket">${have.map(k => `<button class="chip" data-act="labPick" data-arg="${k}" aria-pressed="${labSel.includes(k)}">${cropArt(k)}${PLANTS[k].name} · ${cnt(S.crops, k)}</button>`).join("")}</div>` : `<p class="small muted" style="margin:0">Il te faut des récoltes en stock pour faire un croisement.</p>`}
      <div class="row"><button class="btn" data-act="labStart" ${a && b ? "" : "disabled"}>Croiser · ${dur(LAB_TIME * 1000)}</button><span class="small muted">Consomme 1 de chaque. Bonne combinaison : 2 graines hybrides.</span></div>`;
  }
  // Tous les hybrides trouvés : la Serre se replie en un bandeau « terminé » (elle se rouvre d'un toucher,
  // et se rouvrira d'elle-même si de nouveaux hybrides arrivent).
  const allFound = hybK.every(h => S.hybrids.includes(h));
  if (allFound && !UI.labOpen && !S.lab) return `<button class="panel lab-done" data-act="toggleLab" aria-expanded="false"><img src="assets/img/atelier/greenhouse.webp" alt=""><span><b>Serre à hybrides</b><small>Tous les hybrides découverts <span class="num" style="white-space:nowrap">· ${hybK.length}/${hybK.length}</span></small></span><span class="lab-check">${CHECK}</span><svg class="lab-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>${herb}`;
  return `<section class="panel"><div class="lab-head"><img src="assets/img/atelier/greenhouse.webp" alt=""><div><h2>Serre à hybrides</h2><p class="small muted" style="margin:0">${allFound ? "Tous les hybrides sont découverts. Tu peux encore croiser pour obtenir leurs graines." : "Croise deux récoltes pour découvrir de nouvelles variétés."}</p></div>${allFound && !S.lab ? `<button class="btn ghost sm lab-fold" data-act="toggleLab" aria-expanded="true">Réduire</button>` : ""}</div>${top}</section>${herb}`;
}

function views_village() {
  const t = now();
  const cards = S.orders.map(o => { const v = VILLAGERS[o.v]; const ok = Object.entries(o.items).every(([k, q]) => cnt(itemBag(k), k) >= q); return `
    <div class="order"><div class="avatar">${avatar(v)}</div><div style="min-width:0"><div class="who">${v.name}${o.stars ? `<span class="diff d${o.stars}">${"★".repeat(o.stars)}<span>${o.label}</span></span>` : ""}${o.offSeason ? `<span class="diff off">Hors saison · +30 %</span>` : ""}</div><div class="say">« ${o.say || v.say[o.line || 0]} »</div>
      <div class="need" style="margin-top:6px">${Object.entries(o.items).map(([k, q]) => `<button class="chip need-chip ${cnt(itemBag(k), k) < q ? "miss" : ""}" data-name="${itemName(k)}" data-act="chipName" data-arg="${k}" aria-label="${itemName(k)}">${itemArt(k)}${cnt(itemBag(k), k)}/${q}</button>${RECIPES[k] && !S.recipes.includes(k) ? `<button class="learn-tag" data-act="goRecipe" data-arg="${k}">Recette à apprendre</button>` : ""}`).join("")}</div>
      <div class="foot"><span class="reward">${coin}${fmt(o.coins)} <span class="muted">+${o.xp} XP</span></span><span style="margin-left:auto" class="row"><button class="btn ghost sm" data-act="dismiss" data-arg="${o.id}">Refuser</button><button class="btn sm" data-act="deliver" data-arg="${o.id}" ${ok ? "" : "disabled"}>Livrer</button></span></div></div></div>`; }).join("");
  return `<section class="panel"><div class="row spread"><h2>Commandes du village</h2><span class="small muted">${S.orders.length} / ${maxOrders()}</span></div>
    ${cards || `<div class="empty-note"><span>Aucune commande pour le moment.</span></div>`}
    ${S.orders.length < maxOrders() ? `<p class="small muted num" style="margin:0">Prochaine visite dans <span data-left="${S.nextOrderAt}"></span></p>` : ""}</section>`;
}

/* ---------------- Render loop ---------------- */
const VIEWS = { garden: views_garden, market: views_market, kitchen: () => atelierBar() + views_kitchen(), lab: () => atelierBar() + views_lab(), village: views_village, friends: views_friends, balades: views_balades };
let lastSig = "";
function sig(t) {
  const base = [tab, season(), S.coins, S.level, msub, labSel.join(","), JSON.stringify(UI)].join("|");
  switch (tab) {
    case "garden": return base + weeklySig() + JSON.stringify([sgPortalHTML(), sgKnown(), mailCount(), CLOUD.signedIn, fwActive(t).map(w => w.id), S.decoSlots, S.quests && S.quests.list.map(q => [q.prog, q.claimed]), S.quests && S.quests.bonus, S.plots.length, S.upg, S.crops, S.wild, S.dishes, S.plots.filter(p => !p.seed).length, S.plots.filter(p => plotState(p, t) === "weed").length, S.plots.filter(p => plotState(p, t) === "ripe").length, S.plots.filter(p => plotState(p, t) === "dry").length]);
    case "market": return base + JSON.stringify([S.seeds, S.crops, S.wild, S.dishes, S.recipes, S.upg, S.plots.length, S.hybrids]);
    case "kitchen": return base + JSON.stringify([S.recipes, S.crops, S.wild, S.dishes, S.cooking.map(c => c.r + (c.end <= t)), S.orders.map(o => o.id)]);
    case "lab": return base + JSON.stringify([S.crops, S.lab && (S.lab.a + S.lab.b + (S.lab.end <= t)), S.hybrids, S.discovered]);
    case "village": return base + JSON.stringify([S.orders.map(o => o.id), S.crops, S.wild, S.dishes, S.orders.length < maxOrders()]);
    case "balades": return base + JSON.stringify([S.games, S.wild, parisDay(), weekId(), BOARD.data, BOARD.error, CLOUD.signedIn]);
    case "friends": return base + JSON.stringify([SG.data, SG.error, SG.busy, FR.list, FR.unread, FR.tab, FR.results, FR.searching, FR.loaded, FR.error, FR.code, FR.confirm, FR.hlTrade, CLOUD.signedIn, CLOUD.blocked]);
  }
}
/* Remplace les enfants de « live » par ceux de « fresh », sauf « keep » qui reste en place. */
function swapAround(live, fresh, keep, freshKeep) {
  [...live.childNodes].forEach(n => { if (n !== keep) n.remove(); });
  let after = false;
  for (const n of [...fresh.childNodes]) {
    if (n === freshKeep) { after = true; continue; }
    if (after) live.appendChild(n); else live.insertBefore(n, keep);
  }
}
function render(force) {
  if (document.documentElement.dataset.season !== season()) applyTheme();
  const t = now();
  const s = sig(t);
  if (force || s !== lastSig) {
    // Le jardin garde ses parcelles existantes : seules celles qui changent sont redessinées,
    // pour que les anneaux et le halo ne repartent pas de zéro à chaque action.
    $("#view").dataset.tab = tab;
    const oldGarden = tab === "garden" ? $("#view .garden") : null;
    const tmp = document.createElement("div"); tmp.innerHTML = VIEWS[tab]();
    const freshGarden = tmp.querySelector(".garden");
    if (oldGarden && freshGarden && freshGarden.querySelectorAll("[data-plot]").length === oldGarden.querySelectorAll("[data-plot]").length) {
      // Le jardin n'est jamais retiré de la page : sinon les animations (halo, goutte, étoile)
      // repartent de zéro. On remplace seulement ce qui l'entoure.
      for (const sel of [".deco-row", ".mailbox", ".sg-portal"]) { const o = oldGarden.querySelector(sel), n = freshGarden.querySelector(sel); if (o && n) o.replaceWith(n); else if (n) oldGarden.appendChild(n); else if (o) o.remove(); }
      oldGarden.classList.toggle("editing", !!UI.editDeco);
      // Saison : on ne remplace les particules que si la saison a changé (sinon leur animation repartirait).
      if (oldGarden.dataset.season !== season()) { oldGarden.dataset.season = season(); oldGarden.querySelector(".season-fx")?.replaceWith(freshGarden.querySelector(".season-fx")); }
      oldGarden.classList.toggle("decorated", !!UI.editDeco || S.decoSlots.some(Boolean));
      // On remonte jusqu'à la vue en remplaçant, à chaque niveau, tout sauf l'élément qui contient le jardin.
      let keep = oldGarden, fresh = freshGarden;
      while (keep.parentElement !== $("#view")) { swapAround(keep.parentElement, fresh.parentElement, keep, fresh); keep = keep.parentElement; fresh = fresh.parentElement; }
      swapAround($("#view"), tmp, keep, fresh);
    } else {
      $("#view").replaceChildren(...tmp.childNodes);
    }
    lastSig = s;
    if (modalView && !$("#modal").hidden) {
      const sc = $("#modal .sheet")?.scrollTop || 0;
      const kept = [...document.querySelectorAll("#modal textarea, #modal input[id]:not([type=range])")].map(t => [t.id, t.value, t === document.activeElement, t.selectionStart]);
      // Même fenêtre : on remplace son contenu sans la recréer (pas d'animation d'ouverture rejouée).
      const box = document.createElement("div"); box.innerHTML = modalView();
      const ns = box.firstElementChild, os = $("#modal .sheet");
      const strip = [...document.querySelectorAll("#modal .strip")].map(e => e.scrollLeft);
      const cb = document.getElementById("chat-body"), cbTop = cb?.scrollTop, cbEnd = cb ? cb.scrollHeight - cb.scrollTop - cb.clientHeight < 120 : false;
      if (os && ns && box.children.length === 1 && os.className === ns.className) {
        for (const a of ns.attributes) os.setAttribute(a.name, a.value);
        os.innerHTML = ns.innerHTML;
        document.querySelectorAll("#modal .strip").forEach((e, k) => { e.scrollLeft = strip[k] || 0; });
      } else $("#modal").innerHTML = box.innerHTML;
      for (const [id, v, f, c] of kept) { const t = document.getElementById(id); if (t) { t.value = v; if (f) { t.focus(); try { t.setSelectionRange(c, c); } catch (e) {} } } }
      const sh = $("#modal .sheet"); if (sh) sh.scrollTop = sc;
      const cb2 = document.getElementById("chat-body"); if (cb2 && cb) cb2.scrollTop = cbEnd ? cb2.scrollHeight : cbTop; // conversation : on garde sa place (ou le bas)
    }
    document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.arg === tab || (b.dataset.arg === "atelier" && inAtelier())));
  }
  live(t);
}
function live(t) {
  $("#coins").innerHTML = `<span class="n-short">${fmtShort(S.coins)}</span><span class="n-full">${fmt(S.coins)}</span>`; $("#coins").parentNode.title = `${fmt(S.coins)} pièces`;
  updateBrand();
  $("#lvl").innerHTML = `<span class="lv-name"><span class="lv-long">Niveau</span><span class="lv-short">Niv.</span> ${S.level}</span>`;
  const ttl = $("#ttl"); ttl.hidden = !S.title; ttl.textContent = S.title || ""; // titre sous la barre d’XP
  $("#xpt").innerHTML = `<span class="n-short">${fmtXp(S.xp)} / ${fmtXp(xpNeed(S.level))}</span><span class="n-full">${fmt(S.xp)} / ${fmt(xpNeed(S.level))}</span><span class="xp-unit"> XP</span>`;
  $("#xpb").style.width = (S.xp / xpNeed(S.level) * 100).toFixed(1) + "%";
  if (tab === "garden") updateGarden(t);
  updateVisit(t);
  updatePlotTip(t);
  tutoUpdate();
  document.querySelectorAll("[data-pb]").forEach(el => { const e = +el.dataset.pb, d = +el.dataset.pd; el.style.width = Math.min(100, (1 - (e - t) / d) * 100).toFixed(1) + "%"; });
  document.querySelectorAll("[data-left]").forEach(el => { el.textContent = dur(+el.dataset.left - t); });
  // Badges & tab title
  const gN = S.plots.filter(p => { const st = plotState(p, t); return st === "ripe" || st === "dry" || st === "weed"; }).length;
  const kN = S.cooking.filter(c => c.end <= t).length;
  const lN = S.lab && S.lab.end <= t ? 1 : 0;
  const vN = S.orders.filter(o => Object.entries(o.items).every(([k, q]) => cnt(itemBag(k), k) >= q)).length;
  badge("b-garden", gN); badge("b-atelier", kN + lN); subBadge("kitchen", kN); subBadge("lab", lN); badge("b-village", vN); if (FRIENDS_ON) badge("b-friends", incoming().length + unreadTotal() + (typeof sgChatNew === "function" && sgOn() ? sgChatNew() : 0));
  // Barre de progression sur les onglets Cuisine et Serre pendant une préparation.
  const running = S.cooking.filter(c => c.end > t).map(c => ({ end: c.end, d: RECIPES[c.r].time * 1000 }));
  const next = running.sort((a, b) => a.end - b.end)[0];
  const fk = next ? 1 - (next.end - t) / next.d : null, fl = S.lab && S.lab.end > t ? 1 - (S.lab.end - t) / (LAB_TIME * 1000) : null;
  tabProg("p-kitchen", fk); tabProg("p-lab", fl);
  document.querySelector('.tab[data-arg="atelier"]')?.classList.toggle("two-prog", fk != null && fl != null); // deux jauges l'une au-dessus de l'autre
  document.querySelectorAll(".atelier-sw .tab-prog").forEach(el => tabProg(el, el.dataset.sp === "kitchen" ? fk : fl));
  // Amis : demandes reçues, messages non lus, échanges reçus et réponses aux échanges (pas les arrosages ni les cœurs).
  const fN = FRIENDS_ON && CLOUD.signedIn ? incoming().length + unreadTotal() + trIn().length + sgInvites().length + mailNews().filter(n => !n.read && n.kind === "t").length : 0;
  const total = gN + kN + lN + fN;
  const title = total ? `(${total}) Potager idle` : "Potager idle";
  if (document.title !== title) document.title = title;
}
function tabProg(id, f) {
  const el = typeof id === "string" ? document.getElementById(id) : id; if (!el) return;
  el.hidden = f == null;
  if (f != null) el.firstElementChild.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + "%";
}
function subBadge(k, n) { const el = document.querySelector(`.atelier-sw [data-sb="${k}"]`); if (el) { el.hidden = !n; el.textContent = n; } }
const inAtelier = () => tab === "kitchen" || tab === "lab";
// Atelier : les deux sous-onglets Cuisine et Serre, en haut de chacune des deux pages.
function atelierBar() {
  return `<div class="subtabs atelier-sw">${[["kitchen", "Cuisine", "stove-on"], ["lab", "Serre", "greenhouse"]].map(([k, l, img]) => `<button data-act="tab" data-arg="${k}" aria-pressed="${tab === k}"><img src="assets/img/atelier/${img}.webp" alt="">${l}<span class="badge" data-sb="${k}" hidden></span><span class="tab-prog" data-sp="${k}" hidden><i></i></span></button>`).join("")}</div>`;
}
function badge(id, n) { const el = document.getElementById(id); el.hidden = !n; el.textContent = n; }

/* ---------------- Modal, toasts, fx ---------------- */
const PICK = { plot: null, order: [], cat: "base" };
function openPicker(i) {
  PICK.plot = i;
  const keys = ORDER.filter(k => seedBuyable(k) || cnt(S.seeds, k) > 0);
  keys.sort((a, b) => PLANTS[a].name.localeCompare(PLANTS[b].name, "fr", { sensitivity: "base" })); // ordre alphabétique
  if (PICK.cat === "hybrid" && !keys.some(k => PLANTS[k].hybrid)) PICK.cat = "base";
  PICK.order = keys; // ordre figé tant que la fenêtre est ouverte, pour ne pas faire bouger les boutons
  modalView = viewPicker; $("#modal").innerHTML = viewPicker(); openModal();
  $("#modal .sheet button")?.focus();
}
function viewPlotShop() {
  const step = PLOT_STEPS[S.plots.length - 6];
  if (!step) return "";
  const lock = S.level < step.lvl, poor = S.coins < step.cost;
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="Nouvelle parcelle">
    <div class="sheet-head"><h2>Nouvelle parcelle</h2>${SHEET_X}</div>
    <div class="detail"><div class="d-head"><div class="d-art"><img src="assets/img/ameliorations/upg-plot.webp" alt="" style="width:100%;height:100%;object-fit:contain"></div>
      <div class="d-txt"><h3>Un bac de plus</h3><p>Une parcelle supplémentaire pour faire pousser plus de plantes en même temps.</p></div></div>
      <div class="meta">${mi("Parcelles", `${S.plots.length} → ${S.plots.length + 1}`)}${mi("Prix", fmt(step.cost))}${mi("Tes pièces", fmt(S.coins))}</div>
      <div class="d-acts"><button class="btn big" data-act="buyPlot" ${lock || poor ? "disabled" : ""}>${lock ? `Disponible au niveau ${step.lvl}` : poor ? `Il te manque ${fmt(step.cost - S.coins)} pièces` : `Acheter · ${coin}${fmt(step.cost)}`}</button></div>
    </div></div>`;
}
function viewPicker() {
  const free = S.plots.filter(p => !p.seed).length;
  // Même hauteur pour les deux onglets (celle du plus rempli), pour éviter un saut en changeant d'onglet.
  const rows = Math.max(PICK.order.filter(k => !PLANTS[k].hybrid).length, PICK.order.filter(k => PLANTS[k].hybrid).length, 1);
  return `<div class="sheet picker-sheet" style="--rows:${rows}" role="dialog" aria-modal="true" aria-label="Choisir une graine">
    <div class="sheet-head"><div><h2>Que planter ?</h2><span class="small muted num">${free} bac${free > 1 ? "s" : ""} vide${free > 1 ? "s" : ""}</span></div>${SHEET_X}</div>
    ${(() => { const nb = PICK.order.filter(k => !PLANTS[k].hybrid).length, nh = PICK.order.filter(k => PLANTS[k].hybrid).length;
      return `<div class="subtabs" style="grid-template-columns:1fr 1fr">${[["base", "Plantes", nb], ["hybrid", "Hybrides", nh]].map(([c, l, n]) => `<button data-act="pickCat" data-arg="${c}" aria-pressed="${PICK.cat === c}">${l} <span class="num">${n}</span></button>`).join("")}</div>`; })()}
    ${PICK.cat === "hybrid" && !PICK.order.some(k => PLANTS[k].hybrid) ? `<div class="empty-note"><span>Aucun hybride pour l’instant. Croise deux récoltes dans la Serre pour en découvrir.</span></div>` : ""}
    <div class="list">${PICK.order.filter(k => !!PLANTS[k].hybrid === (PICK.cat === "hybrid")).map(k => { const d = PLANTS[k], own = cnt(S.seeds, k); return `
      <div class="item">${seedArt(k)}<div class="t"><b>${d.name}${inSeason(k) ? " " + seasonIcon(d.season) : ""}</b><span>${growDur(d.time * 1000 / plantSpeed(k))} · se vend ${fmt(d.sell)} · +${d.xp} XP</span></div>
      <div class="acts">${own ? `<button class="btn sm${PICK.flash === k ? " planted" : ""}" data-act="plant" data-arg="${k}">Planter · ${own} en stock</button>` : `<button class="btn ghost sm${PICK.flash === k ? " planted" : ""}" data-act="plant" data-arg="${k}" ${S.coins < d.cost ? "disabled" : ""}>Acheter et planter · ${coin}${fmt(d.cost)}</button>`}</div></div>`; }).join("")}</div></div>`;
}
/* Fiche d'une plante depuis l'herbier. */
function openPlantInfo(k) {
  const d = PLANTS[k];
  const known = S.discovered.includes(k) || S.hybrids.includes(k);
  const uses = RORDER.filter(r => RECIPES[r].need[k]);
  const usedIn = ORDER.filter(h => PLANTS[h].hybrid && PLANTS[h].parents.includes(k) && S.hybrids.includes(h));
  const title = known || !d.hybrid ? d.name : "Variété mystère";
  const desc = known ? d.desc : d.hybrid ? `Indice : ${d.hint}` : `Une plante encore jamais récoltée. Ses graines se débloquent au niveau ${d.lvl}.`;
  modalView = () => `<div class="sheet reveal info" role="dialog" aria-modal="true" aria-label="${title}">
    <span class="rv-tag">${d.season ? seasonIcon(d.season) + " " : ""}${d.hybrid ? "Hybride" : d.season ? `Plante ${SEASONS[d.season].of}` : "Plante"}${known ? "" : " · à découvrir"}</span>
    <div class="rv-stage"><div class="rv-glow"></div><div class="reveal-art${known ? "" : " sil"}">${cropArt(k)}</div></div>
    <h2>${title}</h2>
    ${d.hybrid && known ? `<div class="rv-cross"><span>${cropArt(d.parents[0])}${PLANTS[d.parents[0]].name}</span><b>+</b><span>${cropArt(d.parents[1])}${PLANTS[d.parents[1]].name}</span></div>` : ""}
    <p class="rv-desc">${known ? `«&nbsp;${desc}&nbsp;»` : desc}</p>
    ${d.season ? `<p class="sz-note">${seasonNote(k)}${inSeason(k) ? " <b>C’est sa saison !</b>" : ""}</p>` : ""}
    ${known ? `<div class="meta rv-meta">${mi("Pousse", growDur(d.time * 1000 / plantSpeed(k)))}${mi("Vente", fmt(d.sell))}${mi("XP récolte", "+" + d.xp)}${mi("En stock", fmt(cnt(S.crops, k)))}</div>` : ""}
    ${known ? `<div class="hi-gold ${S.goldenFound.includes(k) ? "found" : ""}">${S.goldenFound.includes(k) ? `${goldArt(k)}<span><b>Version dorée trouvée</b><br>Elle vaut ${fmt(d.sell * 10)} pièces.</span>` : `<span class="sil">${cropArt(k)}</span><span><b>Version dorée : pas encore trouvée</b><br>Une récolte sur 50 environ est dorée.</span>`}</div>` : ""}
    ${known && uses.length ? `<div class="hi-uses"><h4>Recettes</h4><div class="basket">${uses.map(r => `<span class="chip">${dishArt(r)}${RECIPES[r].name}</span>`).join("")}</div></div>` : ""}
    ${known && usedIn.length ? `<div class="hi-uses"><h4>Hybrides obtenus</h4><div class="basket">${usedIn.map(h => `<span class="chip">${cropArt(h)}${PLANTS[h].name}</span>`).join("")}</div></div>` : ""}
    ${SHEET_X}</div>`;
  $("#modal").innerHTML = modalView(); openModal();
}
function openReveal(h, isNew) {
  const d = PLANTS[h];
  const [pa, pb] = d.parents;
  const uses = RORDER.filter(r => RECIPES[r].need[h]).map(r => RECIPES[r].name);
  modalView = () => `<div class="sheet reveal${isNew ? " new" : ""}" role="dialog" aria-modal="true" aria-label="Résultat du croisement">
    ${isNew ? `<span class="lv-tag">Nouvelle variété</span>` : `<span class="rv-tag">Croisement réussi</span>`}
    <div class="rv-stage"><div class="rv-glow"></div><div class="reveal-art">${plantArt(h, 3)}</div></div>
    <h2>${d.name}</h2>
    <div class="rv-cross"><span>${cropArt(pa)}${PLANTS[pa].name}</span><b>+</b><span>${cropArt(pb)}${PLANTS[pb].name}</span></div>
    <p class="rv-desc">«&nbsp;${d.desc}&nbsp;»</p>
    <div class="rv-rewards">
      <div class="rv-reward"><div class="lv-art">${seedArt(h)}</div><b class="num">+2</b><span>graines</span></div>
      <div class="rv-reward"><div class="lv-art"><img src="assets/img/interface/xp-leaf.webp" alt=""></div><b class="num">+${isNew ? 25 : 6}</b><span>XP</span></div>
      ${isNew ? `<div class="rv-reward"><div class="lv-art rv-shop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l2-5h14l2 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" fill="currentColor"/><path d="M5 13v7h14v-7" stroke="currentColor" stroke-width="2" fill="none"/></svg></div><b>Marché</b><span>graines en vente</span></div>` : ""}
    </div>
    <div class="meta rv-meta">${mi("Pousse", growDur(d.time * 1000 / plantSpeed(h)))}${mi("Vente", `${fmt(d.sell)}`)}${mi("XP récolte", "+" + d.xp)}</div>
    ${uses.length ? `<p class="small muted" style="margin:0">Sert pour : ${uses.join(", ")}</p>` : ""}
    <button class="btn big" data-act="close">Super !</button></div>`;
  $("#modal").innerHTML = modalView(); openModal(); SFX.play(isNew ? "discover" : "success"); if (isNew) buzz([20, 60, 20, 60, 40]);
}
// Le bouton retour d’Android ferme la fenêtre au lieu de quitter l’appli.
function openModal() {
  const wasOpen = !$("#modal").hidden;
  $("#modal").hidden = false;
  if (!wasOpen) history.pushState({ modal: 1 }, "");
}
let modalView = null;
function closeModal(fromBack) {
  modalView = null;
  if ($("#modal").hidden) return;
  $("#modal").hidden = true; $("#modal").innerHTML = "";
  if (!fromBack && history.state && history.state.modal) history.back();
  if (LEVEL_QUEUE.length) setTimeout(showLevelUp, 250);
  else setTimeout(showDaily, 400);
}
addEventListener("popstate", () => closeModal(true));
function toast(html, ms = 3500) {
  const el = document.createElement("div"); el.className = "toast"; el.innerHTML = html;
  $("#toasts").appendChild(el); setTimeout(() => el.remove(), ms);
  while ($("#toasts").children.length > 3) $("#toasts").firstChild.remove();
}
function floatText(txt, x, y, gold) {
  const el = document.createElement("span"); el.className = "float" + (gold === true ? " gold" : gold ? " " + gold : "");
  el.textContent = txt; el.style.left = x + "px"; el.style.top = y + "px";
  $("#fx").appendChild(el); setTimeout(() => el.remove(), 1200);
}
const BCOL = [["#ff9fc0", "#ff6f9a"], ["#ffd36b", "#f4a52a"], ["#9fd0ff", "#5aa7ee"], ["#c9a5ff", "#9a6cf0"]];
function spawnButterfly() {
  const [a, b] = pick(BCOL);
  const el = document.createElement("button");
  const vis = VISITOR();
  el.className = "butterfly v-" + vis.key; el.setAttribute("aria-label", vis.label);
  el.style.top = rand(22, 70) + "vh"; el.style.left = "0";
  el.style.animationDuration = rand(11, 16) + "s";
  if (Math.random() < .5) el.classList.add("rtl"); // arrive de la droite une fois sur deux
  el.innerHTML = `<span class="bf">${visitorArt(vis.key)}</span>`;
  el.addEventListener("click", ev => {
    ev.stopPropagation(); el.remove(); S.stats.butterflies++; S.stats.visitors = [...new Set([...(S.stats.visitors || []), vis.key])]; questProgress("butterfly"); SFX.play("butterfly");
    const gain = 2 + S.level; earn(gain, ev.clientX || innerWidth / 2, ev.clientY || innerHeight / 2, 3, "butterfly-gain gain-" + vis.key);
    commit();
  });
  el.addEventListener("animationend", () => el.remove());
  $("#fx").appendChild(el);
}

/* Image qui n'a pas pu se charger (réseau coupé un instant…) : on réessaie jusqu'à 3 fois. */
document.addEventListener("error", ev => {
  const el = ev.target, attr = el?.tagName === "IMG" ? "src" : el?.tagName === "image" ? "href" : null;
  if (!attr) return;
  const n = +(el.dataset?.retry || 0);
  if (n >= 3) { // toujours rien : on met le dessin vectoriel à la place (ou on masque l'image)
    const host = attr === "href" ? el.closest("svg") : el, html = vectorArt(el.getAttribute(attr));
    if (!host) return;
    if (html) { const box = document.createElement("div"); box.innerHTML = html; const v = box.firstElementChild; if (host.getAttribute("class")) v.setAttribute("class", host.getAttribute("class").replace(/\bimg\b/, "")); host.replaceWith(v); }
    else host.style.visibility = "hidden";
    return;
  }
  el.dataset.retry = n + 1;
  setTimeout(() => { const u = (el.getAttribute(attr) || "").split("?")[0]; if (u) el.setAttribute(attr, `${u}?r=${Date.now()}`); }, 1500 * (n + 1));
}, true);
/* ---------------- Events ---------------- */
document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]");
  if (!el) { if (ev.target.id === "modal") closeModal(); return; }
  if (el.disabled) return;
  const fn = A[el.dataset.act]; if (fn) fn(el.dataset.arg, ev);
});
document.addEventListener("change", ev => {
  const el = ev.target.closest("[data-input]"); if (el && A[el.dataset.input]) A[el.dataset.input](el.value, ev);
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !$("#modal").hidden) closeModal(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); else { tick(now()); render(); } });
addEventListener("pagehide", save);

Object.assign(A, TUTO_ACTS, PROFILE_ACTS, CLOUD_ACTS, FRIENDS_ACTS, VISIT_ACTS, WATER_ACTS, TRADE_ACTS, LIKE_ACTS, GOAL_ACTS, NEWS3_ACTS, BALADES_ACTS, SG_ACTS);
/* ---------------- Boot ---------------- */
let nextButterfly = 0, nextWeed = 0;
function start() {
  const loaded = load();
  S = loaded ? migrate(loaded) : fresh();
  if (!loaded) S.orders = [genOrder(), genOrder()];
  applyTheme();
  const t = now(), away = t - (S.last || t);
  const before = S.plots.filter(p => plotState(p, t - away) === "ripe").length;
  tick(t);
  const ready = S.plots.filter(p => plotState(p, t) === "ripe").length;
  if (away > 8 * 3600000 && loaded) S.stats.comeback = 1;
  if (away > 120000 && loaded) toast(`Bon retour ! Absent ${dur(away)}${ready > before ? `, ${ready - before} plante${ready - before > 1 ? "s" : ""} ${ready - before > 1 ? "ont" : "a"} mûri` : ""}.`, 5000);
  if (S.hybRefundMsg) { const m = S.hybRefundMsg; delete S.hybRefundMsg; toast(`Recette${m.length > 1 ? "s" : ""} remboursée${m.length > 1 ? "s" : ""} : <b>${m.join(", ")}</b>. Découvre d’abord l’hybride à la Serre pour l’apprendre.`, 7000); save(); }
  CLOUD.sync(); // compte en ligne : récupère ou envoie la partie
  showGate(); // sans compte : écran de connexion
  // Première visite : c’est Mamie Lapine qui accueille (js/tuto.js).
  nextButterfly = t + rand(40, 90) * 1000; nextWeed = t + rand(70, 140) * 1000;
  render(true);
  let saveCount = 0;
  setInterval(() => {
    const t = now(); tick(t);
    if (!document.hidden && tab === "garden" && t >= nextButterfly) { spawnButterfly(); nextButterfly = t + rand(90, 200) * 1000; }
    // « Escargot de compagnie » : seul le temps passé jeu ouvert compte (pas la nuit, jeu fermé).
    if (!document.hidden) for (const q of S.plots) if (q.weed && q.weedKind === "snail") { q.snailTime = (q.snailTime || 0) + 1000; if (q.snailTime >= 3600e3) S.stats.petSnail = 1; }
    if (t >= nextWeed) {
      const cand = S.plots.filter(p => p.seed && !p.weed && plotState(p, t) !== "ripe" && p.grown > 0);
      if (cand.length) { const q = pick(cand); q.weed = true; q.weedAt = t; q.weedKind = PEST().key; q.snailTime = 0; }
      nextWeed = t + rand(80, 170) * 1000;
    }
    render();
    checkAch();
    watchNotifs(t);
    if (saveCount % 10 === 3) showDaily(); // nouveau jour : cadeau
    if (saveCount % 10 === 6) showSeason(); // nouvelle saison : annonce
    if (++saveCount % 5 === 0) save();
  }, 1000);
}
/* ---------------- Appli installable (PWA) ---------------- */
let installPrompt = null;
addEventListener("beforeinstallprompt", ev => { ev.preventDefault(); installPrompt = ev; if (tab === "garden") render(true); });
addEventListener("appinstalled", () => { installPrompt = null; render(true); toast("Potager idle est installé sur ton téléphone !"); });
A.install = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) {}
  installPrompt = null; render(true);
};
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // Une fois le jeu chargé, toutes ses images sont gardées pour jouer hors-ligne.
  addEventListener("load", () => setTimeout(() => { if (navigator.onLine) navigator.serviceWorker.ready.then(r => r.active?.postMessage("precache")).catch(() => {}); }, 4000));
  // Nouvelle version déployée : on sauvegarde puis on recharge une seule fois.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!hadController || reloaded) return; reloaded = true; save(); location.reload(); });
}
navigator.storage?.persist?.().catch(() => {});

start();
