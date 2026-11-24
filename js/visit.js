"use strict";
/* ---------------- Visite du jardin d'un ami (lecture seule) ----------------
   Les données viennent de la fonction serveur friend_garden (docs/visites.sql) : bacs, décos,
   herbier et niveau, jamais les pièces ni l'inventaire. Pendant la visite, le jardin continue
   de pousser (même calcul que le nôtre), sans que rien ne soit enregistré. */
const VISIT = { id: null, tab: "garden", data: null, updated: null, error: "", loading: false, at: 0 };
const VISIT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 13c0-4 2.6-6.6 7-6.6 0 4.4-2.6 6.6-7 6.6z" fill="currentColor"/><path d="M12 15.5c0-3.3-2.2-5.4-5.8-5.4 0 3.6 2.2 5.4 5.8 5.4z" fill="currentColor" opacity=".6"/><path d="M5 21h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const visitFriend = () => FR.list.find(x => x.id === VISIT.id);
const visitOpen = () => VISIT.id != null && !$("#modal").hidden && modalView != null;

// Les fonctions d'affichage du jeu lisent S : le temps d'un calcul, S devient le jardin de l'ami.
function asFriend(fn) { const me = S; S = VISIT.data; try { return fn(); } finally { S = me; } }

// Jardin reçu du serveur → petit état de jeu, nettoyé (rien d'inconnu ne doit faire planter l'affichage).
function visitState(d) {
  const t = now(), last = +d.last || Date.parse(d.updated_at) || t;
  const list = v => Array.isArray(v) ? v.filter(k => typeof k === "string") : [];
  const lvl = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  const plots = (Array.isArray(d.plots) ? d.plots : []).slice(0, 24).map(p => {
    const seed = p && PLANTS[p.seed] ? p.seed : null;
    return { seed, grown: Math.max(0, +p?.grown || 0), last: Math.min(t, +p?.last || last), waterUntil: +p?.waterUntil || 0, weed: !!(seed && p.weed) };
  });
  const slots = Array.isArray(d.decoSlots) ? d.decoSlots : [];
  return {
    plots, decoSlots: [0, 1, 2].map(i => DECOS[slots[i]] ? slots[i] : null),
    decoOff: Array.isArray(d.decoOff) ? d.decoOff : [], decoFlip: Array.isArray(d.decoFlip) ? d.decoFlip : [],
    upg: { water: lvl(d.upg?.water, UPG.water.values.length - 1), fert: lvl(d.upg?.fert, UPG.fert.values.length - 1), auto: lvl(d.upg?.auto, 1) },
    discovered: list(d.discovered), hybrids: list(d.hybrids), goldenFound: list(d.goldenFound), level: Math.max(1, +d.level || 1),
  };
}

async function loadVisit() {
  const f = visitFriend(); if (!f || !friendsReady() || VISIT.loading) return;
  VISIT.loading = true;
  try {
    const d = await CLOUD.rpc("friend_garden", { target: f.user_id });
    if (VISIT.id !== f.id) return;
    if (d && typeof d === "object") { VISIT.data = visitState(d); VISIT.updated = d.updated_at || null; VISIT.error = ""; }
    else { VISIT.data = null; VISIT.error = `${f.name} n’a pas encore de jardin sauvegardé en ligne.`; }
    VISIT.at = Date.now();
  } catch (e) {
    const m = String(e.message || e);
    VISIT.error = /pas ami/.test(m) ? "Vous n’êtes plus amis." : /function|does not exist|404/.test(m) ? "La visite n’est pas encore prête sur le serveur (script docs/visites.sql)." : "Visite impossible pour le moment.";
  } finally { VISIT.loading = false; }
  if (VISIT.id === f.id && !$("#modal").hidden) render(true);
}
// Jardin ouvert : on recharge la dernière sauvegarde de l'ami chaque minute.
setInterval(() => { if (visitOpen() && !document.hidden && Date.now() - VISIT.at > 60e3) loadVisit(); }, 15e3);

/* ---------- Jardin ---------- */
const vPlotLabel = (p, t) => { const st = plotState(p, t); if (st === "empty") return "Bac vide";
  const n = PLANTS[p.seed].name; return { ripe: `${n} prêt à récolter`, dry: `${n} a soif`, weed: `${n} envahi`, growing: `${n} en train de pousser` }[st]; };
const vPlotSig = (p, t) => { const st = plotState(p, t); return st + (p.seed || "") + (p.seed ? plotStage(p) : ""); };
function vPlotHTML(p, i, t) { const st = plotState(p, t); return st === "empty" ? "" : plotHTML(p, i, t); }
function visitGardenHTML(t) {
  return asFriend(() => {
    S.plots.forEach(p => growPlot(p, t));
    const n = st => S.plots.filter(p => plotState(p, t) === st).length;
    const ripe = n("ripe"), dry = n("dry"), weed = n("weed"), grow = n("growing");
    const bits = [ripe && `<span>${STAR} ${ripe} prête${ripe > 1 ? "s" : ""}</span>`, grow && `<span>${grow} en train de pousser</span>`,
      dry && `<span>${DROP} ${dry} ${dry > 1 ? "ont" : "a"} soif</span>`, weed && `<span>${weed} envahi${weed > 1 ? "s" : ""}</span>`].filter(Boolean);
    const deco = S.decoSlots.some(Boolean) ? `<div class="deco-row">${S.decoSlots.map((d, i) => d ? `<span class="deco-slot full s${i}" style="${decoStyle(d, i)}"><img src="assets/img/deco-${d}.webp" alt="${DECOS[d]}"></span>` : "").join("")}</div>` : "";
    const ago = VISIT.updated ? Math.round((Date.now() - Date.parse(VISIT.updated)) / 60000) : null;
    return `<div class="visit-bar"><p class="visit-sum">${bits.length ? bits.join("") : "<span>Aucune plante en ce moment</span>"}</p>
        <p class="garden-hint">${S.upg.auto ? "Arroseur automatique actif" : `L’eau tient ${UPG.water.values[S.upg.water]} min`}${S.upg.fert ? ` · <span style="white-space:nowrap">Compost : +${Math.round((speed() - 1) * 100)} %</span>` : ""}</p></div>
      <div class="garden visit-garden${deco ? " decorated" : ""}" data-season="${season()}">${seasonFxHTML(season())}
        <div class="plots">${S.plots.map((p, i) => `<div class="plot ${plotState(p, t)}" data-vplot="${i}" data-sig="${vPlotSig(p, t)}" role="img" aria-label="${vPlotLabel(p, t)}">${vPlotHTML(p, i, t)}</div>`).join("")}</div>${deco}</div>
      ${ago != null ? `<p class="visit-note">Jardin sauvegardé ${ago < 2 ? "à l’instant" : ago < 60 ? `il y a ${ago} min` : ago < 1440 ? `il y a ${Math.round(ago / 60)} h` : `il y a ${Math.round(ago / 1440)} j`} · il continue de pousser pendant ta visite.</p>` : ""}`;
  });
}
// Chaque seconde : la pousse avance, seuls les bacs qui changent sont redessinés (les anneaux glissent).
function updateVisit(t) {
  if (!visitOpen() || VISIT.tab !== "garden" || !VISIT.data) return;
  asFriend(() => document.querySelectorAll("#modal [data-vplot]").forEach(el => {
    const i = +el.dataset.vplot, p = S.plots[i]; if (!p) return;
    growPlot(p, t);
    const st = plotState(p, t), sig = vPlotSig(p, t);
    if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.className = "plot " + st; el.innerHTML = vPlotHTML(p, i, t); el.setAttribute("aria-label", vPlotLabel(p, t)); }
    if (p.seed && st !== "ripe") { const r = ringValues(p, st, t);
      const rg = el.querySelector("[data-rg]"); if (rg) rg.style.strokeDashoffset = r.g;
      const rw = el.querySelector("[data-rw]"); if (rw) rw.style.strokeDashoffset = r.w; }
  }));
}

/* ---------- Herbier ---------- */
// Anti-spoil : un hybride que je n'ai pas encore découvert reste « ??? », même si l'ami le connaît.
function visitHerbHTML(f) {
  const V = VISIT.data, mine = k => S.discovered.includes(k) || S.hybrids.includes(k), theirs = k => V.discovered.includes(k) || V.hybrids.includes(k);
  const card = k => {
    const d = PLANTS[k], they = theirs(k), hidden = d.hybrid && !mine(k), gold = they && V.goldenFound.includes(k);
    if (they && hidden) return `<div class="herb unknown friend-knows">${cropArt(k)}<b>???</b><span class="muted">Connu de ${esc(f.name)}</span></div>`;
    if (!they) return `<div class="herb unknown">${cropArt(k)}<b>${d.hybrid ? "???" : d.name}</b></div>`;
    return `<div class="herb${gold ? " has-gold" : ""}">${cropArt(k)}${seasonBadge(k)}<b>${d.name}</b>${mine(k) ? "" : `<span class="muted">Pas encore chez toi</span>`}</div>`;
  };
  const baseK = ORDER.filter(k => !PLANTS[k].hybrid), hybK = ORDER.filter(k => PLANTS[k].hybrid);
  const extra = ORDER.filter(k => theirs(k) && !mine(k)).length, golds = V.goldenFound.filter(k => PLANTS[k]).length;
  return `<div class="row spread"><h3 class="cat-title" style="margin:0">Herbier de ${esc(f.name)}</h3><span class="small muted num">${ORDER.filter(theirs).length} / ${ORDER.length} · <span class="gold-count">★ ${golds} dorée${golds > 1 ? "s" : ""}</span></span></div>
    ${extra ? `<p class="visit-note" style="margin:0">${esc(f.name)} connaît ${extra} plante${extra > 1 ? "s" : ""} que tu n’as pas encore.</p>` : ""}
    <h3 class="cat-title">Plantes <span class="muted num">${baseK.filter(theirs).length} / ${baseK.length}</span></h3><div class="herbier">${baseK.map(card).join("")}</div>
    <h3 class="cat-title">Hybrides <span class="muted num">${hybK.filter(theirs).length} / ${hybK.length}</span></h3><div class="herbier">${hybK.map(card).join("")}</div>`;
}

/* ---------- Fenêtre ---------- */
function viewVisit() {
  const f = visitFriend(); if (!f) { VISIT.id = null; return viewFriends(); }
  const t = now();
  let body;
  if (!VISIT.data) body = `<div class="empty-note"><span>${VISIT.error ? esc(VISIT.error) : "On pousse le portillon…"}</span></div>${VISIT.error && !VISIT.loading ? `<button class="btn ghost" data-act="visitReload">Réessayer</button>` : ""}`;
  else body = `<div class="subtabs" style="grid-template-columns:repeat(2,1fr)">${[["garden", "Jardin"], ["herb", "Herbier"]].map(([k, l]) => `<button data-act="visitTab" data-arg="${k}" aria-pressed="${VISIT.tab === k}">${l}</button>`).join("")}</div>
    ${VISIT.tab === "herb" ? visitHerbHTML(f) : visitGardenHTML(t)}`;
  return `<div class="sheet tall visit-sheet" role="dialog" aria-modal="true" aria-label="Jardin de ${esc(f.name)}">
    <div class="sheet-head chat-head"><button class="btn ghost sm" data-act="visitBack" aria-label="Retour">‹</button><span class="fr-av">${friendAvatar(f.avatar)}</span><span class="fr-id"><b>Jardin de ${esc(f.name)}</b><small>Niv. ${VISIT.data?.level || f.level}${f.title ? ` · ${esc(f.title)}` : ""}</small></span></div>
    ${body}</div>`;
}
const VISIT_ACTS = {
  frVisit(id) { VISIT.id = +id; VISIT.tab = "garden"; VISIT.data = null; VISIT.updated = null; VISIT.error = ""; FR.confirm = null; SFX.play("click"); render(true); loadVisit(); },
  visitTab(t) { VISIT.tab = t; render(true); },
  visitBack() { VISIT.id = null; VISIT.data = null; render(true); },
  visitReload() { VISIT.error = ""; render(true); loadVisit(); },
};
