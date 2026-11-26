"use strict";
/* ---------------- v4 · Jardin commun ----------------
   Un petit jardin partagé par 4 jardiniers au plus, tenu par le serveur (docs/jardin-commun.sql).
   6 bacs, graines gratuites (8 par jour et par joueur), plantes de base débloquées par tous, panier commun,
   2 commandes par jour. Récompense pour chaque membre qui a planté au moins 3 graines depuis la commande précédente.
   Tout passe par des fonctions serveur (heure du serveur) ; le jeu ne fait qu'afficher et récupérer ses récompenses. */
const SG = { data: null, error: "", loading: false, at: 0, off: 0, busy: false, pick: null, invite: false, confirm: null, name: "" };
const SG_PLANTS_DAY = 8, SG_CONTRIB = 3, SG_BASKET = 60, SG_WATER = 600000, SG_DRY = .25;
const sgOn = () => typeof friendsReady === "function" && friendsReady();
const sgG = () => SG.data?.garden || null;
const sgNow = () => Date.now() + SG.off;
const SG_ERR = {
  deja_jardin: "Tu fais déjà partie d’un jardin commun.", pas_createur: "Seul le créateur du jardin peut faire ça.",
  jardin_plein: "Le jardin est complet : 4 jardiniers au plus.", trop_plante: `Tu as déjà planté ${SG_PLANTS_DAY} graines aujourd’hui ici. Reviens demain !`,
  graine_interdite: "Cette graine n’est pas disponible au jardin commun.", bac_occupe: "Ce bac est déjà planté.", pas_mur: "Ce n’est pas encore mûr.",
  panier_plein: "Le panier est plein : livrez une commande !", panier_incomplet: "Il manque des récoltes dans le panier.",
  commande_expiree: "Cette commande est terminée.", commande_introuvable: "Cette commande est déjà livrée.", invitation_introuvable: "Cette invitation n’existe plus.",
  "pas ami": "Vous n’êtes plus amis.",
};
function sgErr(e) {
  const m = String(e?.message || e);
  if (/function|does not exist|404/.test(m)) return "Le jardin commun n’est pas encore prêt sur le serveur (script docs/jardin-commun.sql).";
  for (const k in SG_ERR) if (m.includes(k)) return SG_ERR[k];
  return /fetch|network|réseau/i.test(m) ? "Pas de réseau : réessaie dans un instant." : "Le jardin commun ne répond pas, réessaie dans un instant.";
}

/* ---------- Chargement, récompenses ---------- */
async function loadSG(force) {
  if (!sgOn() || SG.loading || (!force && Date.now() - SG.at < 25e3)) return;
  SG.loading = true;
  try {
    const d = await CLOUD.rpc("sg_state");
    if (d && typeof d === "object") { SG.data = d; SG.off = (+d.now || Date.now()) - Date.now(); }
    SG.error = ""; SG.at = Date.now();
    await claimSG();
  } catch (e) { SG.error = sgErr(e); SG.at = Date.now(); }
  SG.loading = false; render(true);
}
// Récompenses des commandes livrées : récupérées une seule fois (le serveur les efface en les donnant).
async function claimSG() {
  let rows; try { rows = await CLOUD.rpc("sg_claim"); } catch (e) { return; }
  if (!Array.isArray(rows) || !rows.length) return;
  for (const r of rows) {
    S.coins += +r.coins || 0; if (+r.xp) addXp(+r.xp);
    if (r.wild && WILD[r.wild]) S.wild[r.wild] = cnt(S.wild, r.wild) + 1;
    if (r.deco && DECOS[r.deco]) S.goalDecos = [...new Set([...(S.goalDecos || []), r.deco])];
    S.stats.sgOrders = (S.stats.sgOrders || 0) + 1;
    toast(`🧺 Commande livrée au jardin « ${esc(r.garden || "commun")} » : ${coin}${fmt(+r.coins || 0)} · +${+r.xp || 0} XP${r.wild && WILD[r.wild] ? ` · 1 ${WILD[r.wild].name.toLowerCase()}` : ""}${r.deco ? ` · déco ${DECOS[r.deco]} !` : ""}`, 5000);
  }
  SFX.play("success"); save();
}
setInterval(() => { if (!document.hidden && sgOn()) loadSG(sgOpen()); }, 30e3);
addEventListener("load", () => setTimeout(() => loadSG(true), 4500));
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(() => loadSG(), 2500); });

/* ---------- Bacs : même calcul que le serveur ---------- */
function sgPlot(p) {
  if (!p?.seed || !PLANTS[p.seed]) return { st: "empty" };
  const t = sgNow(), last = +p.last || t, w = +p.water || 0, s = PLANTS[p.seed].season === SG.data?.season ? SEASON_BONUS : 1;
  const wet = Math.max(0, Math.min(t, w) - last), dry = Math.max(0, t - Math.max(last, w));
  const grown = (+p.grown || 0) + (wet + dry * SG_DRY) * s, need = PLANTS[p.seed].time * 1000, f = Math.min(1, grown / need);
  const ripe = f >= 1, thirsty = !ripe && t >= w;
  const speed = (thirsty ? SG_DRY : 1) * s;
  return { st: ripe ? "ripe" : thirsty ? "dry" : "growing", f, stage: f >= 1 ? 3 : f >= .55 ? 2 : f >= .2 ? 1 : 0, left: ripe ? 0 : (need - grown) / speed, water: Math.max(0, w - t) };
}
const sgMember = id => (SG.data?.members || []).find(m => m.id === id);
const sgMe = () => (SG.data?.members || []).find(m => m.me);
const sgAv = m => m?.me ? `<img src="${esc(avatarSrc())}" alt="">` : friendAvatar(m?.avatar);
const sgBasketN = () => Object.values(sgG()?.basket || {}).reduce((a, b) => a + (+b || 0), 0);
const sgOrderOk = o => Object.entries(o.items || {}).every(([k, q]) => (+sgG()?.basket?.[k] || 0) >= q);

/* ---------- Carte de l'onglet Amis ---------- */
const SG_ICON = `<img class="sg-ico" src="assets/img/interface/ui-portal.webp" alt="">`;
function sgCardHTML() {
  if (!sgOn()) return "";
  const g = sgG(), inv = SG.data?.invites || [];
  if (!SG.data) return `<div class="sg-card">${SG_ICON}<div class="sg-card-t"><b>Jardin commun</b><small class="muted">${SG.error ? esc(SG.error) : "Chargement…"}</small></div></div>`;
  if (g) {
    const ripe = g.plots.filter(p => sgPlot(p).st === "ripe").length, left = (g.orders || []).filter(o => !o.done).length;
    return `<button class="sg-card open" data-act="sgOpen">${SG_ICON}<div class="sg-card-t"><b>${esc(g.name)}</b>
      <small class="muted">${ripe ? `${ripe} bac${ripe > 1 ? "s" : ""} à récolter · ` : ""}${left ? `${left} commande${left > 1 ? "s" : ""} à livrer` : "Commandes du jour livrées"}</small></div>
      <span class="sg-avs">${(SG.data.members || []).map(m => `<span class="fr-av">${sgAv(m)}</span>`).join("")}</span></button>`;
  }
  return `<div class="sg-card">${SG_ICON}<div class="sg-card-t"><b>Jardin commun</b><small class="muted">Un petit jardin à cultiver avec 3 amis au plus, pour livrer ensemble des commandes.</small></div></div>
    ${inv.map(i => `<div class="sg-inv"><span class="fr-av">${friendAvatar(i.avatar)}</span><span class="fr-id"><b>${esc(i.by)} t’invite</b><small>au jardin « ${esc(i.name)} » · ${i.members} jardinier${i.members > 1 ? "s" : ""}</small></span>
      <span class="fr-acts"><button class="btn sm" data-act="sgAnswer" data-arg="${i.garden_id}:1" ${SG.busy ? "disabled" : ""}>Rejoindre</button><button class="btn ghost sm" data-act="sgAnswer" data-arg="${i.garden_id}:0" ${SG.busy ? "disabled" : ""}>Non merci</button></span></div>`).join("")}
    <form class="sg-create" data-form="sgCreate"><input id="sg-name" maxlength="24" placeholder="Nom du jardin" value="${esc(SG.name)}" autocomplete="off"><button class="btn" type="submit" ${SG.busy ? "disabled" : ""}>Créer</button></form>`;
}
// Petit portail au bord de son jardin, pour y aller directement.
const sgPortalHTML = () => sgOn() && sgG() ? `<button class="sg-portal" data-act="sgOpen" aria-label="Aller au jardin commun"><img src="assets/img/interface/ui-portal.webp" alt="">${sgG().plots.some(p => sgPlot(p).st === "ripe") ? `<span class="sg-dot"></span>` : ""}</button>` : "";

/* ---------- Fenêtre du jardin commun ---------- */
const sgOpen = () => modalView === viewSG && !$("#modal").hidden;
function sgPlotHTML(p, i) {
  const s = sgPlot(p), by = p?.by ? sgMember(p.by) : null;
  if (s.st === "empty") return `<button class="sg-plot empty${SG.pick === i ? " sel" : ""}" data-act="sgTap" data-arg="${i}" data-sgplot="${i}" data-st="empty"><span class="sg-plus">+</span><small>Planter</small></button>`;
  const lbl = s.st === "ripe" ? "Récolter" : s.st === "dry" ? "A soif !" : `<span data-sgleft="${i}">${growDur(s.left)}</span>`;
  return `<button class="sg-plot ${s.st}" data-act="sgTap" data-arg="${i}" data-sgplot="${i}" data-st="${s.st}" aria-label="${PLANTS[p.seed].name}">
    <span class="sg-art">${plantArt(p.seed, s.stage, true)}</span>${by ? `<span class="sg-by fr-av" title="${esc(by.me ? "Toi" : by.name)}">${sgAv(by)}</span>` : ""}
    ${s.st === "ripe" ? `<span class="sg-star">${STAR}</span>` : s.st === "dry" ? `<span class="sg-drop">${DROP}</span>` : ""}
    <span class="sg-bar"><i data-sgbar="${i}" style="width:${(s.f * 100).toFixed(1)}%"></i></span><small>${lbl}</small></button>`;
}
function viewSG() {
  const g = sgG();
  if (!g) return `<div class="sheet sg-sheet" role="dialog" aria-modal="true" aria-label="Jardin commun"><div class="sheet-head"><h2>Jardin commun</h2>${SHEET_X}</div>
    <p class="small muted" style="margin:0">${SG.error ? esc(SG.error) : "Tu ne fais plus partie de ce jardin."}</p></div>`;
  const me = sgMe(), members = SG.data.members || [], owner = me?.owner, planted = me?.planted || 0, leftSeeds = Math.max(0, SG_PLANTS_DAY - planted);
  const allowed = (SG.data.allowed || []).filter(k => PLANTS[k]);
  const basket = Object.entries(g.basket || {}).filter(([k, q]) => PLANTS[k] && +q > 0);
  const picker = SG.pick != null ? `<div class="sg-pick"><div class="row spread"><b>Planter dans le bac ${SG.pick + 1}</b><button class="btn ghost sm" data-act="sgPick" data-arg="">Annuler</button></div>
      <p class="small muted" style="margin:0">Graines gratuites · ${leftSeeds ? `encore ${leftSeeds} aujourd’hui` : "plus de graine aujourd’hui, reviens demain !"}</p>
      <div class="sg-seeds">${allowed.map(k => `<button class="sg-seed" data-act="sgPlant" data-arg="${k}" ${leftSeeds && !SG.busy ? "" : "disabled"}>${seedArt(k)}<b>${PLANTS[k].name}</b><small>${growDur(PLANTS[k].time * 1000 / (PLANTS[k].season === SG.data.season ? SEASON_BONUS : 1))}</small></button>`).join("")}</div></div>` : "";
  const orders = (g.orders || []).map((o, i) => { const ok = sgOrderOk(o);
    return `<div class="sg-order${o.done ? " done" : ""}"><div class="sg-need">${Object.entries(o.items || {}).filter(([k]) => PLANTS[k]).map(([k, q]) => { const h = Math.min(q, +g.basket?.[k] || 0);
        return `<span class="chip need-chip${h < q && !o.done ? " miss" : ""}">${cropArt(k)}${o.done ? q : `${h}/${q}`}</span>`; }).join("")}</div>
      <div class="sg-reward">${coin}${fmt(o.coins)} <span class="muted">+${o.xp} XP</span>${o.wild && WILD[o.wild] ? ` <span class="g-give">${wildArt(o.wild)}${WILD[o.wild].name}</span>` : ""}</div>
      ${o.done ? `<span class="sg-done">✓ Livrée</span>` : `<button class="btn sm" data-act="sgDeliver" data-arg="${i}" ${ok && !SG.busy ? "" : "disabled"}>Livrer</button>`}</div>`; }).join("");
  const friends = (typeof FR !== "undefined" ? FR.list : []).filter(f => f.direction === "friend" && !members.some(m => m.id === f.user_id) && !(SG.data.pending || []).some(p => p.id === f.user_id));
  const room = members.length + (SG.data.pending || []).length < 4;
  const conf = SG.confirm;
  return `<div class="sheet tall sg-sheet" role="dialog" aria-modal="true" aria-label="Jardin commun">
    <div class="sheet-head"><div><h2>${esc(g.name)}</h2><span class="small muted">Jardin commun · ${SEASONS[SG.data.season]?.name || ""}</span></div>${SHEET_X}</div>
    ${SG.error ? `<p class="cloud-warn">${esc(SG.error)}</p>` : ""}
    <div class="sg-garden" data-season="${SG.data.season}">${g.plots.map(sgPlotHTML).join("")}</div>
    ${picker}
    <p class="small muted" style="margin:0">Graines gratuites, ${SG_PLANTS_DAY} par jour chacun · tu en as planté <b>${planted}</b> aujourd’hui. Touche un bac pour planter, arroser ou récolter.</p>
    <h3 class="cat-title">Panier commun <span class="muted num">${sgBasketN()} / ${SG_BASKET}</span></h3>
    ${basket.length ? `<div class="sg-basket">${basket.map(([k, q]) => `<span class="chip">${cropArt(k)}<b class="num">${q}</b></span>`).join("")}</div>` : `<p class="small muted" style="margin:0">Le panier est vide. Les récoltes du jardin commun arrivent ici, et ne servent qu’aux commandes.</p>`}
    <h3 class="cat-title">Commandes du jour <span class="muted num">${(g.orders || []).filter(o => o.done).length} / ${(g.orders || []).length}</span></h3>
    <div class="sg-orders">${orders}</div>
    <p class="small muted" style="margin:0">Chaque jardinier qui a planté au moins ${SG_CONTRIB} graines depuis la commande précédente reçoit la récompense. Toi : <b>${Math.min(SG_CONTRIB, me?.contrib || 0)} / ${SG_CONTRIB}</b>.${g.delivered < 10 ? ` À la 10ᵉ commande livrée ensemble (${g.delivered} / 10), chacun gagne la déco <b>${DECOS.friend_bench}</b>.` : ""}</p>
    <h3 class="cat-title">Jardiniers <span class="muted num">${members.length} / 4</span></h3>
    <div class="fr-list">${members.map(m => `<div class="fr-row"><span class="fr-av">${sgAv(m)}</span><span class="fr-id"><b>${m.me ? "Toi" : esc(m.name)}${m.owner ? ` <span class="tr-tag">Créateur</span>` : ""}</b><small>Niv. ${m.level} · ${m.planted || 0} / ${SG_PLANTS_DAY} graines aujourd’hui</small></span>
      ${owner && !m.me ? `<span class="fr-acts">${conf === "kick:" + m.id ? `<button class="btn danger sm" data-act="sgKick" data-arg="${m.id}">Retirer</button><button class="btn ghost sm" data-act="sgConfirm" data-arg="">Non</button>` : `<button class="btn ghost sm" data-act="sgConfirm" data-arg="kick:${m.id}">Retirer</button>`}</span>` : ""}</div>`).join("")}
      ${(SG.data.pending || []).map(p => `<div class="fr-row pending"><span class="fr-av">${friendAvatar(p.avatar)}</span><span class="fr-id"><b>${esc(p.name)}</b><small>Invitation envoyée</small></span>${owner ? `<span class="fr-acts"><button class="btn ghost sm" data-act="sgUninvite" data-arg="${p.id}">Annuler</button></span>` : ""}</div>`).join("")}</div>
    ${owner && room ? (SG.invite ? `<div class="sg-invite"><b>Inviter un ami</b>${friends.length ? `<div class="fr-list">${friends.map(f => `<div class="fr-row"><span class="fr-av">${friendAvatar(f.avatar)}</span><span class="fr-id"><b>${esc(f.name)}</b></span><span class="fr-acts"><button class="btn sm" data-act="sgInvite" data-arg="${f.user_id}" ${SG.busy ? "disabled" : ""}>Inviter</button></span></div>`).join("")}</div>` : `<p class="small muted" style="margin:0">Tous tes amis sont déjà là, ou invités.</p>`}</div>`
      : `<button class="btn ghost" data-act="sgInviteOpen">Inviter un ami</button>`) : ""}
    ${conf === "leave" ? `<div class="sg-confirm"><p class="small" style="margin:0">Quitter « ${esc(g.name)} » ? Tes récoltes restent dans le panier commun.${members.length === 1 ? " Tu es le dernier jardinier : le jardin sera effacé." : ""}</p>
        <div class="row"><button class="btn danger" data-act="sgLeave">Quitter</button><button class="btn ghost" data-act="sgConfirm" data-arg="">Rester</button></div></div>`
      : `<button class="btn ghost sg-leave" data-act="sgConfirm" data-arg="leave">Quitter le jardin commun</button>`}
  </div>`;
}
// Le temps qui passe : barres et minuteurs mis à jour chaque seconde ; un bac qui change d'état redessine la fenêtre.
setInterval(() => {
  if (!sgOpen() || !sgG()) return;
  let changed = false;
  sgG().plots.forEach((p, i) => {
    const s = sgPlot(p), el = document.querySelector(`[data-sgplot="${i}"]`); if (!el) return;
    if (el.dataset.st !== s.st) changed = true;
    const bar = el.querySelector(`[data-sgbar="${i}"]`); if (bar) bar.style.width = (s.f * 100).toFixed(1) + "%";
    const lf = el.querySelector(`[data-sgleft="${i}"]`); if (lf) lf.textContent = growDur(s.left);
  });
  if (changed) render(true);
}, 1000);

async function sgCall(fn, args, after) {
  if (SG.busy) return; SG.busy = true; SG.error = ""; render(true);
  try { const r = await CLOUD.rpc(fn, args); if (after) after(r); SG.at = 0; SG.busy = false; await loadSG(true); }
  catch (e) { SG.busy = false; SG.error = sgErr(e); toast(esc(SG.error)); render(true); }
}
const SG_ACTS = {
  sgOpen() { if (!sgOn()) return; SG.pick = null; SG.invite = false; SG.confirm = null; modalView = viewSG; $("#modal").innerHTML = modalView(); openModal(); SFX.play("click"); loadSG(true); },
  sgTap(i) {
    i = +i; const p = sgG()?.plots[i], s = sgPlot(p);
    if (s.st === "empty") { SG.pick = SG.pick === i ? null : i; render(true); return; }
    if (s.st === "ripe") return sgCall("sg_harvest", { slot: i }, () => { SFX.play("harvest"); buzz(8); });
    sgCall("sg_water", { slot: i }, () => { SFX.play("water"); });
  },
  sgPick(i) { SG.pick = i === "" ? null : +i; render(true); },
  sgPlant(k) { const i = SG.pick; if (i == null) return; SG.pick = null; sgCall("sg_plant", { slot: i, p_seed: k }, () => { SFX.play("plant"); buzz(8); }); },
  sgDeliver(i) { sgCall("sg_deliver", { idx: +i }, n => { SFX.play("success"); toast(`🧺 Commande livrée ! ${+n ? `${n} jardinier${n > 1 ? "s" : ""} récompensé${n > 1 ? "s" : ""}.` : "Personne n’avait planté assez de graines cette fois."}`); }); },
  sgInviteOpen() { SG.invite = true; if (typeof loadFriends === "function") loadFriends(); render(true); },
  sgInvite(id) { sgCall("sg_invite", { target: id }, () => { SFX.play("click"); toast("Invitation envoyée 🌱"); }); },
  sgUninvite(id) { sgCall("sg_uninvite", { target: id }); },
  sgConfirm(v) { SG.confirm = v || null; render(true); },
  sgKick(id) { SG.confirm = null; sgCall("sg_leave", { target: id }); },
  sgLeave() { SG.confirm = null; sgCall("sg_leave", {}, () => { closeModal(); toast("Tu as quitté le jardin commun."); }); },
  sgAnswer(arg) { const [gid, yes] = arg.split(":"); sgCall("sg_answer", { p_garden: +gid, accept: yes === "1" }, () => { if (yes === "1") { SFX.play("success"); toast("Bienvenue au jardin commun ! 🌻"); } }); },
};
// Création d'un jardin (formulaire de l'onglet Amis).
document.addEventListener("submit", ev => {
  if (ev.target.dataset?.form !== "sgCreate") return; ev.preventDefault();
  const name = ($("#sg-name")?.value || "").trim().slice(0, 24) || "Jardin commun"; SG.name = "";
  sgCall("sg_create", { p_name: name }, () => { SFX.play("success"); setTimeout(() => SG_ACTS.sgOpen(), 300); });
});
document.addEventListener("input", ev => { if (ev.target.id === "sg-name") SG.name = ev.target.value; });
