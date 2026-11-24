"use strict";
/* ---------------- Profil du joueur ----------------
   Pseudo, photo de profil, bannière et titre. Les images importées sont recadrées
   et compressées sur l'appareil, puis gardées dans la sauvegarde (rien n'est envoyé en ligne). */
const BANNERS = [
  ["garden", "Jardin", "assets/img/bg-garden.webp"], ["printemps", "Printemps", "assets/img/bg-printemps.webp"],
  ["ete", "Été", "assets/img/bg-ete.webp"], ["automne", "Automne", "assets/img/bg-automne.webp"], ["hiver", "Hiver", "assets/img/bg-hiver.webp"],
];
const profile = () => { S.profile = Object.assign({ name: "", avatar: null, banner: "garden" }, S.profile || {}); return S.profile; };
// Compte Discord connecté : son pseudo et sa photo servent par défaut.
const discordUser = () => (typeof CLOUD !== "undefined" && CLOUD.signedIn && !CLOUD.blocked && CLOUD.user) || null;
const profileName = () => profile().name || discordUser()?.name || "Jardinier";
// Photo : importée (data:…), portrait de voisin (v:<n>), feuille dorée ("leaf"),
// ou par défaut la photo Discord (sinon la feuille).
function avatarSrc(a = profile().avatar) {
  if (!a) return discordUser()?.avatar || "assets/img/xp-leaf.webp";
  if (a === "leaf") return "assets/img/xp-leaf.webp";
  if (a.startsWith("v:")) return `assets/img/villager-${+a.slice(2)}.webp`;
  return a;
}
const bannerSrc = (b = profile().banner) => b && b.startsWith("data:") ? b : (BANNERS.find(x => x[0] === b) || BANNERS[0])[2];
const ownedTitles = () => ACHIEVEMENTS.flatMap(a => a.tiers.map((t, i) => ({ t, i, a }))).filter(o => o.t.title && ((S.ach || {})[o.a.id] || 0) > o.i).map(o => o.t.title);

const shortName = n => { const w = n.split(" "); return ["Mme", "Mlle", "Papi", "Tante"].includes(w[0]) ? w[w.length - 1] : w[0]; };
function viewProfile() {
  const P = profile(), titles = ownedTitles(), pick = UI.profilePick;
  const achDone = ACHIEVEMENTS.reduce((t, a) => t + ((S.ach || {})[a.id] || 0), 0);
  const banner = bannerSrc();
  return `<div class="sheet tall profile-sheet" role="dialog" aria-modal="true" aria-label="Profil">
    <div class="sheet-head"><h2>Profil</h2><button class="btn ghost sm" data-act="close">Fermer</button></div>
    <div class="pf-card">
      <button class="pf-banner${banner.startsWith("data:") ? " photo" : ""}" style="background-image:url('${banner}')" data-act="profilePick" data-arg="banner" aria-label="Changer la bannière"><span class="pf-edit">${PENCIL}</span></button>
      <button class="pf-avatar" data-act="profilePick" data-arg="avatar" aria-label="Changer la photo de profil"><img src="${avatarSrc()}" alt=""><span class="pf-edit">${PENCIL}</span></button>
      <div class="pf-id">
        ${UI.editName ? `<input id="pf-name" class="pf-name" maxlength="20" value="${profileName().replace(/"/g, "&quot;")}" placeholder="Ton pseudo" aria-label="Pseudo" autocomplete="off" spellcheck="false" enterkeyhint="done">`
          : `<button class="pf-name-btn" data-act="editName" aria-label="Modifier le pseudo"><b>${profileName().replace(/[<>&]/g, "")}</b><span class="pf-edit inline">${PENCIL}</span></button>`}
        <span class="pf-sub">Niveau ${S.level}${S.title ? ` · <span class="title-tag">${S.title}</span>` : ""}</span>
      </div>
    </div>
    <button class="set-link fr-open" data-act="openFriends"><span class="ico fr-ico-people">${FR_ICONS.people}</span><span><b>Mes amis</b><small>${FR.loaded ? `${FR.list.filter(f => f.direction === "friend").length} ami${FR.list.filter(f => f.direction === "friend").length > 1 ? "s" : ""}${incoming().length ? ` · ${incoming().length} demande${incoming().length > 1 ? "s" : ""} reçue${incoming().length > 1 ? "s" : ""}` : ""}` : "Code ami, demandes, messages"}</small></span>${incoming().length ? `<span class="fr-badge">${incoming().length}</span>` : ""}</button>
    ${pick === "avatar" ? `<div class="set-group"><h3>Photo de profil</h3>
      <div class="pf-grid">
        <label class="pf-opt upload"><input type="file" accept="image/*" data-file="avatar" hidden><span>+</span><small>Ma photo</small></label>
        ${discordUser()?.avatar ? `<button class="pf-opt${!P.avatar ? " sel" : ""}" data-act="profileSet" data-arg="avatar:"><img src="${discordUser().avatar}" alt=""><small>Discord</small></button>` : ""}
        <button class="pf-opt${P.avatar === "leaf" || (!P.avatar && !discordUser()?.avatar) ? " sel" : ""}" data-act="profileSet" data-arg="avatar:leaf"><img src="assets/img/xp-leaf.webp" alt=""><small>Feuille</small></button>
        ${VILLAGERS.slice(0, VILLAGER_IMAGES).map((v, i) => `<button class="pf-opt${P.avatar === "v:" + i ? " sel" : ""}" data-act="profileSet" data-arg="avatar:v:${i}"><img src="assets/img/villager-${i}.webp" alt=""><small>${shortName(v.name)}</small></button>`).join("")}
      </div></div>` : ""}
    ${pick === "banner" ? `<div class="set-group"><h3>Bannière</h3>
      <div class="pf-grid banners">
        <label class="pf-opt upload"><input type="file" accept="image/*" data-file="banner" hidden><span>+</span><small>Mon image</small></label>
        ${BANNERS.map(([k, l, src]) => `<button class="pf-opt${P.banner === k ? " sel" : ""}" data-act="profileSet" data-arg="banner:${k}" style="background-image:url('${src}')"><small>${l}</small></button>`).join("")}
      </div></div>` : ""}
    <div class="set-group"><h3>Titre affiché</h3>
      ${titles.length ? `<div class="basket">${["", ...titles].map(ti => `<button class="chip title-chip" data-act="setTitle" data-arg="${ti}" aria-pressed="${(S.title || "") === ti}">${ti || "Aucun"}</button>`).join("")}</div>`
        : `<p class="small muted" style="margin:0">Certains succès débloquent un titre à afficher à côté de ton nom.</p>`}
    </div>
    <div class="set-group"><h3>Mon potager</h3>
      <div class="stats">${mi("Niveau", S.level)}${mi("Récoltes", fmt(S.stats.harvest || 0))}${mi("Succès", achDone)}${mi("Hybrides", `${S.hybrids.length} / ${ORDER.filter(k => PLANTS[k].hybrid).length}`)}${mi("Plats cuisinés", fmt(S.stats.cooked || 0))}${mi("Commandes", fmt(S.stats.orders || 0))}${mi("Visiteurs ailés", fmt(S.stats.butterflies || 0))}${mi("Bacs libérés", fmt(S.stats.weeds || 0))}</div>
    </div>
  </div>`;
}

// Recadre (carré pour la photo, 3:1 pour la bannière) et compresse une image choisie sur l'appareil.
function shrinkImage(file, w, h) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r;
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let out = c.toDataURL("image/webp", .82); if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", .82);
      ok(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(); };
    img.src = url;
  });
}
document.addEventListener("change", async ev => {
  const el = ev.target.closest?.("[data-file]"); if (!el || !el.files?.[0]) return;
  const kind = el.dataset.file;
  try {
    const data = await shrinkImage(el.files[0], kind === "avatar" ? 192 : 720, kind === "avatar" ? 192 : 240);
    profile()[kind] = data; UI.profilePick = null; SFX.play("success"); commit(); updateBrand(); profileChanged();
  } catch (e) { toast("Cette image n’a pas pu être ouverte."); }
});
document.addEventListener("change", ev => {
  if (ev.target.id !== "pf-name") return;
  const v = ev.target.value.trim().slice(0, 20);
  profile().name = v === (discordUser()?.name || "") ? "" : v; // identique au pseudo Discord : on suit Discord
  UI.editName = false; save(); updateBrand(); render(true); profileChanged();
});
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.id === "pf-name") ev.target.blur(); });
// Le profil public (vu par les amis) suit chaque modification.
const profileChanged = () => { if (typeof loadFriends === "function") loadFriends(true); };
// Pastille en haut à gauche : la photo de profil (ou la feuille dorée).
function updateBrand() {
  const b = document.querySelector(".brand"); if (!b) return;
  const src = avatarSrc(), img = b.querySelector("img");
  if (img && img.getAttribute("src") !== src) img.setAttribute("src", src);
  b.classList.toggle("has-avatar", !!profile().avatar && profile().avatar !== "leaf" || (!profile().avatar && !!discordUser()?.avatar));
  b.classList.toggle("has-req", typeof FR !== "undefined" && FR.list.some(f => f.direction === "in")); // demande d'ami reçue
  b.setAttribute("aria-label", `Profil de ${profileName()}`);
}
const PROFILE_ACTS = {
  openProfile() { UI.profilePick = null; modalView = viewProfile; $("#modal").innerHTML = viewProfile(); openModal(); },
  profilePick(k) { UI.profilePick = UI.profilePick === k ? null : k; render(true); },
  profileSet(arg) {
    const i = arg.indexOf(":"), k = arg.slice(0, i), v = arg.slice(i + 1);
    profile()[k] = v || (k === "banner" ? "garden" : null); UI.profilePick = null; SFX.play("click"); commit(); updateBrand(); profileChanged();
  },
  editName() { UI.editName = true; render(true); setTimeout(() => { const i = $("#pf-name"); if (i) { i.focus(); i.select(); } }, 30); },
};
