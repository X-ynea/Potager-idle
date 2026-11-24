"use strict";
/* ---------------- Compte en ligne : sauvegarde dans le cloud (Supabase, connexion Discord) ----------------
   Facultatif : sans compte, le jeu marche comme avant. Avec un compte, la partie est envoyée en ligne
   régulièrement et récupérée sur les autres appareils. Rien d'autre que la sauvegarde n'est stocké. */
const CLOUD = (() => {
  const cfg = typeof CLOUD_CONFIG === "object" ? CLOUD_CONFIG : {};
  const KEY = IS_TEST ? "potager-cloud-test" : "potager-cloud"; // sessions séparées entre version des joueurs et version de test
  const enabled = () => !!(cfg.url && cfg.anonKey);
  // Les sauvegardes de la version de test sont marquées : un compte ne sert jamais aux deux versions.
  const payload = () => IS_TEST ? { ...S, cloudTest: true } : S;
  let blocked = ""; // compte refusé pour cette version (compte principal en test, ou compte de test sur la version des joueurs)
  let sess = null, busy = false, lastSync = 0, lastError = "", dirty = false;
  try { sess = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  const keep = () => { try { sess ? localStorage.setItem(KEY, JSON.stringify(sess)) : localStorage.removeItem(KEY); } catch (e) {} };

  // Retour de Discord : la session arrive dans l'adresse (#access_token=…).
  (() => {
    if (!location.hash.includes("access_token")) return;
    const h = new URLSearchParams(location.hash.slice(1));
    sess = { access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_at: Date.now() + (+h.get("expires_in") || 3600) * 1000, user: null, fresh: true };
    keep(); history.replaceState(null, "", location.pathname + location.search);
  })();

  const api = async (path, opts = {}, auth = true) => {
    const headers = { apikey: cfg.anonKey, "Content-Type": "application/json", ...(opts.headers || {}) };
    if (auth && sess) headers.Authorization = `Bearer ${sess.access_token}`;
    const res = await fetch(cfg.url + path, { ...opts, headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  async function token() {
    if (!sess) return null;
    if (Date.now() > sess.expires_at - 60e3) {
      const r = await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: sess.refresh_token }) }, false);
      sess = { ...sess, access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Date.now() + r.expires_in * 1000 }; keep();
    }
    if (!sess.user) {
      const u = await api("/auth/v1/user");
      const m = u.user_metadata || {};
      sess.user = { id: u.id, name: m.full_name || m.custom_claims?.global_name || m.name || "Joueur", avatar: m.avatar_url || null }; keep();
    }
    return sess.access_token;
  }
  const remote = async () => (await api(`/rest/v1/saves?select=data,updated_at&user_id=eq.${sess.user.id}`))?.[0] || null;
  async function push() {
    if (blocked) throw new Error(blocked);
    await token();
    await api("/rest/v1/saves?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: sess.user.id, data: payload(), updated_at: new Date(S.last || Date.now()).toISOString() }) });
    lastSync = Date.now(); dirty = false; lastError = "";
  }
  // Ouverture ou connexion : on compare la partie en ligne et celle de l'appareil.
  async function sync(manual) {
    if (!enabled() || !sess || busy) return;
    busy = true;
    try {
      await token();
      const r = await remote();
      // Garde-fou : ne jamais mélanger une partie de test et une vraie partie.
      if (r && !!r.data?.cloudTest !== IS_TEST) {
        blocked = IS_TEST ? "Ce compte Discord a déjà une vraie partie : utilise un compte de test ici." : "Ce compte Discord sert à la version de test : utilise ton compte principal.";
        lastError = blocked; busy = false; if (manual) toast(blocked); if (!$("#modal").hidden) render(true); return;
      }
      blocked = "";
      const fresh = sess.fresh; if (fresh) { delete sess.fresh; keep(); }
      if (!r) await push();
      else {
        const rs = r.data, rt = Date.parse(r.updated_at) || 0, lt = S.last || 0;
        const same = rs && rs.level === S.level && rs.xp === S.xp && rs.coins === S.coins;
        const progress = x => (x?.stats?.harvest || 0) > 0 || (x?.level || 1) > 1;
        if (same) lastSync = Date.now();
        else if (!progress(S)) useRemote(rs);                                     // appareil sans partie : on reprend celle du compte
        else if (fresh && progress(rs)) askChoice(rs);            // 1ʳᵉ connexion avec deux parties : on demande
        else if (rt > lt + 5000) useRemote(rs);                                     // la partie en ligne est plus récente
        else await push();                                                          // celle de l'appareil est plus récente
      }
      lastError = "";
      if (manual) toast("Partie synchronisée.");
      showGate();
    } catch (e) { lastError = String(e.message || e); if (manual) toast("Synchronisation impossible pour le moment."); }
    busy = false; if (typeof render === "function" && !$("#modal").hidden) render(true);
  }
  function useRemote(rs) { S = migrate(rs); save(); applyTheme(); lastSync = Date.now(); commit(); toast("Partie récupérée depuis ton compte."); }
  function askChoice(rs) {
    const L = (s, n) => `<button class="set-link" data-act="cloudPick" data-arg="${n}"><span class="ico">${n === "remote" ? "☁️" : "📱"}</span><span><b>${n === "remote" ? "La partie en ligne" : "La partie de cet appareil"}</b><small>Niveau ${s.level} · ${fmt(s.coins)} pièces · ${fmt(s.stats?.harvest || 0)} récoltes</small></span></button>`;
    CLOUD._choice = rs;
    modalView = () => `<div class="sheet" role="dialog" aria-modal="true" aria-label="Choisir une partie">
      <div class="sheet-head"><h2>Deux parties trouvées</h2></div>
      <p class="small muted" style="margin:0">Ton compte a déjà une partie en ligne. Laquelle veux-tu garder ? L’autre sera remplacée.</p>
      <div class="set-list">${L(rs, "remote")}${L(S, "local")}</div></div>`;
    $("#modal").innerHTML = modalView(); openModal();
  }
  // Sauvegarde régulière en ligne (et à la fermeture).
  setInterval(() => { if (enabled() && sess?.user && !busy && Date.now() - lastSync > 60e3) push().catch(e => { lastError = String(e.message || e); }); }, 15e3);
  addEventListener("pagehide", () => {
    if (!enabled() || !sess?.user || blocked || Date.now() > sess.expires_at) return;
    try { fetch(cfg.url + "/rest/v1/saves?on_conflict=user_id", { method: "POST", keepalive: true, headers: { apikey: cfg.anonKey, Authorization: `Bearer ${sess.access_token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: sess.user.id, data: payload(), updated_at: new Date(S.last || Date.now()).toISOString() }) }); } catch (e) {}
  });
  addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });

  return {
    enabled, sync, push,
    get user() { return sess?.user || null; }, get signedIn() { return !!sess; },
    get lastSync() { return lastSync; }, get error() { return lastError; }, get blocked() { return blocked; },
    login() {
      const back = location.origin + location.pathname;
      location.href = `${cfg.url}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent(back)}`;
    },
    // Déconnexion : dernière sauvegarde en ligne, puis la partie quitte l'appareil (écran de connexion).
    async logout() {
      if (sess?.user && !blocked) { try { await push(); } catch (e) {} }
      sess = null; blocked = ""; lastError = ""; keep();
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      S = fresh(); closeModal(); render(true); showGate();
    },
    // Appel d'une fonction serveur (amis…). Renvoie son résultat.
    async rpc(name, args = {}) { if (!enabled() || !sess) throw new Error("non connecté"); await token(); return api(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) }); },
    async deleteAccount() { await token(); await api("/rest/v1/rpc/delete_me", { method: "POST", body: "{}" }); sess = null; keep(); },
  };
})();

function cloudSettingsHTML() {
  if (!CLOUD.enabled()) return "";
  const u = CLOUD.user;
  if (!CLOUD.signedIn) return `<div class="set-group"><h3>Compte</h3>
    <p class="small muted" style="margin:0">Facultatif : relie ta partie à ton compte Discord pour la sauvegarder en ligne et la retrouver sur tous tes appareils.</p>
    ${IS_TEST ? `<p class="cloud-warn">Version de test : connecte-toi avec un <b>compte Discord de test</b>, pas ton compte principal (navigation privée ou autre navigateur).</p>` : ""}
    <button class="btn discord" data-act="cloudLogin">${DISCORD_ICON}Se connecter avec Discord</button>
    <a class="small muted" href="confidentialite.html" target="_blank" rel="noopener">Données personnelles</a></div>`;
  const ago = CLOUD.lastSync ? Math.max(0, Math.round((Date.now() - CLOUD.lastSync) / 60000)) : null;
  return `<div class="set-group"><h3>Compte</h3>
    <div class="cloud-user">${u?.avatar ? `<img src="${u.avatar}" alt="">` : `<span class="cloud-ph">${DISCORD_ICON}</span>`}<span><b>${u ? u.name : "Connexion…"}</b><small>${CLOUD.blocked ? `<span class="cloud-err">${CLOUD.blocked}</span>` : CLOUD.error ? `Synchronisation en attente<br><span class="cloud-err">${CLOUD.error.replace(/[<>&]/g, "")}</span>` : ago == null ? "Synchronisation…" : `Sauvegardé en ligne ${ago < 1 ? "à l’instant" : `il y a ${ago} min`}`}</small></span></div>
    <div class="d-acts"><button class="btn ghost" data-act="cloudSync">Synchroniser</button><button class="btn ghost" data-act="cloudLogout">Se déconnecter</button></div>
    <a class="small muted" href="confidentialite.html" target="_blank" rel="noopener">Données personnelles</a></div>`;
}
// Dans la zone sensible des réglages.
const cloudDangerHTML = () => CLOUD.enabled() && CLOUD.signedIn ? `<button class="set-link" data-act="dangerOpen" data-arg="account"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span><b>Supprimer mon compte</b><small>${FRIENDS_ON ? "Efface tes données en ligne, tes amis et tes messages" : "Efface tes données en ligne"}</small></span></button>` : "";
const DISCORD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.3 5.3A16.6 16.6 0 0 0 15.2 4l-.5 1a15.3 15.3 0 0 0-5.4 0L8.8 4a16.6 16.6 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.7 16.7a16.7 16.7 0 0 0 5 2.5l1.1-1.7a10.7 10.7 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 11 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.3-.7-8.1-3-11.4zM8.7 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>`;
const CLOUD_ACTS = {
  cloudLogin() { CLOUD.login(); },
  cloudSync() { CLOUD.sync(true); },
  async cloudLogout() { await CLOUD.logout(); },
  async gateSwitch() { await CLOUD.logout(); },
  newsClose() { newsNow = false; showGate(); },
  async cloudPick(which) {
    closeModal();
    if (which === "remote" && CLOUD._choice) { S = migrate(CLOUD._choice); save(); applyTheme(); commit(); toast("Partie en ligne récupérée."); }
    try { await CLOUD.push(); } catch (e) {}
    CLOUD._choice = null; render(true);
  },
};

/* Écran de connexion : un compte Discord est nécessaire pour jouer (quand les comptes sont activés). */
// Annonce des comptes (v2.15) : une seule fois, pour les joueurs qui avaient déjà une partie.
// Gardée sur l'appareil (pas dans la partie) pour ne pas revenir après une déconnexion.
const NEWS_KEY = "potager-news-comptes" + (IS_TEST ? "-test" : "");
let newsNow = false;
function checkNews() {
  let seen = true; try { seen = !!localStorage.getItem(NEWS_KEY); } catch (e) {}
  if (seen || CLOUD.blocked) return;
  if ((S.stats?.harvest || 0) > 0 || S.level > 1) newsNow = true;
  try { localStorage.setItem(NEWS_KEY, "1"); } catch (e) {}
}
function newsHTML() {
  const signed = CLOUD.signedIn;
  return `<div class="gate-card news-card" role="dialog" aria-modal="true" aria-label="Du nouveau au potager">
    <img class="gate-logo" src="assets/img/xp-leaf.webp" alt="">
    <h1>Du nouveau au potager ! 🌱</h1>
    <div class="news-list">
      <p><b>Ton jardin a maintenant un compte.</b> ${signed ? "" : "Connecte-toi avec Discord pour continuer à jouer. "}Ta partie est sauvegardée en ligne et tu la retrouves sur tous tes appareils : téléphone, ordinateur, tablette.</p>
      ${signed ? "" : `<p><b>Rien n’est perdu.</b> Ta partie actuelle (niveau ${S.level}) sera reliée à ton compte dès ta connexion.</p>`}
      <p><b>Ton profil</b> prend ton pseudo et ta photo Discord. Tu peux toujours les changer avec le petit crayon.</p>
    </div>
    ${signed ? `<button class="btn big" data-act="newsClose">C’est parti !</button>` : `<button class="btn discord big" data-act="cloudLogin">${DISCORD_ICON}Se connecter avec Discord</button>`}
  </div>`;
}
function showGate() {
  let g = document.getElementById("gate");
  if (CLOUD.enabled() && typeof S !== "undefined") checkNews();
  const need = CLOUD.enabled() && (!CLOUD.signedIn || CLOUD.blocked);
  if (newsNow && CLOUD.enabled() && !CLOUD.blocked) {
    if (!g) { g = document.createElement("div"); g.id = "gate"; document.body.appendChild(g); }
    g.style.backgroundImage = `url("assets/img/bg-${typeof season === "function" ? season() : "printemps"}.webp")`;
    g.innerHTML = newsHTML(); return;
  }
  if (!need) { g?.remove(); return; }
  if (!g) { g = document.createElement("div"); g.id = "gate"; document.body.appendChild(g); }
  g.style.backgroundImage = `url("assets/img/bg-${typeof season === "function" ? season() : "printemps"}.webp")`;
  const hasLocal = !CLOUD.signedIn && typeof S !== "undefined" && ((S.stats?.harvest || 0) > 0 || S.level > 1);
  g.innerHTML = `<div class="gate-card" role="dialog" aria-modal="true" aria-label="Connexion">
    <img class="gate-logo" src="assets/img/xp-leaf.webp" alt="">
    <h1>Potager idle</h1>
    ${CLOUD.blocked ? `<p class="cloud-warn">${CLOUD.blocked}</p><button class="btn discord big" data-act="gateSwitch">${DISCORD_ICON}Changer de compte</button>`
      : `<p>Connecte-toi avec Discord pour jouer : ta partie est sauvegardée en ligne et te suit sur tous tes appareils.</p>
    ${hasLocal ? `<p class="small gate-note">Ta partie actuelle (niveau ${S.level}) sera reliée à ton compte.</p>` : ""}
    ${IS_TEST ? `<p class="cloud-warn">Version de test : utilise un compte Discord de test.</p>` : ""}
    <button class="btn discord big" data-act="cloudLogin">${DISCORD_ICON}Se connecter avec Discord</button>`}
    <a class="small muted" href="confidentialite.html" target="_blank" rel="noopener">Données personnelles</a>
  </div>`;
}
