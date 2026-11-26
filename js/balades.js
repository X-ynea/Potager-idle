"use strict";
/* ---------------- v4 · Onglet « Balades » : les mini-jeux ----------------
   Cinq petits jeux (pêche, forêt, memory, cueillette, ruche), 3 parties par jeu et par jour (jour de Paris).
   Les récompenses restent petites : des ingrédients de balade (WILD, js/data.js), un peu d'XP, parfois des pièces.
   S.games = { day, plays: { ruche: 2 }, best: { ruche: { week, score } } } */
const BALADES_LVL = 4;
const GAME_PLAYS = 3;
const GAMES = {
  ruche:      { name: "La ruche", tag: "Rythme", desc: "Touche les fleurs qui s’ouvrent pour que les abeilles viennent butiner.", gives: ["miel"], emoji: "🐝", color: "#f2b632" },
  peche:      { name: "Pêche à l’étang", tag: "Détente", desc: "Lance ta ligne et attends que le bouchon plonge…", gives: ["algue", "cresson", "menthe"], emoji: "🎣", color: "#5aa7ee", soon: true },
  foret:      { name: "Balade en forêt", tag: "Détente", desc: "Suis le sentier et fouille les buissons.", gives: ["chataigne", "mure", "noisette"], emoji: "🍂", color: "#8a5a3a", soon: true },
  memory:     { name: "Memory des graines", tag: "Mémoire", desc: "Retrouve les paires de sachets de graines.", coins: true, emoji: "🃏", color: "#9a6cf0", soon: true },
  cueillette: { name: "Cueillette express", tag: "Réflexes", desc: "Attrape les légumes qui tombent, pas les cailloux !", coins: true, emoji: "🧺", color: "#ec7d2e", soon: true },
};
const GORDER = Object.keys(GAMES);

// Jour de Paris (AAAA-MM-JJ), comme le serveur.
const parisDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
function gamesState() {
  const g = S.games = S.games || {};
  const d = parisDay();
  if (g.day !== d) { g.day = d; g.plays = {}; }
  g.plays = g.plays || {}; g.best = g.best || {};
  return g;
}
const playsLeft = id => Math.max(0, GAME_PLAYS - (gamesState().plays[id] || 0));
const weekBest = id => { const b = gamesState().best[id]; return b && b.week === weekId() ? b.score : 0; };

const SIGNPOST = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="10.8" y="2.5" width="2.4" height="19" rx="1" fill="currentColor"/><path d="M4 5.5h11.5l3 2.6-3 2.6H4z" fill="currentColor"/><path d="M20 12.5H8.5l-3 2.6 3 2.6H20z" fill="currentColor" opacity=".6"/></svg>`;
const gameArt = id => !VEC_ONLY && (IMG.games || []).includes(id) ? `<img src="assets/img/game-${id}.webp" alt="">` : `<span class="game-ph" style="--c:${GAMES[id].color}">${GAMES[id].emoji}</span>`;

function views_balades() {
  const head = `<section class="panel"><div class="row spread"><h2>Balades</h2><span class="small muted">${GAME_PLAYS} parties par jeu et par jour</span></div>
    <p class="small muted" style="margin:6px 0 0">Prends l’air ! Pêche, promène-toi ou aide les abeilles : tu rapporteras des ingrédients qu’on ne trouve pas au potager.</p></section>`;
  if (S.level < BALADES_LVL) return head + `<section class="panel"><div class="empty-note"><span style="font-size:2.4rem">${SIGNPOST}</span><span>Les balades ouvrent au niveau ${BALADES_LVL}.</span></div></section>`;
  const cards = GORDER.map(id => {
    const G = GAMES[id], left = playsLeft(id), best = weekBest(id);
    const gives = G.gives ? G.gives.map(k => `<span class="g-give">${wildArt(k)}${WILD[k].name}</span>`).join("") : `<span class="g-give">${coin}Pièces et XP</span>`;
    const dots = Array.from({ length: GAME_PLAYS }, (_, i) => `<i class="${i < left ? "on" : ""}"></i>`).join("");
    const btn = G.soon ? `<button class="btn ghost sm" disabled>Bientôt</button>`
      : left ? `<button class="btn sm" data-act="gamePlay" data-arg="${id}">Jouer</button>` : `<button class="btn ghost sm" disabled>Reviens demain</button>`;
    return `<div class="game-card${G.soon ? " soon" : ""}"><div class="g-art">${gameArt(id)}</div>
      <div class="g-body"><div class="g-title"><b>${G.name}</b><span class="g-tag">${G.tag}</span></div>
        <p class="small muted">${G.desc}</p><div class="g-gives">${gives}</div>
        <div class="g-foot">${G.soon ? "" : `<span class="g-dots" title="Parties restantes aujourd’hui">${dots}</span>`}${best ? `<span class="small muted">Record de la semaine : <b class="num">${best}</b></span>` : ""}<span class="g-btn">${btn}</span></div></div></div>`;
  }).join("");
  return head + `<div class="game-list">${cards}</div>`;
}

/* ---------------- Moteur commun ---------------- */
let GAME = null; // partie en cours
function gameOpen(id) {
  if (GAME || !playsLeft(id) || GAMES[id].soon || S.level < BALADES_LVL) return;
  const el = document.createElement("div"); el.id = "game"; el.className = "game g-" + id; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", GAMES[id].name);
  document.body.appendChild(el);
  history.pushState({ game: 1 }, "");
  GAME = { id, el, score: 0, state: "count", timers: [] };
  GAME_IMPL[id].setup(GAME);
  gameCountdown();
}
function gameCountdown() {
  const g = GAME; let n = 3;
  const box = document.createElement("div"); box.className = "g-count"; g.el.appendChild(box);
  const step = () => {
    if (GAME !== g) return;
    if (n === 0) { box.remove(); gameStart(); return; }
    box.textContent = n; box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop"); SFX.play("click"); n--;
    g.timers.push(setTimeout(step, 700));
  };
  step();
}
function gameStart() {
  const g = GAME, s = gamesState();
  s.plays[g.id] = (s.plays[g.id] || 0) + 1; save(); // la partie compte dès qu'elle commence
  g.state = "play"; g.t0 = performance.now(); g.paused = 0;
  const loop = ts => { if (GAME !== g || g.state !== "play") return; if (!document.hidden) GAME_IMPL[g.id].frame(g, ts - g.t0 - g.paused); g.raf = requestAnimationFrame(loop); };
  g.raf = requestAnimationFrame(loop);
}
// Jeu mis en pause quand l'appli passe en arrière-plan.
document.addEventListener("visibilitychange", () => {
  const g = GAME; if (!g || g.state !== "play") return;
  if (document.hidden) g.hiddenAt = performance.now(); else if (g.hiddenAt) { g.paused += performance.now() - g.hiddenAt; g.hiddenAt = 0; }
});
function gameEnd() {
  const g = GAME; if (!g || g.state === "end") return;
  const played = g.state === "play";
  g.state = "end"; cancelAnimationFrame(g.raf); g.timers.forEach(clearTimeout);
  if (!played) { gameClose(); return; } // arrêté pendant le compte à rebours : la partie ne compte pas
  const s = gamesState(), prev = weekBest(g.id), rec = g.score > prev;
  if (rec) s.best[g.id] = { week: weekId(), score: g.score };
  const r = GAME_IMPL[g.id].reward(g.score);
  for (const k in r.wild || {}) S.wild[k] = cnt(S.wild, k) + r.wild[k];
  if (r.coins) S.coins += r.coins;
  if (r.xp) addXp(r.xp);
  save();
  const items = [...Object.entries(r.wild || {}).map(([k, n]) => `<span class="g-rew">${wildArt(k)}<b>${n} × ${WILD[k].name}</b></span>`),
    r.coins ? `<span class="g-rew">${coin}<b>${fmt(r.coins)} pièces</b></span>` : "", r.xp ? `<span class="g-rew"><span class="g-xp">XP</span><b>+${r.xp} XP</b></span>` : ""].filter(Boolean);
  const left = playsLeft(g.id);
  g.el.querySelector(".g-end")?.remove();
  g.el.insertAdjacentHTML("beforeend", `<div class="g-end"><div class="g-card">
    <h2>${g.score ? GAME_IMPL[g.id].cheer(g.score) : "Oh, pas cette fois !"}</h2>
    <p class="g-final">Score : <b class="num">${g.score}</b>${rec ? ` <span class="g-rec">Record de la semaine !</span>` : prev ? ` <span class="small muted">(record : ${prev})</span>` : ""}</p>
    ${items.length ? `<div class="g-rews">${items.join("")}</div>` : `<p class="small muted">Rien de rapporté cette fois.</p>`}
    <p class="small muted">${left ? `Encore ${left} partie${left > 1 ? "s" : ""} aujourd’hui.` : "Plus de partie aujourd’hui pour ce jeu : reviens demain !"}</p>
    <div class="g-acts">${left ? `<button class="btn ghost" data-act="gameAgain">Rejouer</button>` : ""}<button class="btn" data-act="gameClose">Retour</button></div></div></div>`);
  SFX.play(items.length ? "success" : "click"); if (rec) buzz([20, 40, 20]);
}
function gameClose(fromBack) {
  const g = GAME; if (!g) return;
  if (g.state !== "end") { g.state = "end"; cancelAnimationFrame(g.raf); g.timers.forEach(clearTimeout); }
  g.el.remove(); GAME = null;
  if (!fromBack && history.state && history.state.game) history.back();
  render(true);
}
addEventListener("popstate", () => { if (GAME) { if (GAME.state === "play") gameEnd(); gameClose(true); } });

const BALADES_ACTS = {
  gamePlay(id) { gameOpen(id); },
  gameStop() { if (GAME && GAME.state === "play") gameEnd(); else gameClose(); },
  gameClose() { gameClose(); },
  gameAgain() { const id = GAME?.id; gameClose(); if (id) setTimeout(() => gameOpen(id), 350); },
};

/* ---------------- La ruche ----------------
   30 s. Des fleurs s'ouvrent une à une, de plus en plus vite ; une fleur touchée pendant qu'elle est ouverte
   envoie une abeille butiner (+1, fleur dorée +3). Toucher une fleur fermée ne fait rien de mal. */
const FLOWER = (c, gold) => `<svg viewBox="0 0 60 60" class="fl-open">${[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="30" cy="14" rx="9" ry="13" fill="${c}" transform="rotate(${a} 30 30)"/>`).join("")}<circle cx="30" cy="30" r="9" fill="${gold ? "#fff3b0" : "#f6c62f"}"/><circle cx="27" cy="27" r="2.4" fill="#fff" opacity=".7"/></svg>`;
const BUD = `<svg viewBox="0 0 60 60" class="fl-bud"><path d="M30 56V36" stroke="#4f9a3a" stroke-width="4" stroke-linecap="round"/><path d="M30 38c-9 0-12-9-12-15C18 14 24 8 30 4c6 4 12 10 12 19 0 6-3 15-12 15z" fill="#7cc24a"/><path d="M30 38c-4-6-4-20 0-34" stroke="#4f9a3a" stroke-width="2" fill="none"/></svg>`;
const BEE = `<svg viewBox="0 0 40 32"><ellipse cx="14" cy="9" rx="8" ry="6" fill="#fff" opacity=".85"/><ellipse cx="24" cy="8" rx="7" ry="5.5" fill="#fff" opacity=".75"/><ellipse cx="20" cy="20" rx="13" ry="9" fill="#f6c62f"/><path d="M15 12v16M21 11.5v17" stroke="#3a2c1f" stroke-width="3.2"/><circle cx="31" cy="18" r="2" fill="#3a2c1f"/></svg>`;
const RUCHE_COLORS = ["#ff8fab", "#c9a5ff", "#ffffff", "#9fd0ff", "#ffb36b"];
const RUCHE_SPOTS = [[50, 50], [24, 36], [76, 36], [24, 66], [76, 66], [50, 22], [50, 80]]; // une fleur au centre, six autour
const RUCHE_T = 30000;

const GAME_IMPL = {
  ruche: {
    setup(g) {
      g.flowers = RUCHE_SPOTS.map(() => ({ open: false, until: 0, gold: false }));
      g.next = 400; g.combo = 0;
      g.el.innerHTML = `<div class="g-top"><button class="g-x" data-act="gameStop" aria-label="Arrêter">${X_SVG}</button><b class="g-name">${GAMES.ruche.name}</b><span class="g-score">${wildArt("miel")}<b class="num">0</b></span></div>
        <div class="g-time"><i></i></div>
        <div class="g-field ruche-field"><div class="hive" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 6c14 0 22 10 22 22v20H10V28C10 16 18 6 32 6z" fill="#e8a83a"/><path d="M12 22h40M10 32h44M10 42h44" stroke="#c4862a" stroke-width="3"/><path d="M26 48a6 6 0 0 1 12 0z" fill="#5a3a1a"/><rect x="6" y="48" width="52" height="6" rx="3" fill="#a3743a"/></svg></div>
        ${RUCHE_SPOTS.map(([x, y], i) => `<button class="flower" data-i="${i}" style="left:${x}%;top:${y}%" aria-label="Fleur">${BUD}<span class="fl-wrap"></span></button>`).join("")}</div>
        <p class="g-hint">Touche les fleurs dès qu’elles s’ouvrent !</p>`;
      g.el.querySelector(".ruche-field").addEventListener("pointerdown", ev => {
        const b = ev.target.closest(".flower"); if (!b || g.state !== "play") return;
        ev.preventDefault(); GAME_IMPL.ruche.tap(g, +b.dataset.i, b);
      });
    },
    open(g, i, e) {
      const f = g.flowers[i], b = g.el.querySelector(`.flower[data-i="${i}"]`);
      f.open = true; f.gold = Math.random() < .12; f.until = e + 1700 - 750 * Math.min(1, e / RUCHE_T);
      b.querySelector(".fl-wrap").innerHTML = FLOWER(f.gold ? "#ffd84a" : pick(RUCHE_COLORS), f.gold);
      b.classList.add("open"); b.classList.toggle("gold", f.gold);
    },
    close(g, i, missed) {
      const f = g.flowers[i], b = g.el.querySelector(`.flower[data-i="${i}"]`);
      f.open = false; b.classList.remove("open", "gold");
      if (missed) { g.combo = 0; b.classList.add("wilt"); g.timers.push(setTimeout(() => b.classList.remove("wilt"), 300)); }
    },
    tap(g, i, b) {
      const f = g.flowers[i];
      if (!f.open) { b.classList.remove("nope"); void b.offsetWidth; b.classList.add("nope"); return; }
      const v = f.gold ? 3 : 1; g.score += v; g.combo++;
      GAME_IMPL.ruche.close(g, i, false);
      g.el.querySelector(".g-score b").textContent = g.score;
      // Une abeille part de la ruche jusqu'à la fleur.
      const field = g.el.querySelector(".ruche-field"), fr = field.getBoundingClientRect(), br = b.getBoundingClientRect(), hr = field.querySelector(".hive").getBoundingClientRect();
      const bee = document.createElement("span"); bee.className = "bee"; bee.innerHTML = BEE;
      bee.style.left = (hr.left + hr.width / 2 - fr.left) + "px"; bee.style.top = (hr.top + hr.height / 2 - fr.top) + "px";
      field.appendChild(bee);
      requestAnimationFrame(() => { bee.style.transform = `translate(${br.left + br.width / 2 - hr.left - hr.width / 2}px, ${br.top + br.height / 2 - hr.top - hr.height / 2}px) scale(1.1)`; });
      g.timers.push(setTimeout(() => bee.remove(), 650));
      const pop = document.createElement("span"); pop.className = "g-pop" + (v > 1 ? " gold" : ""); pop.textContent = "+" + v;
      pop.style.left = (br.left + br.width / 2 - fr.left) + "px"; pop.style.top = (br.top - fr.top) + "px"; field.appendChild(pop);
      g.timers.push(setTimeout(() => pop.remove(), 800));
      SFX.play(v > 1 ? "coin" : "plant"); buzz(8);
    },
    frame(g, e) {
      const bar = g.el.querySelector(".g-time i"); bar.style.width = Math.max(0, 100 - e / RUCHE_T * 100).toFixed(1) + "%";
      if (e >= RUCHE_T) { g.flowers.forEach((f, i) => f.open && GAME_IMPL.ruche.close(g, i, false)); gameEnd(); return; }
      g.flowers.forEach((f, i) => { if (f.open && e >= f.until) GAME_IMPL.ruche.close(g, i, true); });
      if (e >= g.next) {
        const d = Math.min(1, e / RUCHE_T), openN = g.flowers.filter(f => f.open).length;
        const closed = g.flowers.map((f, i) => f.open ? -1 : i).filter(i => i >= 0);
        if (openN < 3 && closed.length) GAME_IMPL.ruche.open(g, pick(closed), e);
        g.next = e + 850 - 420 * d + Math.random() * 200;
      }
    },
    // Un pot de miel dès 3 points, puis un de plus tous les 12 points (4 au plus). Un peu d'XP.
    reward(score) {
      const miel = score < 3 ? 0 : Math.min(4, 1 + Math.floor(score / 12));
      return { wild: miel ? { miel } : {}, xp: Math.min(4 + S.level, Math.round(score / 2)) };
    },
    cheer: s => s >= 36 ? "Reine des abeilles !" : s >= 24 ? "Quel bourdonnement !" : s >= 12 ? "Les abeilles te remercient !" : "Un peu de miel !",
  },
};
