"use strict";
/* ---------------- « J'aime ton jardin » ----------------
   Depuis la visite, un cœur par ami et par semaine (docs/jaime.sql). Aucun bonus :
   celui qui le reçoit voit quelques cœurs défiler sur son écran, et une ligne dans les Nouvelles. */
const HEART_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.4 3.5 4.3 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" fill="currentColor"/></svg>`;
const LIKE_KEEP = 8 * 24 * 3600e3;

// Pluie de cœurs : courte, ne bloque rien (on peut jouer pendant ce temps).
function heartRain(names) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { toast(`❤️ <b>${esc(names.join(" et "))}</b> ${names.length > 1 ? "aiment" : "aime"} ton jardin`); return; }
  const box = document.createElement("div"); box.className = "heart-rain"; box.setAttribute("aria-hidden", "true");
  const cols = ["#e2473b", "#f06b8b", "#ff8fab", "#e0628f"];
  for (let i = 0; i < 22; i++) {
    const h = document.createElement("i"); h.innerHTML = HEART_ICON;
    h.style.left = (4 + Math.random() * 92) + "%"; h.style.color = cols[i % cols.length];
    h.style.setProperty("--s", (.7 + Math.random() * .8).toFixed(2)); h.style.setProperty("--dx", (Math.random() * 60 - 30).toFixed(0) + "px");
    h.style.animationDelay = (Math.random() * 1.1).toFixed(2) + "s"; h.style.animationDuration = (2.2 + Math.random() * 1.2).toFixed(2) + "s";
    box.appendChild(h);
  }
  const label = document.createElement("span"); label.className = "heart-label";
  label.innerHTML = `❤️ <b>${esc(names.join(" et "))}</b> ${names.length > 1 ? "aiment" : "aime"} ton jardin`;
  box.appendChild(label); document.body.appendChild(box);
  SFX.play("success"); setTimeout(() => box.remove(), 4200);
}

// Cœurs reçus : vérifiés à l'ouverture, puis chaque minute. Les nouveaux font pleuvoir des cœurs.
async function loadLikes() {
  if (!friendsReady() || (typeof tutoBusy === "function" && tutoBusy())) return; // pendant le tutoriel : plus tard
  let rows; try { rows = await CLOUD.rpc("my_likes") || []; } catch (e) { return; }
  const t = now(), known = new Set((S.likes || []).map(l => l.id));
  const fresh = rows.filter(r => r && !known.has(r.id)).map(r => ({ id: r.id, at: Math.min(t, Date.parse(r.at) || t), name: r.name || "Un ami", avatar: r.avatar || null }));
  S.likes = (S.likes || []).filter(l => t - l.at < LIKE_KEEP).concat(fresh);
  if (!fresh.length) return;
  const rain = fresh.filter(l => l.at >= (S.resetAt || 0)); // les cœurs d'avant « Recommencer » ne repleuvent pas
  save(); if (rain.length) heartRain([...new Set(rain.map(l => l.name))]); render(true);
}
setInterval(() => { if (friendsReady() && !document.hidden) loadLikes(); }, 60e3);
addEventListener("load", () => setTimeout(loadLikes, 4500));
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(loadLikes, 1200); });

/* ---------- Dans la visite ---------- */
async function loadLikeStatus() {
  const f = visitFriend(); if (!f) return;
  try { VISIT.liked = !!(await CLOUD.rpc("liked_this_week", { target: f.user_id })); } catch (e) { VISIT.liked = null; }
  if (VISIT.id === f.id) render(true);
}
const likeBtnHTML = f => `<button class="btn like-btn${VISIT.liked ? " on" : ""}" data-act="visitLike" ${VISIT.liked || VISIT.liking ? "disabled" : ""} aria-label="${VISIT.liked ? `Tu aimes déjà le jardin de ${esc(f.name)} cette semaine` : `J’aime le jardin de ${esc(f.name)}`}" title="${VISIT.liked ? "Déjà aimé cette semaine" : "J’aime ton jardin"}">${HEART_ICON}</button>`;
// Petite gerbe de cœurs au-dessus du bouton, pour le retour visuel.
function likeBurst(el) {
  const r = el.getBoundingClientRect(), box = document.createElement("div"); box.className = "fw-fx"; document.body.appendChild(box);
  for (let i = 0; i < 9; i++) { const h = document.createElement("i"); h.className = "like-pop"; h.innerHTML = HEART_ICON;
    h.style.left = r.left + r.width / 2 + "px"; h.style.top = r.top + r.height / 2 + "px"; h.style.setProperty("--a", (i * 40 - 160) + "deg"); h.style.animationDelay = (i * 25) + "ms"; box.appendChild(h); }
  setTimeout(() => box.remove(), 1400);
}
const LIKE_ACTS = {
  async visitLike(_, ev) {
    const f = visitFriend(); if (!f || VISIT.liked || VISIT.liking) return;
    VISIT.liking = true; const el = ev?.target?.closest?.(".like-btn");
    try {
      await CLOUD.rpc("like_garden", { target: f.user_id });
      VISIT.liked = true; S.stats.likesGiven = (S.stats.likesGiven || 0) + 1; save();
      if (el) likeBurst(el); SFX.play("success"); buzz?.([10, 30, 10]);
    } catch (e) {
      const m = String(e.message || e);
      if (/deja_aime/.test(m)) VISIT.liked = true;
      else toast(/function|does not exist|404/.test(m) ? "Les « J’aime » ne sont pas encore prêts sur le serveur (script docs/jaime.sql)." : "Action impossible pour le moment.");
    }
    VISIT.liking = false; render(true);
  },
};
