"use strict";
/* ---------------- Amis ----------------
   Code ami à 5 caractères, recherche par code ou par pseudo, demandes envoyées et reçues,
   liste d'amis et page de discussion (messages à venir). Tout passe par les fonctions serveur
   de docs/amis.sql : on ne voit jamais la sauvegarde des autres joueurs, seulement leur profil public. */
const FR = { list: [], code: "", loaded: false, loading: false, error: "", tab: "friends", results: null, searching: false, q: "", chat: null, confirm: null, lastLoad: 0 };

// Photo publique : portrait de voisin, photo importée réduite (64 px) ou photo Discord.
let pubAvatarCache = { src: null, out: null };
async function publicAvatar() {
  const a = profile().avatar;
  if (a && a.startsWith("v:")) return a;
  if (a && a.startsWith("data:")) {
    if (pubAvatarCache.src === a) return pubAvatarCache.out;
    const out = await new Promise(ok => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 64; c.getContext("2d").drawImage(img, 0, 0, 64, 64); ok(c.toDataURL("image/webp", .8)); }; img.onerror = () => ok(null); img.src = a; });
    pubAvatarCache = { src: a, out }; return out;
  }
  return CLOUD.user?.avatar || null;
}
const friendAvatar = a => `<img src="${!a ? "assets/img/xp-leaf.webp" : a.startsWith("v:") ? `assets/img/villager-${+a.slice(2)}.webp` : a.replace(/"/g, "")}" alt="" loading="lazy">`;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const seenAgo = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 5 ? "en ligne récemment" : m < 60 ? `vu il y a ${m} min` : m < 1440 ? `vu il y a ${Math.round(m / 60)} h` : `vu il y a ${Math.round(m / 1440)} j`; };
const friendsReady = () => CLOUD.enabled() && CLOUD.signedIn && !CLOUD.blocked;
const incoming = () => FR.list.filter(f => f.direction === "in");

async function loadFriends(force) {
  if (!friendsReady() || FR.loading || (!force && Date.now() - FR.lastLoad < 20e3)) return;
  FR.loading = true;
  try {
    FR.code = await CLOUD.rpc("upsert_profile", { p_name: profile().name || CLOUD.user?.name || "Jardinier", p_avatar: await publicAvatar(), p_title: S.title || null, p_level: S.level, p_test: IS_TEST });
    FR.list = await CLOUD.rpc("list_friends") || [];
    FR.loaded = true; FR.error = ""; FR.lastLoad = Date.now();
  } catch (e) { FR.error = /function|does not exist|404/.test(String(e.message)) ? "Le serveur des amis n’est pas encore prêt (script docs/amis.sql)." : "Connexion impossible pour le moment."; }
  FR.loading = false;
  if (typeof render === "function") { if (!$("#modal").hidden) render(true); updateBrand?.(); }
}
setInterval(() => { if (friendsReady() && !document.hidden) loadFriends(); }, 120e3);
addEventListener("load", () => setTimeout(() => loadFriends(true), 2500));

function friendRow(f) {
  const head = `<span class="fr-av">${friendAvatar(f.avatar)}</span><span class="fr-id"><b>${esc(f.name)}</b>${f.title ? ` <span class="title-tag">${esc(f.title)}</span>` : ""}<small>Niv. ${f.level} · ${f.direction === "friend" ? seenAgo(f.last_seen) : "code " + esc(f.code)}</small></span>`;
  if (f.direction === "in") return `<div class="fr-row">${head}<span class="fr-acts"><button class="btn sm" data-act="frRespond" data-arg="${f.id}:1">Accepter</button><button class="btn ghost sm" data-act="frRespond" data-arg="${f.id}:0">Refuser</button></span></div>`;
  if (f.direction === "out") return `<div class="fr-row">${head}<span class="fr-acts"><button class="btn ghost sm" data-act="frRemove" data-arg="${f.id}">Annuler</button></span></div>`;
  return `<div class="fr-row">${head}<span class="fr-acts"><button class="btn sm" data-act="frChat" data-arg="${f.id}" aria-label="Messages">💬</button><button class="btn ghost sm" data-act="frRemove" data-arg="${f.id}">${FR.confirm === f.id ? "Sûr ?" : "Retirer"}</button></span></div>`;
}
function viewFriends() {
  const shell = body => `<div class="sheet tall friends-sheet" role="dialog" aria-modal="true" aria-label="Amis">
    <div class="sheet-head"><h2>Amis</h2><button class="btn ghost sm" data-act="close">Fermer</button></div>${body}</div>`;
  if (!CLOUD.enabled()) return shell(`<div class="empty-note"><span>Les amis arrivent bientôt.</span></div>`);
  if (!CLOUD.signedIn) return shell(`<div class="empty-note"><span>Connecte-toi avec Discord pour ajouter des amis et retrouver leur jardin.</span><button class="btn discord" data-act="cloudLogin">${DISCORD_ICON}Se connecter avec Discord</button></div>`);
  if (CLOUD.blocked) return shell(`<p class="cloud-warn">${esc(CLOUD.blocked)}</p>`);
  if (!FR.loaded) return shell(FR.error ? `<p class="cloud-warn">${esc(FR.error)}</p><button class="btn ghost" data-act="frRefresh">Réessayer</button>` : `<div class="empty-note"><span>Chargement…</span></div>`);
  const friends = FR.list.filter(f => f.direction === "friend"), inn = incoming(), out = FR.list.filter(f => f.direction === "out");
  const tabs = [["friends", `Amis <span class="num">${friends.length}</span>`], ["requests", `Demandes${inn.length ? ` <span class="fr-badge">${inn.length}</span>` : ""}`], ["add", "Ajouter"]];
  let body = "";
  if (FR.tab === "friends") body = friends.length ? `<div class="fr-list">${friends.map(friendRow).join("")}</div>` : `<div class="empty-note"><span>Pas encore d’amis. Partage ton code ou ajoute quelqu’un dans l’onglet « Ajouter ».</span></div>`;
  if (FR.tab === "requests") body = `<h3 class="cat-title">Reçues</h3>${inn.length ? `<div class="fr-list">${inn.map(friendRow).join("")}</div>` : `<p class="small muted" style="margin:0">Aucune demande reçue.</p>`}
    <h3 class="cat-title">Envoyées</h3>${out.length ? `<div class="fr-list">${out.map(friendRow).join("")}</div>` : `<p class="small muted" style="margin:0">Aucune demande en attente.</p>`}`;
  if (FR.tab === "add") {
    const res = FR.results;
    body = `<form class="fr-search" data-form="frSearch"><input id="fr-q" maxlength="20" placeholder="Code ami ou pseudo" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(FR.q)}"><button class="btn" type="submit">${FR.searching ? "…" : "Chercher"}</button></form>
      <p class="small muted" style="margin:0">Code à 5 caractères (ex. K7Q2M) ou début du pseudo.</p>
      ${res == null ? "" : res.length ? `<div class="fr-list">${res.map(r => { const rel = FR.list.find(f => f.user_id === r.user_id);
        return `<div class="fr-row"><span class="fr-av">${friendAvatar(r.avatar)}</span><span class="fr-id"><b>${esc(r.name)}</b><small>Niv. ${r.level} · code ${esc(r.code)}</small></span><span class="fr-acts">${rel ? `<span class="small muted">${rel.direction === "friend" ? "Déjà ami" : rel.direction === "out" ? "Demande envoyée" : "T’a demandé"}</span>` : `<button class="btn sm" data-act="frAdd" data-arg="${r.user_id}">Ajouter</button>`}</span></div>`; }).join("")}</div>`
        : `<p class="small muted" style="margin:0">Aucun joueur trouvé.</p>`}`;
  }
  return shell(`<div class="fr-code"><span><small>Ton code ami</small><b class="num">${esc(FR.code)}</b></span><button class="btn ghost sm" data-act="frCopy">Copier</button>${navigator.share ? `<button class="btn ghost sm" data-act="frShare">Partager</button>` : ""}</div>
    <div class="subtabs" style="grid-template-columns:repeat(3,1fr)">${tabs.map(([k, l]) => `<button data-act="frTab" data-arg="${k}" aria-pressed="${FR.tab === k}">${l}</button>`).join("")}</div>
    ${FR.error ? `<p class="cloud-warn">${esc(FR.error)}</p>` : ""}${body}`);
}
// Page de discussion avec un ami (les messages arriveront dans une prochaine version).
function viewChat() {
  const f = FR.list.find(x => x.id === FR.chat); if (!f) return viewFriends();
  return `<div class="sheet tall chat-sheet" role="dialog" aria-modal="true" aria-label="Messages avec ${esc(f.name)}">
    <div class="sheet-head chat-head"><button class="btn ghost sm" data-act="frBack" aria-label="Retour">‹</button><span class="fr-av">${friendAvatar(f.avatar)}</span><span class="fr-id"><b>${esc(f.name)}</b><small>${seenAgo(f.last_seen)}</small></span></div>
    <div class="chat-body"><div class="empty-note"><span>Les messages arrivent bientôt 🌱<br>Tu pourras bientôt écrire à ${esc(f.name)} ici.</span></div></div>
    <div class="chat-input"><input placeholder="Écrire un message…" disabled><button class="btn" disabled>Envoyer</button></div></div>`;
}
const openFriends = () => { modalView = () => FR.chat != null ? viewChat() : viewFriends(); $("#modal").innerHTML = modalView(); openModal(); loadFriends(true); };
document.addEventListener("submit", async ev => {
  if (ev.target.dataset?.form !== "frSearch") return; ev.preventDefault();
  const q = $("#fr-q").value.trim(); FR.q = q; if (q.length < 2) { FR.results = []; render(true); return; }
  FR.searching = true; render(true);
  try { FR.results = await CLOUD.rpc("search_players", { q }) || []; FR.error = ""; } catch (e) { FR.error = "Recherche impossible pour le moment."; }
  FR.searching = false; render(true);
});
const FRIENDS_ACTS = {
  openFriends() { FR.chat = null; openFriends(); },
  frTab(t) { FR.tab = t; FR.confirm = null; render(true); },
  frRefresh() { loadFriends(true); },
  async frCopy() { try { await navigator.clipboard.writeText(FR.code); toast(`Code ${FR.code} copié !`); } catch (e) { toast(`Ton code : ${FR.code}`); } },
  frShare() { navigator.share?.({ title: "Potager idle", text: `Ajoute-moi en ami sur Potager idle ! Mon code : ${FR.code}`, url: location.origin + location.pathname }).catch(() => {}); },
  async frAdd(id) {
    try { const r = await CLOUD.rpc("send_friend_request", { target: id }); toast(r === "acceptee" ? "Vous êtes maintenant amis !" : r === "deja_amis" ? "Vous êtes déjà amis." : "Demande envoyée !"); SFX.play("success"); }
    catch (e) { toast(/trop/.test(e.message) ? "Trop de demandes en attente." : "Demande impossible pour le moment."); }
    loadFriends(true);
  },
  async frRespond(arg) {
    const [id, ok] = arg.split(":");
    try { await CLOUD.rpc("respond_friend_request", { fid: +id, accept: ok === "1" }); if (ok === "1") { toast("Nouvel ami !"); SFX.play("success"); } } catch (e) { toast("Action impossible pour le moment."); }
    loadFriends(true);
  },
  async frRemove(id) {
    const f = FR.list.find(x => x.id === +id);
    if (f?.direction === "friend" && FR.confirm !== +id) { FR.confirm = +id; render(true); setTimeout(() => { FR.confirm = null; }, 4000); return; }
    FR.confirm = null;
    try { await CLOUD.rpc("remove_friendship", { fid: +id }); } catch (e) { toast("Action impossible pour le moment."); }
    loadFriends(true);
  },
  frChat(id) { FR.chat = +id; render(true); },
  frBack() { FR.chat = null; render(true); },
};
