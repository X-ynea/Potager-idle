"use strict";
/* Numéro de version affiché dans les Paramètres.
   À chaque mise à jour : changer APP_VERSION, le ?v= dans index.html et VERSION dans sw.js. */
const APP_VERSION = "0.12.3";
/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s);
const now = () => Date.now();
const fmt = n => Math.floor(n).toLocaleString("fr-FR");
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const coin = '<span class="coin" aria-hidden="true"></span>';
function dur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m} min ${String(r).padStart(2, "0")}` : `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
const xpNeed = l => Math.round(15 * Math.pow(l, 1.6));
const waterMs = () => UPG.water.values[S.upg.water] * 60000;
const speed = () => UPG.fert.values[S.upg.fert];
const stoves = () => UPG.stove.values[S.upg.stove];
const cnt = (bag, k) => bag[k] || 0;
const itemName = k => PLANTS[k] ? PLANTS[k].name : RECIPES[k].name;
const itemArt = k => PLANTS[k] ? cropArt(k) : dishArt(k);
const itemBag = k => PLANTS[k] ? S.crops : S.dishes;
const itemVal = k => PLANTS[k] ? PLANTS[k].sell : RECIPES[k].sell;
const itemXp = k => PLANTS[k] ? PLANTS[k].xp : RECIPES[k].xp;
const seedAvailable = k => { const d = PLANTS[k]; return d.hybrid ? S.hybrids.includes(k) : d.lvl <= S.level; };

/* ---------------- State ---------------- */
const SAVE_KEY = "petit-potager-v1";
let S;
function fresh() {
  const t = now();
  const P = () => ({ seed: null, grown: 0, last: t, waterUntil: 0, weed: false, lastSeed: null });
  const s = {
    v: 1, coins: 25, xp: 0, level: 1, settings: { theme: "light", vibrate: true },
    plots: Array.from({ length: 6 }, P),
    seeds: { radis: 3, laitue: 2 }, crops: {}, dishes: {}, recipes: [], discovered: [], hybrids: [],
    upg: { water: 0, hose: 0, fert: 0, stove: 0, auto: 0 },
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
function migrate(s) { const f = fresh(); for (const k in f) if (!(k in s)) s[k] = f[k]; for (const k in f.upg) if (!(k in s.upg)) s.upg[k] = 0; for (const k in f.stats) if (!(k in s.stats)) s.stats[k] = 0; for (const k in f.settings) if (!(k in s.settings)) s.settings[k] = f.settings[k]; return s; }
let lastSaveAt = 0;
function save() { try { S.last = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); lastSaveAt = S.last; } catch (e) {} }

/* ---------------- Simulation ---------------- */
function tick(t) {
  const sp = speed();
  for (const p of S.plots) {
    if (p.seed) {
      const need = PLANTS[p.seed].time * 1000;
      if (p.grown < need && !p.weed) {
        const end = S.upg.auto ? t : Math.min(t, p.waterUntil);
        const d = end - p.last;
        if (d > 0) p.grown = Math.min(need, p.grown + d * sp);
      }
    }
    p.last = t;
  }
  if (S.orders.length < 3 && t >= S.nextOrderAt) { S.orders.push(genOrder()); S.nextOrderAt = t + rand(90, 150) * 1000; }
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
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++;
    const un = unlocksAt(S.level);
    toast(`<b>Niveau ${S.level} !</b> ${un.length ? "Nouveau : " + un.join(", ") : "Ta main verte s’affirme."}`, 5200);
  }
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
function earn(n, x, y, xp) {
  S.coins += n;
  if (xp) addXp(xp);
  if (x != null) floatText(`+${fmt(n)}${xp ? ` · +${xp} XP` : ""}`, x, y, true);
}

function genOrder() {
  const pool = [];
  for (const k of ORDER) if (seedAvailable(k)) pool.push(k);
  for (const r of S.recipes) pool.push(r, r);
  const n = S.level >= 3 && Math.random() < .55 ? 2 : 1;
  const items = {};
  while (Object.keys(items).length < n && Object.keys(items).length < new Set(pool).size) {
    const k = pick(pool); if (items[k]) continue;
    if (PLANTS[k]) { const t = PLANTS[k].time; items[k] = Math.max(1, Math.min(5, Math.round(rand(1, 5.5 - t / 300)))); }
    else items[k] = Math.random() < .7 ? 1 : 2;
  }
  let val = 0, xp = 0;
  for (const k in items) { val += itemVal(k) * items[k]; xp += itemXp(k) * items[k]; }
  const v = Math.floor(Math.random() * VILLAGERS.length);
  return { id: Math.random().toString(36).slice(2, 9), v, line: Math.floor(Math.random() * 2), items, coins: Math.round(val * 1.6 + 5), xp: Math.round(xp * 1.4 + 3) };
}

/* ---------------- Actions ---------------- */
let tab = "garden", msub = "seeds", labSel = [null, null], resetArmed = false;
const A = {
  tab(arg) { tab = arg; render(true); window.scrollTo({ top: 0 }); },
  plot(i, ev) {
    const t = now(); tick(t);
    const p = S.plots[+i]; const st = plotState(p, t);
    const { x, y } = pos(ev);
    if (st === "empty") return openPicker(+i);
    if (st === "weed") { p.weed = false; S.stats.weeds++; earn(1, x, y, 2); toast("Escargot délogé. La plante repart."); }
    else if (st === "ripe") harvest(+i, x, y);
    else { p.waterUntil = t + waterMs(); floatText("Arrosé !", x, y); }
    commit();
  },
  plant(arg, ev) {
    // arg = "graine" (bac choisi au départ, puis le prochain bac vide) ou "bac:graine".
    let [i, k] = arg.includes(":") ? arg.split(":") : [null, arg];
    if (i == null) i = PICK.plot != null && !S.plots[PICK.plot]?.seed ? PICK.plot : S.plots.findIndex(p => !p.seed);
    const p = S.plots[+i]; const d = PLANTS[k];
    if (!p || p.seed) return;
    if (!cnt(S.seeds, k)) { if (S.coins < d.cost) return; S.coins -= d.cost; S.seeds[k] = 1; }
    S.seeds[k]--; const t = now();
    Object.assign(p, { seed: k, grown: 0, last: t, waterUntil: t + waterMs(), weed: false, lastSeed: k });
    S.lastPick = k; PICK.plot = null;
    if (ev) { const { x, y } = pos(ev); floatText(`${d.name} planté`, x, y); }
    buzz(8);
    // La fenêtre reste ouverte tant qu'il reste des bacs vides.
    if (!S.plots.some(q => !q.seed)) { closeModal(); toast("Tous les bacs sont plantés !"); }
    commit();
  },
  replantAll() {
    const t = now(); let n = 0, cost = 0;
    for (const p of S.plots) {
      if (p.seed) continue;
      const k = p.lastSeed || S.lastPick; if (!k || !seedAvailable(k) && !cnt(S.seeds, k)) continue;
      if (!cnt(S.seeds, k)) { if (S.coins < PLANTS[k].cost) continue; S.coins -= PLANTS[k].cost; cost += PLANTS[k].cost; S.seeds[k] = 1; }
      S.seeds[k]--; Object.assign(p, { seed: k, grown: 0, last: t, waterUntil: t + waterMs(), weed: false, lastSeed: k }); n++;
    }
    toast(n ? `${n} parcelle${n > 1 ? "s" : ""} replantée${n > 1 ? "s" : ""}${cost ? ` (${fmt(cost)} pièces de graines)` : ""}.` : "Rien à replanter : il manque des graines ou des pièces.");
    commit();
  },
  harvestAll(_, ev) {
    const t = now(); tick(t); let n = 0;
    S.plots.forEach((p, i) => { if (plotState(p, t) === "ripe") { harvest(i); n++; } });
    if (n) { const { x, y } = pos(ev); floatText(`${n} récolte${n > 1 ? "s" : ""}`, x, y); }
    commit();
  },
  waterAll(_, ev) {
    const t = now(); tick(t); let n = 0;
    for (const p of S.plots) { const st = plotState(p, t); if (st === "dry" || st === "growing") { p.waterUntil = t + waterMs(); n++; } }
    const { x, y } = pos(ev); floatText(n ? "Tout est arrosé !" : "Rien à arroser", x, y); commit();
  },
  msub(arg) { msub = arg; render(true); },
  buySeed(arg) { const [k, q] = arg.split(":"); const n = +q, c = PLANTS[k].cost * n; if (S.coins < c) return; S.coins -= c; S.seeds[k] = cnt(S.seeds, k) + n; commit(); },
  sell(arg, ev) {
    const [k, mode] = arg.split(":"); const bag = itemBag(k); const n = mode === "all" ? cnt(bag, k) : Math.min(1, cnt(bag, k));
    if (!n) return; bag[k] -= n; const { x, y } = pos(ev); earn(itemVal(k) * n, x, y); commit();
  },
  sellCrops(_, ev) {
    let tot = 0; for (const k in S.crops) { tot += S.crops[k] * PLANTS[k].sell; S.crops[k] = 0; }
    if (tot) { const { x, y } = pos(ev); earn(tot, x, y); } commit();
  },
  buyRecipe(r) { const d = RECIPES[r]; if (S.coins < d.price || S.recipes.includes(r)) return; S.coins -= d.price; S.recipes.push(r); toast(`Recette apprise : <b>${d.name}</b>. Direction la Cuisine !`); commit(); },
  buyUpg(u) { const step = UPG[u].steps[S.upg[u]]; if (!step || S.coins < step.cost || S.level < step.lvl) return; S.coins -= step.cost; S.upg[u]++; toast(`<b>${UPG[u].name}</b> amélioré.`); commit(); },
  buyPlot() {
    const step = PLOT_STEPS[S.plots.length - 6]; if (!step || S.coins < step.cost || S.level < step.lvl) return;
    S.coins -= step.cost; const t = now(); S.plots.push({ seed: null, grown: 0, last: t, waterUntil: 0, weed: false, lastSeed: null });
    if (modalView === viewPlotShop) closeModal();
    toast("Nouvelle parcelle bêchée !"); commit();
  },
  openPlotShop() { modalView = viewPlotShop; $("#modal").innerHTML = viewPlotShop(); openModal(); },
  cook(r) {
    const d = RECIPES[r]; if (S.cooking.length >= stoves()) return;
    for (const k in d.need) if (cnt(S.crops, k) < d.need[k]) return;
    for (const k in d.need) S.crops[k] -= d.need[k];
    S.cooking.push({ r, end: now() + d.time * 1000 }); commit();
  },
  serve(i, ev) {
    const c = S.cooking[+i]; if (!c || c.end > now()) return;
    S.cooking.splice(+i, 1); S.dishes[c.r] = cnt(S.dishes, c.r) + 1; S.stats.cooked++;
    const { x, y } = pos(ev); addXp(RECIPES[c.r].xp); floatText(`+${RECIPES[c.r].xp} XP`, x, y); commit();
  },
  labPick(k) {
    if (S.lab) return;
    if (labSel[0] === k) labSel[0] = null; else if (labSel[1] === k) labSel[1] = null;
    else if (!labSel[0]) labSel[0] = k; else labSel[1] = k;
    render(true);
  },
  labClear(i) { labSel[+i] = null; render(true); },
  labStart() {
    const [a, b] = labSel; if (!a || !b || a === b || S.lab) return;
    if (!cnt(S.crops, a) || !cnt(S.crops, b)) return;
    S.crops[a]--; S.crops[b]--; S.lab = { a, b, end: now() + LAB_TIME * 1000 }; labSel = [null, null]; commit();
  },
  labCollect() {
    const L = S.lab; if (!L || L.end > now()) return; S.lab = null;
    const h = HYBRID_BY_PAIR[pairKey(L.a, L.b)];
    if (h) {
      S.seeds[h] = cnt(S.seeds, h) + 2;
      if (!S.hybrids.includes(h)) { S.hybrids.push(h); addXp(25); openReveal(h, true); }
      else { addXp(6); openReveal(h, false); }
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
    S.orders = S.orders.filter(x => x !== o); S.stats.orders++;
    const { x, y } = pos(ev); earn(o.coins, x, y, o.xp);
    toast(`${VILLAGERS[o.v].name} te remercie chaleureusement !`);
    if (S.orders.length < 3) S.nextOrderAt = Math.min(S.nextOrderAt, now() + 60000);
    commit();
  },
  dismiss(id) { S.orders = S.orders.filter(o => o.id !== id); S.nextOrderAt = now() + 60000; commit(); },
  close() { closeModal(); },
  pickCat(c) { PICK.cat = c; render(true); $("#modal .sheet")?.scrollTo?.({ top: 0 }); },
  openSettings() { modalView = viewSettings; $("#modal").innerHTML = viewSettings(); openModal(); },
  setTheme(th) { S.settings.theme = th; applyTheme(); commit(); },
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
  openInv(k) {
    if (k) { UI.invCat = PLANTS[k] ? "crops" : "dishes"; UI.sel.inv = k; }
    modalView = viewInv; $("#modal").innerHTML = viewInv(); openModal();
  },
  plantFromInv(k) {
    const i = S.plots.findIndex(p => !p.seed);
    if (i < 0) { toast("Toutes les parcelles sont occupées. Récolte d’abord !"); return; }
    closeModal(); tab = "garden"; A.plant(`${i}:${k}`);
  },
  goRecipes() { tab = "market"; msub = "recipes"; render(true); window.scrollTo({ top: 0 }); },
  cookGo(r) { tab = "kitchen"; UI.sel.kitchen = r; render(true); window.scrollTo({ top: 0 }); },
  exportSave() {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
    const fallback = () => { UI.exportCode = code; render(true); const t = $("#save-out"); if (t) { t.focus(); t.select(); } toast("Copie le code affiché, puis colle-le sur ton autre appareil."); };
    if (!navigator.clipboard) return fallback();
    navigator.clipboard.writeText(code).then(() => { UI.exportCode = null; render(true); toast("Code copié ! Colle-le sur ton autre appareil, dans Importer une partie."); }, fallback);
  },
  toggleImport() { UI.importOpen = !UI.importOpen; render(true); if (UI.importOpen) $("#save-in")?.focus(); },
  importSave() {
    try {
      const s = JSON.parse(decodeURIComponent(escape(atob($("#save-in").value.trim())))); if (!s.plots) throw 0;
      S = migrate(s); UI.importOpen = false; applyTheme(); commit(); toast("Partie importée !");
    } catch (e) { toast("Ce code n’est pas valide. Vérifie qu’il est complet."); }
  },
  reset() {
    if (!resetArmed) { resetArmed = true; render(true); buzz([20, 60, 20]); setTimeout(() => { resetArmed = false; render(true); }, 5000); return; }
    resetArmed = false; const keepSettings = S.settings; S = fresh(); S.settings = keepSettings; S.orders = [genOrder(), genOrder()]; closeModal(); commit(); toast("Nouveau jardin. Bonne pousse !");
  },
};
function harvest(i, x, y) {
  const p = S.plots[i], k = p.seed, d = PLANTS[k];
  const n = Math.random() < .15 ? 2 : 1;
  S.crops[k] = cnt(S.crops, k) + n; S.stats.harvest++;
  if (!S.discovered.includes(k)) S.discovered.push(k);
  addXp(d.xp);
  Object.assign(p, { seed: null, grown: 0, weed: false, lastSeed: k });
  buzz(n > 1 ? [12, 40, 12] : 12);
  if (x != null) floatText(n > 1 ? `Récolte double ! +${d.xp} XP` : `+1 ${d.name} · +${d.xp} XP`, x, y);
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
  const dark = th === "dark" || (th === "system" && darkQuery.matches);
  document.getElementById("theme-color")?.setAttribute("content", dark ? "#172016" : "#f2f9e6");
}
darkQuery.addEventListener?.("change", () => S && applyTheme());
const CHEVRON = `<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_UP = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
const ICON_DOWN = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
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
    <div class="sheet-head"><h2>Paramètres</h2><button class="btn ghost sm" data-act="close">Fermer</button></div>
    ${installPrompt ? `<div class="install"><p>Installe le jeu sur ton téléphone pour y jouer comme une vraie appli.</p><button class="btn sm" data-act="install">Installer</button></div>` : ""}
    <div class="set-group"><h3>Apparence</h3>
      <div class="seg">${[["light", "Clair"], ["dark", "Sombre"], ["system", "Auto"]].map(([k, l]) => `<button data-act="setTheme" data-arg="${k}" aria-pressed="${th === k}">${l}</button>`).join("")}</div>
      <p class="small muted" style="margin:0">« Auto » suit le réglage de ton téléphone. Le jardin reste ensoleillé dans tous les cas.</p>
    </div>
    <div class="set-group"><h3>Confort</h3>
      <div class="set-row"><span>Vibrations à la récolte</span><button class="switch" role="switch" data-act="toggleVibrate" aria-checked="${S.settings.vibrate}" aria-label="Vibrations"></button></div>
    </div>
    <div class="set-group"><h3>Sauvegarde</h3>
      <div class="save-status"><span class="ok-dot"></span><div><b>Partie sauvegardée</b><span>${savedAgo()} · sur cet appareil</span></div></div>
      <div class="set-list">
        <button class="set-link" data-act="exportSave">${ICON_UP}<span><b>Exporter ma partie</b><small>Copie un code pour continuer sur un autre appareil</small></span>${CHEVRON}</button>
        ${UI.exportCode ? `<textarea id="save-out" readonly aria-label="Code de sauvegarde">${UI.exportCode}</textarea>` : ""}
        <button class="set-link" data-act="toggleImport" aria-expanded="${!!UI.importOpen}">${ICON_DOWN}<span><b>Importer une partie</b><small>Colle le code venant d’un autre appareil</small></span>${CHEVRON}</button>
        ${UI.importOpen ? `<div class="import-box"><textarea id="save-in" placeholder="Colle ton code ici"></textarea><p class="small muted" style="margin:0">Attention : la partie actuelle sera remplacée.</p><button class="btn" data-act="importSave">Importer</button></div>` : ""}
      </div>
    </div>
    <div class="set-group"><h3>Statistiques</h3>
      <div class="stats">${mi("Récoltes", fmt(S.stats.harvest))}${mi("Plats cuisinés", fmt(S.stats.cooked))}${mi("Commandes", fmt(S.stats.orders))}${mi("Papillons", fmt(S.stats.butterflies))}${mi("Hybrides", `${S.hybrids.length} / ${ORDER.filter(k => PLANTS[k].hybrid).length}`)}${mi("Escargots", fmt(S.stats.weeds))}</div>
    </div>
    <div class="set-group danger"><h3>Zone sensible</h3>
      <button class="set-link ${resetArmed ? "armed" : ""}" data-act="reset">${ICON_RESET}<span><b>${resetArmed ? "Touche encore pour tout effacer" : "Recommencer à zéro"}</b><small>${resetArmed ? "Cette action est définitive" : "Efface toute ta progression (tes réglages sont gardés)"}</small></span></button>
    </div>
    <div class="set-group"><h3>À propos</h3>
      <button class="btn ghost" data-act="checkUpdate">Vérifier les mises à jour</button>
      <p class="version">potager-idle · version ${APP_VERSION}</p>
    </div>
  </div>`;
}

/* ---------------- Views ---------------- */
function views_garden() {
  const t = now();
  const ripe = S.plots.filter(p => plotState(p, t) === "ripe").length;
  const empty = S.plots.filter(p => !p.seed).length;
  const thirsty = S.plots.filter(p => plotState(p, t) === "dry").length;
  const basketKeys = ORDER.filter(k => cnt(S.crops, k) > 0).concat(RORDER.filter(r => cnt(S.dishes, r) > 0));
  return `${installPrompt && isPhone() ? `<div class="install"><p>Installe potager-idle sur ton téléphone pour y jouer comme une vraie appli, même hors-ligne.</p><button class="btn sm" data-act="install">Installer</button></div>` : ""}
  <section class="panel">
    <div class="garden-tools">
      <button class="btn" data-act="harvestAll" ${ripe ? "" : "disabled"}>Tout récolter${ripe ? ` (${ripe})` : ""}</button>
      ${S.upg.hose ? `<button class="btn water" data-act="waterAll">Tout arroser${thirsty ? ` (${thirsty})` : ""}</button>` : ""}
      <button class="btn ghost" data-act="replantAll" ${empty ? "" : "disabled"}>Replanter</button>
    </div>
    <p class="garden-hint">${S.upg.auto ? "Arroseur automatique actif" : `L’eau tient ${UPG.water.values[S.upg.water]} min`}</p>
    <div class="garden"><div class="plots">
      ${S.plots.map((p, i) => `<button class="plot" data-act="plot" data-arg="${i}" data-plot="${i}"></button>`).join("")}
    </div></div>
  </section>
  <section class="panel">
    <div class="row spread"><h2>Inventaire</h2><button class="btn ghost sm" data-act="openInv">Tout voir</button></div>
    ${basketKeys.length ? `<div class="tiles mini">${basketKeys.slice(0, 10).map(k => tile(itemArt(k), { act: "openInv", arg: k, label: itemName(k), count: cnt(itemBag(k), k) })).join("")}</div>` : `<p class="muted small" style="margin:0">Ton inventaire est vide. Récolte tes premiers radis !</p>`}
  </section>
`;
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
  if (st === "weed") inner += `<img class="pest snail" src="assets/img/ui-snail.webp" alt="">`;
  const r = ringValues(p, st, t); // valeurs posées dès la création, sans animation depuis zéro
  inner += `<span class="ring" title="${d.name}"><svg viewBox="0 0 40 40" aria-hidden="true">
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
      const ring = el.querySelector(".ring");
      if (ring) ring.title = st === "ripe" ? `${PLANTS[p.seed].name} : prêt !` : st === "dry" ? `${PLANTS[p.seed].name} : a soif` : st === "weed" ? `${PLANTS[p.seed].name} : bloqué par un escargot` : `${PLANTS[p.seed].name} : prêt dans ${dur((need - p.grown) / speed())}`;
    }
  });
}

/* ---------------- Composants : cases, fiche détaillée, ingrédients ---------------- */
const UI = { sel: {}, invCat: "crops", sellCat: "crops" };
const CHECK = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#3fae49"/><path d="M4.5 8.2l2.3 2.3 4.7-4.8" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LOCK = `<svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="7" rx="1.6" fill="#8a9a80"/><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="#8a9a80" stroke-width="1.6" fill="none"/></svg>`;
const priceTag = n => `${coin}<span class="num">${fmt(n)}</span>`;
const canCook = r => Object.entries(RECIPES[r].need).every(([k, q]) => cnt(S.crops, k) >= q);
const mystery = k => `<div class="sil">${plantArt(k, 3)}</div>`;

function tile(art, o) {
  return `<div class="tile-wrap"><button class="tile${o.sel ? " sel" : ""}${o.locked ? " locked" : ""}" data-act="${o.act}" data-arg="${o.arg || ""}" aria-pressed="${!!o.sel}" aria-label="${o.label}">${art}` +
    (o.count ? `<span class="cnt num">${fmt(o.count)}</span>` : "") +
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
    const h = cnt(S.crops, k), known = !PLANTS[k].hybrid || S.hybrids.includes(k);
    return `<div class="ing ${h >= q ? "ok" : "miss"}">${known ? cropArt(k) : mystery(k)}<span>${known ? PLANTS[k].name : "Hybride à découvrir"}</span><b class="num">${h}/${q}</b></div>`;
  }).join("")}</div>`;
}

/* ---------------- Inventaire (récoltes, graines, plats) ---------------- */
const CATS = [["crops", "Récoltes"], ["seeds", "Graines"], ["dishes", "Plats"]];
const catBag = c => c === "seeds" ? S.seeds : c === "dishes" ? S.dishes : S.crops;
const catCount = c => Object.values(catBag(c)).reduce((a, b) => a + b, 0);
function catTabs(cats, cur, act) {
  return `<div class="subtabs" style="grid-template-columns:repeat(${cats.length},1fr)">${cats.map(([c, l]) => `<button data-act="${act}" data-arg="${c}" aria-pressed="${cur === c}">${l} <span class="num">${catCount(c)}</span></button>`).join("")}</div>`;
}
function invBody(ctx, cat) {
  const bag = catBag(cat);
  const keys = (cat === "dishes" ? RORDER : ORDER).filter(k => cnt(bag, k) > 0);
  let k = UI.sel[ctx]; if (!keys.includes(k)) k = keys[0];
  let det;
  if (!k) {
    det = `<div class="detail empty-note">${cat === "dishes" ? dishArt("soupe") : plantArt("radis", 2)}<span>${{ crops: "Aucune récolte pour l’instant. Va faire un tour au jardin !", seeds: "Aucune graine en stock. Le marché en vend.", dishes: "Aucun plat pour l’instant. Ce que tu cuisines arrive ici." }[cat]}</span></div>`;
  } else if (cat === "seeds") {
    const d = PLANTS[k];
    det = detail(ctx, seedArt(k), `Graines de ${d.name.toLowerCase()}`, d.desc, mi("En stock", cnt(bag, k)) + mi("Pousse", dur(d.time * 1000 / speed())) + mi("Vente", fmt(d.sell)),
      "", `<button class="btn big" data-act="plantFromInv" data-arg="${k}">Planter au jardin</button>`);
  } else {
    const n = cnt(bag, k), v = itemVal(k);
    const uses = cat === "crops" ? RORDER.filter(r => RECIPES[r].need[k]) : [];
    det = detail(ctx, itemArt(k), itemName(k), (PLANTS[k] || RECIPES[k]).desc, mi("En stock", n) + mi("Prix", fmt(v)) + mi("Total", fmt(n * v)),
      uses.length ? `<p class="uses">Sert pour : ${uses.map(r => RECIPES[r].name).join(", ")}</p>` : "",
      `<button class="btn big ghost" data-act="sell" data-arg="${k}:one">Vendre 1 · ${priceTag(v)}</button><button class="btn big" data-act="sell" data-arg="${k}:all">Vendre tout · ${priceTag(n * v)}</button>`);
  }
  const grid = keys.map(x => tile(cat === "seeds" ? seedArt(x) : itemArt(x), { act: "sel", arg: `${ctx}:${x}`, sel: x === k, label: itemName(x), count: cnt(bag, x) })).join("");
  const fill = Math.max(8, Math.ceil(keys.length / 4) * 4) - keys.length;
  return det + `<div class="tiles">${grid}${emptyTiles(fill)}</div>`;
}
function viewInv() {
  return `<div class="sheet tall" role="dialog" aria-modal="true" aria-label="Inventaire"><div class="sheet-head"><h2>Inventaire</h2><button class="btn ghost sm" data-act="close">Fermer</button></div>${catTabs(CATS, UI.invCat, "invCat")}${invBody("inv", UI.invCat)}</div>`;
}

/* ---------------- Marché ---------------- */
function marketSeeds() {
  let k = UI.sel.seeds; if (!PLANTS[k]) k = ORDER.find(seedAvailable);
  const d = PLANTS[k], av = seedAvailable(k), myst = d.hybrid && !av;
  const det = myst
    ? detail("seeds", mystery(k), "Variété mystère", `Indice : ${d.hint}`, mi("Où la trouver", "Serre"), "", `<button class="btn big ghost" data-act="tab" data-arg="lab">Essayer un croisement</button>`)
    : detail("seeds", seedArt(k), d.name + (d.hybrid ? ` <small class="hy">Hybride</small>` : ""), d.desc,
      mi("Pousse", dur(d.time * 1000 / speed())) + mi("Vente", fmt(d.sell)) + mi("XP", "+" + d.xp) + mi("En stock", cnt(S.seeds, k)), "",
      av ? `<button class="btn big" data-act="buySeed" data-arg="${k}:1" ${S.coins < d.cost ? "disabled" : ""}>Acheter · ${priceTag(d.cost)}</button><button class="btn big ghost" data-act="buySeed" data-arg="${k}:5" ${S.coins < d.cost * 5 ? "disabled" : ""}>×5 · ${priceTag(d.cost * 5)}</button>`
        : `<button class="btn big" disabled>Disponible au niveau ${d.lvl}</button>`);
  const grid = ORDER.map(x => {
    const p = PLANTS[x], a = seedAvailable(x), m = p.hybrid && !a;
    return tile(m ? mystery(x) : seedArt(x), { act: "sel", arg: "seeds:" + x, sel: x === k, label: m ? "Variété mystère" : p.name, locked: !a && !m, count: cnt(S.seeds, x), under: a ? priceTag(p.cost) : m ? "???" : `Niv. ${p.lvl}` });
  }).join("");
  return det + `<div class="tiles">${grid}</div>`;
}
function marketRecipes() {
  let r = UI.sel.recipes;
  if (!RECIPES[r]) r = RORDER.find(x => !S.recipes.includes(x) && RECIPES[x].lvl <= S.level) || RORDER[0];
  const d = RECIPES[r], own = S.recipes.includes(r), lock = d.lvl > S.level;
  const act = own ? `<button class="btn big ghost" data-act="cookGo" data-arg="${r}">Déjà apprise · aller en cuisine</button>`
    : lock ? `<button class="btn big" disabled>Disponible au niveau ${d.lvl}</button>`
    : `<button class="btn big" data-act="buyRecipe" data-arg="${r}" ${S.coins < d.price ? "disabled" : ""}>Apprendre · ${priceTag(d.price)}</button>`;
  const det = detail("recipes", dishArt(r), d.name, d.desc, mi("Cuisson", dur(d.time * 1000)) + mi("Vente", fmt(d.sell)) + mi("XP", "+" + d.xp), ingList(d.need), act);
  const grid = RORDER.map(x => {
    const e = RECIPES[x], o = S.recipes.includes(x), l = e.lvl > S.level;
    return tile(dishArt(x), { act: "sel", arg: "recipes:" + x, sel: x === r, label: e.name, locked: l, check: o, under: o ? "Apprise" : l ? `Niv. ${e.lvl}` : priceTag(e.price) });
  }).join("");
  return det + `<div class="tiles">${grid}</div>`;
}
function marketSell() {
  const tot = ORDER.reduce((s, k) => s + cnt(S.crops, k) * PLANTS[k].sell, 0);
  return `${catTabs([["crops", "Récoltes"], ["dishes", "Plats"]], UI.sellCat, "sellCat")}
    ${UI.sellCat === "crops" && tot ? `<button class="btn peach" data-act="sellCrops">Vendre toute la récolte · ${priceTag(tot)}</button>` : ""}
    ${invBody("sell", UI.sellCat)}
    <p class="small muted" style="margin:0">Garde des ingrédients pour la Cuisine et les commandes du Village : elles rapportent plus.</p>`;
}
function marketUpgrades() {
    const plotStep = PLOT_STEPS[S.plots.length - 6];
    const rows = [];
    rows.push(`<div class="item"><img class="upg-img" src="assets/img/upg-plot.webp" alt=""><div class="t"><b>Nouvelle parcelle</b><span>${S.plots.length} / ${MAX_PLOTS} parcelles</span></div><div class="acts">${plotStep ? (S.level < plotStep.lvl ? `<span class="small muted">Niveau ${plotStep.lvl}</span>` : `<button class="btn sm" data-act="buyPlot" ${S.coins < plotStep.cost ? "disabled" : ""}>${coin}${fmt(plotStep.cost)}</button>`) : `<span class="small muted"><b>Complet</b></span>`}</div></div>`);
    for (const u in UPG) {
      const U = UPG[u], lv = S.upg[u], step = U.steps[lv], cur = U.values[lv], nxt = U.values[lv + 1];
      rows.push(`<div class="item"><img class="upg-img" src="assets/img/upg-${u}.webp" alt=""><div class="t"><b>${U.name}${U.steps.length > 1 ? ` <small class="muted">${lv}/${U.steps.length}</small>` : ""}</b><span>${U.desc(cur)}${step && U.desc(nxt) !== U.desc(cur) ? ` → ${U.desc(nxt)}` : ""}</span></div>
      <div class="acts">${!step ? `<span class="small muted"><b>Acquis</b></span>` : S.level < step.lvl ? `<span class="small muted">Niveau ${step.lvl}</span>` : `<button class="btn sm" data-act="buyUpg" data-arg="${u}" ${S.coins < step.cost ? "disabled" : ""}>${coin}${fmt(step.cost)}</button>`}</div></div>`);
    }
  return `<div class="list">${rows.join("")}</div>`;
}
function views_market() {
  const sub = [["seeds", "Graines"], ["recipes", "Recettes"], ["upgrades", "Bonus"], ["sell", "Vendre"]];
  const body = { seeds: marketSeeds, recipes: marketRecipes, upgrades: marketUpgrades, sell: marketSell }[msub]();
  return `<section class="panel"><div class="row spread"><h2>Marché</h2><span class="pill">${coin}<span class="num">${fmt(S.coins)}</span></span></div>
    <div class="subtabs">${sub.map(([k, l]) => `<button data-act="msub" data-arg="${k}" aria-pressed="${msub === k}">${l}</button>`).join("")}</div>${body}</section>`;
}

/* ---------------- Cuisine ---------------- */
function views_kitchen() {
  const t = now(), n = stoves();
  const slots = [];
  for (let i = 0; i < n; i++) {
    const c = S.cooking[i];
    if (!c) slots.push(`<div class="stove"><img class="stove-img" src="assets/img/stove-off.webp" alt=""><span class="muted small">Fourneau libre</span></div>`);
    else if (c.end <= t) slots.push(`<div class="stove done">${dishArt(c.r)}<b class="small">${RECIPES[c.r].name}</b><button class="btn sm" data-act="serve" data-arg="${i}">Récupérer</button></div>`);
    else slots.push(`<div class="stove busy"><div class="stove-pic"><img class="stove-img" src="assets/img/stove-on.webp" alt=""><span class="stove-dish">${dishArt(c.r)}</span></div><b class="small">${RECIPES[c.r].name}</b><div class="pbar"><i data-pb="${c.end}" data-pd="${RECIPES[c.r].time * 1000}"></i></div><span class="small muted num" data-left="${c.end}"></span></div>`);
  }
  const head = `<section class="panel"><div class="row spread"><h2>Cuisine</h2><span class="small muted">${n} fourneau${n > 1 ? "x" : ""}</span></div><div class="stoves">${slots.join("")}</div></section>`;
  if (!S.recipes.length) return head + `<section class="panel"><div class="empty-note">${dishArt("salade")}<span>${S.level >= 2 ? "Apprends ta première recette au Marché." : "La cuisine ouvre au niveau 2 avec la Salade croquante."}</span>${S.level >= 2 ? `<button class="btn" data-act="goRecipes">Voir les recettes</button>` : ""}</div></section>`;
  let r = UI.sel.kitchen; if (!S.recipes.includes(r)) r = S.recipes.find(canCook) || S.recipes[0];
  const d = RECIPES[r], ok = canCook(r), free = S.cooking.length < n;
  const btn = `<button class="btn big peach" data-act="cook" data-arg="${r}" ${ok && free ? "" : "disabled"}>${!ok ? "Il manque des ingrédients" : !free ? "Fourneaux occupés" : `Cuisiner · ${dur(d.time * 1000)}`}</button>`;
  const det = detail("kitchen", dishArt(r), d.name, d.desc, mi("Cuisson", dur(d.time * 1000)) + mi("Vente", fmt(d.sell)) + mi("XP", "+" + d.xp) + mi("En stock", cnt(S.dishes, r)), ingList(d.need), btn);
  const grid = S.recipes.map(x => tile(dishArt(x), { act: "sel", arg: "kitchen:" + x, sel: x === r, label: RECIPES[x].name, dot: canCook(x) })).join("") +
    `<div class="tile-wrap"><button class="tile more" data-act="goRecipes" aria-label="Apprendre des recettes">+</button><span class="under">Recettes</span></div>`;
  return head + `<section class="panel">${det}<div class="tiles">${grid}</div></section>`;
}

function views_lab() {
  const t = now();
  const herb = `<section class="panel"><div class="row spread"><h2>Herbier</h2><span class="small muted num">${new Set([...S.discovered, ...S.hybrids]).size} / ${ORDER.length}</span></div>
    <div class="herbier">${ORDER.map(k => { const d = PLANTS[k]; const known = S.discovered.includes(k) || S.hybrids.includes(k); return `
      <div class="herb ${known ? "" : "unknown"}">${plantArt(k, 3)}${d.hybrid ? `<span class="hy">Hybride</span>` : ""}<b>${known || !d.hybrid ? d.name : "???"}</b><span class="muted">${known ? `${fmt(d.sell)} pièces` : d.hybrid ? d.hint : `Niveau ${d.lvl}`}</span></div>`; }).join("")}</div></section>`;
  if (S.level < 3) return `<section class="panel"><h2>Serre</h2><div class="empty-note"><img class="banner-img" src="assets/img/greenhouse.webp" alt=""><span>La Serre ouvre au niveau 3. Tu pourras y croiser deux récoltes pour découvrir des variétés hybrides.</span></div></section>${herb}`;
  let top;
  if (S.lab) {
    const done = S.lab.end <= t;
    top = `<div class="lab-slots"><div class="slot filled">${cropArt(S.lab.a)}</div><img class="cauldron bubbling" src="assets/img/cauldron.webp" alt=""><div class="slot filled">${cropArt(S.lab.b)}</div></div>
      ${done ? `<button class="btn peach" data-act="labCollect">Découvrir le résultat</button>` : `<div class="pbar"><i data-pb="${S.lab.end}" data-pd="${LAB_TIME * 1000}"></i></div><span class="small muted num" data-left="${S.lab.end}"></span>`}`;
  } else {
    const have = ORDER.filter(k => cnt(S.crops, k) > 0);
    const [a, b] = labSel;
    top = `<div class="lab-slots">${[a, b].map((k, i) => k ? `<button class="slot filled" data-act="labClear" data-arg="${i}" aria-label="Retirer ${PLANTS[k].name}">${cropArt(k)}<small>${PLANTS[k].name}</small></button>` : `<div class="slot"><span class="small muted">Choisis une récolte</span></div>`).join('<img class="cauldron" src="assets/img/cauldron.webp" alt="">')}</div>
      ${have.length ? `<div class="basket">${have.map(k => `<button class="chip" data-act="labPick" data-arg="${k}" aria-pressed="${labSel.includes(k)}">${cropArt(k)}${PLANTS[k].name} · ${cnt(S.crops, k)}</button>`).join("")}</div>` : `<p class="small muted" style="margin:0">Il te faut des récoltes en stock pour faire un croisement.</p>`}
      <div class="row"><button class="btn" data-act="labStart" ${a && b ? "" : "disabled"}>Croiser · ${dur(LAB_TIME * 1000)}</button><span class="small muted">Consomme 1 de chaque. Bonne combinaison : 2 graines hybrides.</span></div>`;
  }
  return `<section class="panel"><div class="lab-head"><img src="assets/img/greenhouse.webp" alt=""><div><h2>Serre à hybrides</h2><p class="small muted" style="margin:0">Croise deux récoltes pour découvrir de nouvelles variétés.</p></div></div>${top}</section>${herb}`;
}

function views_village() {
  const t = now();
  const cards = S.orders.map(o => { const v = VILLAGERS[o.v]; const ok = Object.entries(o.items).every(([k, q]) => cnt(itemBag(k), k) >= q); return `
    <div class="order"><div class="avatar">${avatar(v)}</div><div style="min-width:0"><div class="who">${v.name}</div><div class="say">« ${v.say[o.line]} »</div>
      <div class="need" style="margin-top:6px">${Object.entries(o.items).map(([k, q]) => `<span class="chip ${cnt(itemBag(k), k) < q ? "miss" : ""}" title="${itemName(k)}">${itemArt(k)}${cnt(itemBag(k), k)}/${q}</span>`).join("")}</div>
      <div class="foot"><span class="reward">${coin}${fmt(o.coins)} <span class="muted">+${o.xp} XP</span></span><span style="margin-left:auto" class="row"><button class="btn ghost sm" data-act="dismiss" data-arg="${o.id}">Refuser</button><button class="btn sm" data-act="deliver" data-arg="${o.id}" ${ok ? "" : "disabled"}>Livrer</button></span></div></div></div>`; }).join("");
  return `<section class="panel"><div class="row spread"><h2>Commandes du village</h2><span class="small muted">${S.orders.length} / 3</span></div>
    ${cards || `<div class="empty-note"><span>Aucune commande pour le moment.</span></div>`}
    ${S.orders.length < 3 ? `<p class="small muted num" style="margin:0">Prochaine visite dans <span data-left="${S.nextOrderAt}"></span></p>` : ""}</section>`;
}

/* ---------------- Render loop ---------------- */
const VIEWS = { garden: views_garden, market: views_market, kitchen: views_kitchen, lab: views_lab, village: views_village };
let lastSig = "";
function sig(t) {
  const base = [tab, S.coins, S.level, msub, resetArmed, labSel.join(","), JSON.stringify(UI)].join("|");
  switch (tab) {
    case "garden": return base + JSON.stringify([S.plots.length, S.upg, S.crops, S.dishes, S.plots.filter(p => !p.seed).length, S.plots.filter(p => plotState(p, t) === "ripe").length, S.plots.filter(p => plotState(p, t) === "dry").length]);
    case "market": return base + JSON.stringify([S.seeds, S.crops, S.dishes, S.recipes, S.upg, S.plots.length, S.hybrids]);
    case "kitchen": return base + JSON.stringify([S.recipes, S.crops, S.dishes, S.cooking.map(c => c.r + (c.end <= t))]);
    case "lab": return base + JSON.stringify([S.crops, S.lab && (S.lab.a + S.lab.b + (S.lab.end <= t)), S.hybrids, S.discovered]);
    case "village": return base + JSON.stringify([S.orders.map(o => o.id), S.crops, S.dishes, S.orders.length < 3]);
  }
}
function render(force) {
  const t = now();
  const s = sig(t);
  if (force || s !== lastSig) {
    // Le jardin garde ses parcelles existantes : seules celles qui changent sont redessinées,
    // pour que les anneaux et le halo ne repartent pas de zéro à chaque action.
    const oldGarden = tab === "garden" ? $("#view .garden") : null;
    $("#view").innerHTML = VIEWS[tab]();
    if (oldGarden) {
      const fresh = $("#view .garden");
      if (fresh && fresh.querySelectorAll("[data-plot]").length === oldGarden.querySelectorAll("[data-plot]").length) fresh.replaceWith(oldGarden);
    }
    lastSig = s;
    if (modalView && !$("#modal").hidden) {
      const sc = $("#modal .sheet")?.scrollTop || 0;
      const kept = [...document.querySelectorAll("#modal textarea")].map(t => [t.id, t.value]);
      $("#modal").innerHTML = modalView();
      for (const [id, v] of kept) { const t = document.getElementById(id); if (t) t.value = v; }
      const sh = $("#modal .sheet"); if (sh) sh.scrollTop = sc;
    }
    document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.arg === tab));
  }
  live(t);
}
function live(t) {
  $("#coins").textContent = fmt(S.coins);
  $("#lvl").textContent = "Niveau " + S.level;
  $("#xpt").textContent = `${fmt(S.xp)} / ${fmt(xpNeed(S.level))} XP`;
  $("#xpb").style.width = (S.xp / xpNeed(S.level) * 100).toFixed(1) + "%";
  if (tab === "garden") updateGarden(t);
  document.querySelectorAll("[data-pb]").forEach(el => { const e = +el.dataset.pb, d = +el.dataset.pd; el.style.width = Math.min(100, (1 - (e - t) / d) * 100).toFixed(1) + "%"; });
  document.querySelectorAll("[data-left]").forEach(el => { el.textContent = dur(+el.dataset.left - t); });
  // Badges & tab title
  const gN = S.plots.filter(p => { const st = plotState(p, t); return st === "ripe" || st === "dry" || st === "weed"; }).length;
  const kN = S.cooking.filter(c => c.end <= t).length;
  const lN = S.lab && S.lab.end <= t ? 1 : 0;
  const vN = S.orders.filter(o => Object.entries(o.items).every(([k, q]) => cnt(itemBag(k), k) >= q)).length;
  badge("b-garden", gN); badge("b-kitchen", kN); badge("b-lab", lN); badge("b-village", vN);
  const total = gN + kN + lN;
  const title = total ? `(${total}) potager-idle` : "potager-idle";
  if (document.title !== title) document.title = title;
}
function badge(id, n) { const el = document.getElementById(id); el.hidden = !n; el.textContent = n; }

/* ---------------- Modal, toasts, fx ---------------- */
const PICK = { plot: null, order: [], cat: "base" };
function openPicker(i) {
  PICK.plot = i;
  const keys = ORDER.filter(k => seedAvailable(k) || cnt(S.seeds, k) > 0);
  keys.sort((a, b) => (b === S.lastPick) - (a === S.lastPick) || (cnt(S.seeds, b) > 0) - (cnt(S.seeds, a) > 0));
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
    <div class="sheet-head"><h2>Nouvelle parcelle</h2><button class="btn ghost sm" data-act="close">Fermer</button></div>
    <div class="detail"><div class="d-head"><div class="d-art"><img src="assets/img/upg-plot.webp" alt="" style="width:100%;height:100%;object-fit:contain"></div>
      <div class="d-txt"><h3>Un bac de plus</h3><p>Une parcelle supplémentaire pour faire pousser plus de plantes en même temps.</p></div></div>
      <div class="meta">${mi("Parcelles", `${S.plots.length} → ${S.plots.length + 1}`)}${mi("Prix", fmt(step.cost))}${mi("Tes pièces", fmt(S.coins))}</div>
      <div class="d-acts"><button class="btn big" data-act="buyPlot" ${lock || poor ? "disabled" : ""}>${lock ? `Disponible au niveau ${step.lvl}` : poor ? `Il te manque ${fmt(step.cost - S.coins)} pièces` : `Acheter · ${coin}${fmt(step.cost)}`}</button></div>
    </div></div>`;
}
function viewPicker() {
  const free = S.plots.filter(p => !p.seed).length;
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="Choisir une graine">
    <div class="sheet-head"><div><h2>Que planter ?</h2><span class="small muted num">${free} bac${free > 1 ? "s" : ""} vide${free > 1 ? "s" : ""}</span></div><button class="btn ghost sm" data-act="close">Fermer</button></div>
    ${(() => { const nb = PICK.order.filter(k => !PLANTS[k].hybrid).length, nh = PICK.order.filter(k => PLANTS[k].hybrid).length;
      return `<div class="subtabs" style="grid-template-columns:1fr 1fr">${[["base", "Plantes", nb], ["hybrid", "Hybrides", nh]].map(([c, l, n]) => `<button data-act="pickCat" data-arg="${c}" aria-pressed="${PICK.cat === c}">${l} <span class="num">${n}</span></button>`).join("")}</div>`; })()}
    ${PICK.cat === "hybrid" && !PICK.order.some(k => PLANTS[k].hybrid) ? `<div class="empty-note"><span>Aucun hybride pour l’instant. Croise deux récoltes dans la Serre pour en découvrir.</span></div>` : ""}
    <div class="list">${PICK.order.filter(k => !!PLANTS[k].hybrid === (PICK.cat === "hybrid")).map(k => { const d = PLANTS[k], own = cnt(S.seeds, k); return `
      <div class="item">${seedArt(k)}<div class="t"><b>${d.name}</b><span>${dur(d.time * 1000 / speed())} · se vend ${fmt(d.sell)} · +${d.xp} XP</span></div>
      <div class="acts">${own ? `<button class="btn sm" data-act="plant" data-arg="${k}">Planter · ${own} en stock</button>` : `<button class="btn ghost sm" data-act="plant" data-arg="${k}" ${S.coins < d.cost ? "disabled" : ""}>Acheter et planter · ${coin}${fmt(d.cost)}</button>`}</div></div>`; }).join("")}</div></div>`;
}
function openReveal(h, isNew) {
  const d = PLANTS[h];
  $("#modal").innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Résultat du croisement" style="justify-items:center;text-align:center">
    <div class="reveal-art">${plantArt(h, 3)}</div>
    <h2>${isNew ? "Nouvelle variété : " : ""}${d.name}</h2>
    <p class="muted" style="margin:0">${isNew ? `Tu as découvert un hybride ! 2 graines t’attendent, +25 XP, et ses graines sont maintenant vendues au marché.` : `Encore un joli croisement : +2 graines de ${d.name.toLowerCase()}.`}<br>Pousse en ${dur(d.time * 1000)} · se vend ${fmt(d.sell)} pièces.</p>
    <button class="btn" data-act="close">Super !</button></div>`;
  openModal();
}
// Le bouton retour d’Android ferme la fenêtre au lieu de quitter l’appli.
function openModal() {
  const wasOpen = !$("#modal").hidden;
  $("#modal").hidden = false;
  if (!wasOpen) history.pushState({ modal: 1 }, "");
}
let modalView = null;
function closeModal(fromBack) {
  modalView = null; UI.importOpen = false; UI.exportCode = null;
  if ($("#modal").hidden) return;
  $("#modal").hidden = true; $("#modal").innerHTML = "";
  if (!fromBack && history.state && history.state.modal) history.back();
}
addEventListener("popstate", () => closeModal(true));
function toast(html, ms = 3500) {
  const el = document.createElement("div"); el.className = "toast"; el.innerHTML = html;
  $("#toasts").appendChild(el); setTimeout(() => el.remove(), ms);
  while ($("#toasts").children.length > 3) $("#toasts").firstChild.remove();
}
function floatText(txt, x, y, gold) {
  const el = document.createElement("span"); el.className = "float" + (gold ? " gold" : "");
  el.textContent = txt; el.style.left = x + "px"; el.style.top = y + "px";
  $("#fx").appendChild(el); setTimeout(() => el.remove(), 1200);
}
const BCOL = [["#ff9fc0", "#ff6f9a"], ["#ffd36b", "#f4a52a"], ["#9fd0ff", "#5aa7ee"], ["#c9a5ff", "#9a6cf0"]];
function spawnButterfly() {
  const [a, b] = pick(BCOL);
  const el = document.createElement("button");
  el.className = "butterfly"; el.setAttribute("aria-label", "Attraper le papillon");
  el.style.top = rand(22, 70) + "vh"; el.style.left = "0";
  if (Math.random() < .5) el.classList.add("rtl"); // arrive de la droite une fois sur deux el.style.animationDuration = rand(11, 16) + "s";
  el.innerHTML = `<span class="bf"><img src="assets/img/ui-butterfly.webp" alt=""></span>`;
  el.addEventListener("click", ev => {
    ev.stopPropagation(); el.remove(); S.stats.butterflies++;
    const gain = 4 + S.level * 3; earn(gain, ev.clientX || innerWidth / 2, ev.clientY || innerHeight / 2, 3);
    toast(`Papillon attrapé ! <b>+${gain} pièces</b>`); commit();
  });
  el.addEventListener("animationend", () => el.remove());
  $("#fx").appendChild(el);
}

/* ---------------- Events ---------------- */
document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]");
  if (!el) { if (ev.target.id === "modal") closeModal(); return; }
  if (el.disabled) return;
  const fn = A[el.dataset.act]; if (fn) fn(el.dataset.arg, ev);
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !$("#modal").hidden) closeModal(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); else { tick(now()); render(); } });
addEventListener("pagehide", save);

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
  if (away > 120000 && loaded) toast(`Bon retour ! Absent ${dur(away)}${ready > before ? `, ${ready - before} plante${ready - before > 1 ? "s" : ""} ${ready - before > 1 ? "ont" : "a"} mûri` : ""}.`, 5000);
  else if (!loaded) toast("Bienvenue dans <b>potager-idle</b> ! Ton premier radis est prêt : touche-le pour le récolter.", 6000);
  nextButterfly = t + rand(40, 90) * 1000; nextWeed = t + rand(70, 140) * 1000;
  render(true);
  let saveCount = 0;
  setInterval(() => {
    const t = now(); tick(t);
    if (!document.hidden && tab === "garden" && t >= nextButterfly) { spawnButterfly(); nextButterfly = t + rand(90, 200) * 1000; }
    if (t >= nextWeed) {
      const cand = S.plots.filter(p => p.seed && !p.weed && plotState(p, t) !== "ripe" && p.grown > 0);
      if (cand.length) pick(cand).weed = true;
      nextWeed = t + rand(80, 170) * 1000;
    }
    render();
    if (++saveCount % 5 === 0) save();
  }, 1000);
}
/* ---------------- Appli installable (PWA) ---------------- */
let installPrompt = null;
addEventListener("beforeinstallprompt", ev => { ev.preventDefault(); installPrompt = ev; if (tab === "garden") render(true); });
addEventListener("appinstalled", () => { installPrompt = null; render(true); toast("potager-idle est installé sur ton téléphone !"); });
A.install = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) {}
  installPrompt = null; render(true);
};
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // Nouvelle version déployée : on sauvegarde puis on recharge une seule fois.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!hadController || reloaded) return; reloaded = true; save(); location.reload(); });
}
navigator.storage?.persist?.().catch(() => {});

start();
