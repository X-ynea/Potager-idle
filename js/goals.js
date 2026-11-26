"use strict";
/* ---------------- Objectifs de la semaine ----------------
   Deux objectifs collaboratifs (jamais compétitifs), du lundi au dimanche (heure de Paris), docs/objectifs.sql :
   · entre amis : toi et tes amis (chacun voit le total de son cercle) ;
   · tous les joueurs : un seul grand compteur, en 3 paliers.
   Le jeu compte ses propres progrès (S.weekly) et les envoie au serveur, qui additionne les parts (plafonnées).
   Récompenses : la 1re réussite d'une saison donne la déco exclusive de la saison (amis / tous) + XP ;
   ensuite des graines (amis) ou des graines d'hybrides (tous). Un hybride pas encore découvert :
   ses graines sont mises de côté (« graines mystère ») jusqu'à sa découverte à la Serre. */
const GOAL_KINDS = {
  harvest: { text: n => `Récolter ${fmt(n)} plantes de saison`, base: 120, icon: () => QUEST_ICONS.harvest },
  deliver: { text: n => `Livrer ${fmt(n)} commandes`, base: 60, icon: () => QUEST_ICONS.deliver },
  cook: { text: n => `Cuisiner ${fmt(n)} plats`, base: 60, icon: () => QUEST_ICONS.cook },
  visitor: { text: n => `Attraper ${fmt(n)} visiteurs du jardin`, base: 50, icon: () => visitorArt(VISITOR().key) },
};
// base = part d'un joueur sur la semaine (environ 4 à 5 h de jeu actif ; 3.0.5 : ×2,5 à ×5, trop facile avant).
const GOAL_ORDER = ["harvest", "deliver", "cook", "visitor"];
const GOAL_TIERS = [.25, .6, 1]; // paliers de l'objectif de tous les joueurs
const GOAL_DECOS = {
  f_printemps: "Arche fleurie", f_ete: "Table de pique-nique", f_automne: "Hérisson et feuilles", f_hiver: "Bonhomme de neige",
  g_printemps: "Fontaine fleurie", g_ete: "Moulin à vent", g_automne: "Montgolfière", g_hiver: "Sapin illuminé",
};
const GOALS = { data: null, error: "", dirty: true, loading: false };

// Semaine de Paris : date du lundi (AAAA-MM-JJ), comme le serveur.
function weekId(t = Date.now()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  const d = new Date(p + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
const weekIndex = () => Math.round((Date.parse(weekId() + "T12:00:00Z") - Date.parse("2026-11-16T12:00:00Z")) / (7 * 864e5));
const goalKind = which => GOAL_ORDER[(((weekIndex() + (which === "g" ? 2 : 0)) % 4) + 4) % 4];
// Part maximale d'un joueur. Tous les joueurs : une part « normale » (3.0.25, avant ×2 : un ou deux joueurs suffisaient).
const goalCap = which => Math.round(GOAL_KINDS[goalKind(which)].base * (which === "g" ? 1 : 1.5));
function goalTarget(which) {
  const base = GOAL_KINDS[goalKind(which)].base, d = GOALS.data;
  if (which === "f") return base * Math.min(8, Math.max(1, d?.members?.length || 1));
  return Math.max(50, Math.round(base * Math.max(5, d?.players_last || 0) * .6 / 10) * 10);
}
function weekly() {
  const w = weekId();
  if (!S.weekly || S.weekly.week !== w) S.weekly = { week: w, f: 0, g: 0, cf: false, cg: [false, false, false] };
  // 3.0.5 : semaine du 23 novembre, objectif entre amis fini avec les anciennes cibles (trop faciles) :
  // il redevient actif avec la nouvelle cible, sans nouvelle récompense (déjà reçue).
  if (S.weekly.week === "2026-11-23" && S.weekly.cf && !S.weekly.reopened) { S.weekly.cf = false; S.weekly.noRewardF = true; S.weekly.reopened = true; }
  return S.weekly;
}
const goalsOn = () => FRIENDS_ON && CLOUD.signedIn && !CLOUD.blocked;
const goalTotal = which => Math.max(+(which === "f" ? GOALS.data?.ftotal : GOALS.data?.gtotal) || 0, Math.min(+weekly()[which] || 0, goalCap(which)));

// Appelé à chaque progrès des objectifs du jour (récolte, commande, plat, visiteur).
function weeklyProgress(type, amount, k) {
  if (!goalsOn()) return;
  const kind = type === "harvestK" ? (k && PLANTS[k] && inSeason(k) ? "harvest" : null) : type === "deliver" ? "deliver" : type === "cook" ? "cook" : type === "butterfly" ? "visitor" : null;
  if (!kind) return;
  const W = weekly();
  for (const which of ["f", "g"]) if (goalKind(which) === kind) { W[which] += amount; GOALS.dirty = true; }
}

async function loadGoals() {
  if (!goalsOn() || GOALS.loading) return;
  GOALS.loading = true;
  const W = weekly();
  try {
    if (GOALS.dirty) { await CLOUD.rpc("report_progress", { p_week: W.week, p_f: W.f, p_g: W.g }); GOALS.dirty = false; }
    const d = await CLOUD.rpc("week_goals", { p_week: W.week, cap_f: goalCap("f"), cap_g: goalCap("g") });
    GOALS.data = d && typeof d === "object" && !Array.isArray(d) ? d : null;
    GOALS.error = "";
  } catch (e) { GOALS.error = /function|does not exist|404/.test(String(e.message)) ? "Les objectifs de la semaine ne sont pas encore prêts sur le serveur (script docs/objectifs.sql)." : "Objectifs indisponibles pour le moment."; }
  GOALS.loading = false;
  render(true);
}
setInterval(() => { if (goalsOn() && !document.hidden) loadGoals(); }, 60e3);
addEventListener("load", () => setTimeout(loadGoals, 3500));
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(loadGoals, 1800); });

/* ---------- Récompenses ---------- */
const goalDecoKey = which => `${which}_${season()}`;
const goalDecoDone = which => (S.goalDecos || []).includes(goalDecoKey(which));
function seasonSeedPick(n) { // graines de plantes de la saison (débloquées à son niveau si possible)
  const sz = ORDER.filter(k => PLANTS[k].season === season() && !PLANTS[k].hybrid && !PLANTS[k].tuto);
  const ok = sz.filter(k => PLANTS[k].lvl <= S.level), pool = ok.length ? ok : sz;
  const out = {}; for (let i = 0; i < n; i++) { const k = pool[Math.floor(Math.random() * pool.length)]; out[k] = (out[k] || 0) + 1; } return out;
}
function hybridSeeds(n) { // graines d'hybrides ; celles d'un hybride inconnu sont mises de côté
  const hyb = ORDER.filter(k => PLANTS[k].hybrid), got = {};
  for (let i = 0; i < n; i++) { const h = hyb[Math.floor(Math.random() * hyb.length)]; got[h] = (got[h] || 0) + 1; }
  let known = 0, mystery = 0;
  for (const [h, q] of Object.entries(got)) {
    if (S.hybrids.includes(h)) { S.seeds[h] = cnt(S.seeds, h) + q; known += q; }
    else { S.hybSeeds = S.hybSeeds || {}; S.hybSeeds[h] = (S.hybSeeds[h] || 0) + q; mystery += q; }
  }
  return { known, mystery };
}
// Hybride découvert à la Serre : ses graines mystère arrivent dans l'inventaire.
function releaseMysterySeeds(h) {
  const q = S.hybSeeds?.[h]; if (!q) return;
  S.seeds[h] = cnt(S.seeds, h) + q; delete S.hybSeeds[h];
  setTimeout(() => toast(`🎁 Tes ${q} graine${q > 1 ? "s" : ""} mystère ${q > 1 ? "étaient" : "était"} des graines de <b>${PLANTS[h].name}</b> !`, 5000), 1500);
}
const mysteryCount = () => Object.values(S.hybSeeds || {}).reduce((a, b) => a + b, 0);
// Ce que rapporte chaque récompense (pour l'affichage) ; xp en fonction du niveau.
const goalRewards = {
  f: () => goalDecoDone("f") ? { seeds: 6, xp: 20 + S.level * 2 } : { deco: goalDecoKey("f"), xp: 60 + S.level * 5 },
  g: i => i < 2 ? { hyb: i ? 4 : 2, xp: (i ? 40 : 20) + S.level * 2 } : goalDecoDone("g") ? { hyb: 6, xp: 60 + S.level * 3 } : { deco: goalDecoKey("g"), xp: 100 + S.level * 6 },
};
const rewardText = r => r.none ? "Récompense déjà reçue cette semaine" : [r.deco ? `Déco « ${GOAL_DECOS[r.deco]} »` : "", r.seeds ? `${r.seeds} graines de saison` : "", r.hyb ? `${r.hyb} graines d’hybrides` : "", `+${r.xp} XP`].filter(Boolean).join(" · ");

/* ---------- Écran d'accueil ---------- */
const goalDone = which => which === "f" ? weekly().cf : weekly().cg.every(Boolean);
function goalCard(which) {
  const kind = goalKind(which), K = GOAL_KINDS[kind], target = goalTarget(which), total = Math.min(goalTotal(which), target), W = weekly();
  const pct = total / target * 100, done = goalDone(which);
  const ready = which === "f" ? !W.cf && total >= target : GOAL_TIERS.some((p, i) => !W.cg[i] && total >= target * p);
  const sub = which === "f" ? `${GOALS.data?.members?.length > 1 ? `Toi et ${GOALS.data.members.length - 1} ami${GOALS.data.members.length > 2 ? "s" : ""}` : "Toi et tes amis"}` : GOALS.data?.players_now ? `${fmt(GOALS.data.players_now)} participant${GOALS.data.players_now > 1 ? "s" : ""}` : "Tout le monde ensemble";
  const ticks = which === "g" ? GOAL_TIERS.slice(0, 2).map(p => `<span class="wk-tick${total >= target * p ? " on" : ""}" style="left:${p * 100}%"></span>`).join("") : "";
  return `<div class="quest wk ${done ? "claimed" : ready ? "ready" : ""}" data-act="openGoal" data-arg="${which}" role="button" tabindex="0" aria-label="Voir l’objectif et ses récompenses">
    <div class="q-ico">${K.icon()}</div>
    <div class="q-txt"><small class="wk-who">${which === "f" ? "Entre amis" : "Tous les joueurs"} · ${sub}</small><b>${K.text(target)}</b><div class="pbar wk-bar"><i style="width:${pct.toFixed(1)}%"></i>${ticks}</div>
      <span class="small muted num">${fmt(total)} / ${fmt(target)}${which === "g" ? ` · palier ${GOAL_TIERS.filter(p => total >= target * p).length}/3` : ""}</span></div>
    ${done ? `<span class="q-done">✓</span>` : ready ? `<button class="btn sm" data-act="claimGoal" data-arg="${which}">${which === "f" && W.noRewardF ? "Terminer" : "Récupérer"}</button>` : `<span class="wk-more" aria-hidden="true">›</span>`}
  </div>`;
}
function weeklyHTML() {
  if (!goalsOn()) return "";
  const order = ["f", "g"].sort((a, b) => goalDone(a) - goalDone(b)); // objectif fini : grisé, en second
  const left = seasonDaysLeft();
  return `<section class="panel quests weekly"><div class="row spread"><h2>Objectifs de la semaine</h2><span class="small muted">encore ${left} jour${left > 1 ? "s" : ""}</span></div>
    ${GOALS.error ? `<p class="small muted" style="margin:0">${esc(GOALS.error)}</p>` : ""}${order.map(goalCard).join("")}</section>`;
}
const weeklySig = () => goalsOn() ? JSON.stringify([weekly(), GOALS.data, GOALS.error, season()]) : "";

/* ---------- Fiche d'un objectif ---------- */
function viewGoal(which) {
  const kind = goalKind(which), K = GOAL_KINDS[kind], target = goalTarget(which), total = Math.min(goalTotal(which), target), W = weekly(), cap = goalCap(which);
  const tiers = which === "f" ? [{ p: 1, r: W.noRewardF ? { xp: 0, none: true } : goalRewards.f(), got: W.cf }] : GOAL_TIERS.map((p, i) => ({ p, r: goalRewards.g(i), got: W.cg[i] }));
  const members = which === "f" ? (GOALS.data?.members || []) : [];
  const left = seasonDaysLeft();
  return `<div class="sheet tall goal-sheet" role="dialog" aria-modal="true" aria-label="Objectif de la semaine">
    <div class="sheet-head"><div><h2>${which === "f" ? "Objectif entre amis" : "Objectif de tous les joueurs"}</h2><span class="small muted">Encore ${left} jour${left > 1 ? "s" : ""} · ${SEASONS[season()].name}</span></div>${SHEET_X}</div>
    <div class="goal-head"><div class="q-ico">${K.icon()}</div><div><b>${K.text(target)}</b><div class="pbar wk-bar big"><i style="width:${(total / target * 100).toFixed(1)}%"></i>${which === "g" ? GOAL_TIERS.slice(0, 2).map(p => `<span class="wk-tick${total >= target * p ? " on" : ""}" style="left:${p * 100}%"></span>`).join("") : ""}</div>
      <span class="small muted num">${fmt(total)} / ${fmt(target)} · ta part : ${fmt(Math.min(W[which], cap))}</span></div></div>
    <p class="small muted" style="margin:0">${which === "f" ? `Toi et tes amis avancez ensemble. Chaque jardinier compte pour ${fmt(cap)} au plus.` : `Tous les jardiniers avancent ensemble. Chacun compte pour ${fmt(cap)} au plus.`}${kind === "harvest" ? ` Seules les plantes de la saison (${SEASONS[season()].name.toLowerCase()}) comptent.` : ""}</p>
    <h3 class="cat-title">Récompenses</h3>
    <div class="goal-rewards">${tiers.map((t, i) => { const reached = total >= target * t.p, ok = reached && !t.got;
      return `<div class="goal-rw${t.got ? " got" : ok ? " ready" : ""}"><span class="goal-rw-p">${which === "g" ? `Palier ${i + 1} · ${Math.round(t.p * 100)} %` : "Objectif atteint"}</span>
        <span class="goal-rw-r">${t.r.deco ? `<img src="assets/img/deco-${t.r.deco}.webp" alt="">` : ""}${rewardText(t.r)}${t.r.deco ? `<small>Première réussite de la saison</small>` : ""}</span>
        ${t.got ? `<span class="q-done">✓</span>` : ok ? `<button class="btn sm" data-act="claimGoal" data-arg="${which}">${which === "f" && W.noRewardF ? "Terminer" : "Récupérer"}</button>` : `<span class="small muted num">${Math.round(Math.min(1, total / (target * t.p)) * 100)} %</span>`}</div>`; }).join("")}</div>
    ${which === "g" ? `<p class="small muted" style="margin:0">Graines d’hybrides : si tu n’as pas encore découvert l’hybride, elles sont mises de côté et t’attendent jusqu’à sa découverte à la Serre${mysteryCount() ? ` (${mysteryCount()} graine${mysteryCount() > 1 ? "s" : ""} mystère en attente)` : ""}.` : `<p class="small muted" style="margin:0">La première réussite de chaque saison donne sa déco exclusive. Ensuite, des graines de saison.</p>`}
    ${members.length ? `<h3 class="cat-title">Participants</h3><div class="goal-members">${members.map(m => `<div class="goal-m${m.me ? " me" : ""}"><span class="fr-av">${m.me ? `<img src="${esc(CLOUD.user?.avatar || "assets/img/xp-leaf.webp")}" alt="">` : friendAvatar(m.avatar)}</span><b>${m.me ? "Toi" : esc(m.name)}</b><span class="num">${fmt(Math.min(m.n, cap))}</span></div>`).join("")}</div>` : ""}
  </div>`;
}
const GOAL_ACTS = {
  openGoal(which) { if (!goalsOn()) return; modalView = () => viewGoal(which); $("#modal").innerHTML = modalView(); openModal(); loadGoals(); },
  claimGoal(which, ev) {
    ev?.stopPropagation?.();
    const W = weekly(), target = goalTarget(which), total = goalTotal(which);
    let r;
    if (which === "f" && W.noRewardF) { if (W.cf || total < target) return; W.cf = true; SFX.play("success"); toast("🎉 Objectif entre amis terminé ! (récompense déjà reçue cette semaine)"); commit(); return; }
    if (which === "f") { if (W.cf || total < target) return; r = goalRewards.f(); W.cf = true; S.stats.weeklyGoals = (S.stats.weeklyGoals || 0) + 1; }
    else { const i = GOAL_TIERS.findIndex((p, j) => !W.cg[j] && total >= target * p); if (i < 0) return; r = goalRewards.g(i); W.cg[i] = true; if (i === 2) S.stats.weeklyGoals = (S.stats.weeklyGoals || 0) + 1; }
    let msg = "";
    if (r.deco) { S.goalDecos = [...new Set([...(S.goalDecos || []), r.deco])]; msg = `Nouvelle déco : <b>${GOAL_DECOS[r.deco]}</b> !`; }
    if (r.seeds) { const got = seasonSeedPick(r.seeds); for (const [k, q] of Object.entries(got)) S.seeds[k] = cnt(S.seeds, k) + q; msg = `${r.seeds} graines de saison`; }
    if (r.hyb) { const h = hybridSeeds(r.hyb); msg = `${r.hyb} graines d’hybrides${h.mystery ? ` (dont ${h.mystery} mystère, en attente de découverte)` : ""}`; }
    addXp(r.xp); SFX.play("success"); toast(`🎉 ${msg} · +${r.xp} XP`, 4500); commit();
  },
};
