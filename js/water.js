"use strict";
/* ---------------- Arrosage entre amis ----------------
   Une fois par jour, on peut arroser le jardin d'un ami depuis sa visite (docs/arrosage.sql) :
   tous ses bacs sont arrosés et ses plantes poussent 20 % plus vite pendant 2 h.
   Les arrosages reçus sont gardés dans la sauvegarde (S.friendWater) ; la pousse en tient compte
   (growPlot dans game.js). Limites, comptées par le serveur : 2 arrosages reçus et 2 donnés par jour. */
const FW_ICON = `<svg class="fw-ico" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 13h14l-1.6 12.2A2 2 0 0 1 17.4 27h-6.8a2 2 0 0 1-2-1.8z" fill="#3f9bdc"/><path d="M21 15.5l6.5-5.2 1.3 1.6-6.9 6.4z" fill="#3f9bdc"/><path d="M10 13a4 4 0 0 1 8 0" fill="none" stroke="#2a7fc0" stroke-width="2.2" stroke-linecap="round"/><path d="M28.3 10.5l1.5 1.9" stroke="#2a7fc0" stroke-width="2.6" stroke-linecap="round"/><circle cx="30" cy="16" r="1.2" fill="#7cc4f2"/><circle cx="29" cy="19.5" r="1" fill="#7cc4f2"/><path d="M9.5 17h9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/></svg>`;
const FW_KEEP = 26 * 3600e3; // les arrosages plus vieux ne servent plus

// Arrosages qui font effet en ce moment : la « chaîne » d'arrosages qui se suivent sans interruption.
function fwActive(t) {
  const fw = [...(S.friendWater || [])].sort((a, b) => a.at - b.at);
  let chain = [], end = 0;
  for (const w of fw) {
    if (w.at > t) break;
    if (!chain.length || w.at >= end) chain = [];
    chain.push(w); end = Math.max(end, w.at + FW_MS);
  }
  return chain.length && t < end ? chain : [];
}
// Ligne sous « L'eau tient x min » : photos des amis, +20 % et le temps qui reste.
function fwLineHTML(t) {
  const ch = fwActive(t); if (!ch.length) return "";
  const end = Math.max(...ch.map(w => w.at + FW_MS)), mine = ch.some(w => w.mine), names = [...new Set(ch.filter(w => !w.mine).map(w => w.name || "Un ami"))];
  const who = mine ? (names.length ? `<b>${esc(names.join(", "))}</b> et toi avez arrosé` : "Tu as arrosé")
    : `<b>${esc(names.join(" et "))}</b> ${names.length > 1 ? "ont" : "a"} arrosé`;
  return `<p class="fw-line"><span class="fw-avs">${ch.map(w => `<span class="fw-av">${friendAvatar(w.avatar)}</span>`).join("")}</span>
    <span>${who} · <b class="fw-pct">+${Math.round(FW_BONUS * 100)} %</b> · <span class="num" data-left="${end}">${dur(end - t)}</span></span></p>`;
}

/* ---------- Arrosages reçus ---------- */
// Arrosage appris après coup (jeu fermé, ou vérifié il y a moins d'une minute) : on rattrape
// la pousse manquée depuis l'arrosage (eau + bonus), sans compter deux fois un bonus déjà en cours.
function fwCatchUp(w) {
  const prev = (S.friendWater || []).map(x => [x.at, x.at + FW_MS]);
  const uncovered = (a, b) => {
    let segs = [[a, b]];
    for (const [c, d] of prev) segs = segs.flatMap(([x, y]) => d <= x || c >= y ? [[x, y]] : [[x, Math.max(x, c)], [Math.min(y, d), y]].filter(([u, v]) => v > u));
    return segs.reduce((n, [x, y]) => n + y - x, 0);
  };
  for (const p of S.plots) {
    if (!p.seed || w.at >= p.last) continue;
    // Date de plantation inconnue (ancienne sauvegarde) : on prend la plus tardive possible (pousse à pleine vitesse).
    const need = PLANTS[p.seed].time * 1000, planted = p.planted || p.last - p.grown / plantSpeed(p.seed), start = Math.max(w.at, planted);
    if (!p.weed && p.grown < need) {
      let add = 0;
      const end = Math.min(w.at + FW_MS, p.last);
      if (end > start) add += FW_BONUS * speed() * uncovered(start, end);
      if (!S.upg.auto) { const ds = Math.max(p.waterUntil, start), de = Math.min(w.at + waterMs(), p.last); if (de > ds) add += (de - ds) * plantSpeed(p.seed) * (1 - DRY_RATE); }
      p.grown = Math.min(need, p.grown + add);
      if (p.grown >= need && !p.ripeAt) p.ripeAt = p.last;
    }
    p.waterUntil = Math.max(p.waterUntil, w.at + waterMs());
  }
}
async function loadWaterings() {
  if (!friendsReady()) return;
  let rows; try { rows = await CLOUD.rpc("my_waterings") || []; } catch (e) { return; }
  const t = now(), known = new Set((S.friendWater || []).map(w => w.id));
  const fresh = rows.filter(r => r && !known.has(r.id)).map(r => ({ id: r.id, at: Math.min(t, Date.parse(r.at) || t), name: r.name || "Un ami", avatar: r.avatar || null })).sort((a, b) => a.at - b.at);
  S.friendWater = (S.friendWater || []).filter(w => t - w.at < FW_KEEP);
  if (!fresh.length) return;
  for (const w of fresh) { fwCatchUp(w); S.friendWater.push(w); }
  const names = [...new Set(fresh.map(w => w.name))];
  toast(`💧 <b>${esc(names.join(" et "))}</b> ${names.length > 1 ? "ont" : "a"} arrosé ton jardin ! Tes plantes poussent ${Math.round(FW_BONUS * 100)} % plus vite pendant 2 h.`, 6000);
  SFX.play("water"); save(); render(true);
}
setInterval(() => { if (friendsReady() && !document.hidden) loadWaterings(); }, 60e3);
addEventListener("load", () => setTimeout(loadWaterings, 5000));
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(loadWaterings, 1500); });

/* ---------- Arroser chez un ami (depuis la visite) ---------- */
function visitWaterHTML(f) {
  const w = VISIT.water || {};
  const msg = w.mine_today ? `Tu as déjà arrosé le jardin de ${esc(f.name)} aujourd’hui.`
    : w.received_today >= 2 ? "Des amis sont déjà passés par là !"
    : w.given_today >= 2 ? "Tu as déjà bien arrosé chez tes amis aujourd’hui, reviens demain !" : "";
  return `<div class="visit-acts"><button class="btn fw-btn" data-act="visitWater" ${msg || VISIT.watering ? "disabled" : ""}>${FW_ICON}${w.mine_today ? "Arrosé" : "Arroser"}</button>
    <span class="small muted">${msg || `Ses bacs sont arrosés et ses plantes poussent +${Math.round(FW_BONUS * 100)} % pendant 2 h.`}</span></div>`;
}
const WATER_ACTS = {
  async visitWater(_, ev) {
    const f = visitFriend(); if (!f || VISIT.watering || !VISIT.data) return;
    VISIT.watering = true; render(true);
    try {
      await CLOUD.rpc("water_friend", { target: f.user_id });
      const t = now();
      VISIT.water = { ...(VISIT.water || {}), mine_today: true, given_today: (VISIT.water?.given_today || 0) + 1, received_today: (VISIT.water?.received_today || 0) + 1 };
      const meW = { id: "moi", at: t, mine: true, name: profileName(), avatar: profile().avatar?.startsWith("v:") ? profile().avatar : CLOUD.user?.avatar || null };
      asFriend(() => { S.plots.forEach(p => growPlot(p, t)); S.friendWater.push(meW); S.plots.forEach(p => { p.waterUntil = Math.max(p.waterUntil, t + waterMs()); }); });
      const xp = 5 + S.level * 2; addXp(xp);
      SFX.play("water"); toast(`💧 Tu as arrosé le jardin de <b>${esc(f.name)}</b> ! +${xp} XP`);
      VISIT.at = Date.now(); // le serveur a déjà la bonne version : pas besoin de recharger tout de suite
      VISIT.watering = false; commit(); return;
    } catch (e) {
      const m = String(e.message || e);
      if (/deja_arrose/.test(m)) VISIT.water = { ...VISIT.water, mine_today: true };
      else if (/jardin_plein/.test(m)) VISIT.water = { ...VISIT.water, received_today: 2 };
      else if (/trop_arrose/.test(m)) VISIT.water = { ...VISIT.water, given_today: 2 };
      else toast(/function|does not exist|404/.test(m) ? "L’arrosage n’est pas encore prêt sur le serveur (script docs/arrosage.sql)." : "Arrosage impossible pour le moment.");
    }
    VISIT.watering = false; render(true);
  },
};
