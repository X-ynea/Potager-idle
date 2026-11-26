"use strict";
/* ---------------- v4 · Onglet « Balades » : les mini-jeux ----------------
   Cinq petits jeux (pêche, forêt, memory, cueillette, ruche), 3 parties par jeu et par jour (jour de Paris).
   Les récompenses restent petites : des ingrédients de balade (WILD, js/data.js), un peu d'XP, parfois des pièces.
   S.games = { day, plays: { ruche: 2 }, best: { ruche: { week, score } } } */
const BALADES_LVL = 4;
const GAME_PLAYS = 3;
const GAMES = {
  ruche:      { name: "La ruche", tag: "Rythme", desc: "Touche les fleurs qui s’ouvrent pour que les abeilles viennent butiner.", gives: ["miel"],
    rules: ["Des fleurs s’ouvrent une à une dans le pré, de plus en plus vite.", "Touche une fleur ouverte avant qu’elle se referme : une abeille part de la ruche pour la butiner.", "Une fleur dorée vaut 3 points. Toucher un bouton encore fermé ne fait rien perdre.", "Tu as 30 secondes. Plus tu butines, plus tu rapportes de miel (jusqu’à 4 pots)."], emoji: "🐝", color: "#f2b632" },
  peche:      { name: "Pêche à l’étang", tag: "Détente", desc: "Lance ta ligne et attends que le bouchon plonge…", gives: ["algue", "cresson", "menthe"], emoji: "🎣", color: "#5aa7ee",
    rules: ["Touche l’étang pour lancer ta ligne.", "Attends que le bouchon plonge pour de bon, avec un grand « plouf », puis touche vite ! S’il ne fait que frétiller, patience…", "Algues 1 point, cresson 2, menthe d’eau 3 (la plus rare).", "Tu as 40 secondes. Ton panier garde tes 5 plus belles prises."] },
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
  const head = `<section class="panel"><div class="row spread"><h2>Balades</h2><span class="small muted">${GAME_PLAYS} parties par jeu et par jour</span></div></section>`;
  if (S.level < BALADES_LVL) return head + `<section class="panel"><div class="empty-note"><span style="font-size:2.4rem">${SIGNPOST}</span><span>Les balades ouvrent au niveau ${BALADES_LVL}.</span></div></section>`;
  const cards = GORDER.map(id => {
    const G = GAMES[id], left = playsLeft(id), best = weekBest(id);
    const gives = G.gives ? G.gives.map(k => `<span class="g-give">${wildArt(k)}${WILD[k].name}</span>`).join("") : `<span class="g-give">${coin}Pièces et XP</span>`;
    const dots = Array.from({ length: GAME_PLAYS }, (_, i) => `<i class="${i < left ? "on" : ""}"></i>`).join("");
    const btn = left ? `<button class="btn ghost sm g-help" data-act="gameHelp" data-arg="${id}" aria-label="Comment jouer">?</button><button class="btn sm" data-act="gamePlay" data-arg="${id}">Jouer</button>` : `<button class="btn ghost sm" disabled>Reviens demain</button>`;
    return `<div class="game-card${G.soon ? " soon" : ""}"><div class="g-art">${gameArt(id)}</div>
      <div class="g-body"><div class="g-title"><b>${G.name}</b><span class="g-tag">${G.tag}</span>${G.soon ? `<span class="g-tag g-soon">Bientôt</span>` : ""}</div>
        <div class="g-gives">${gives}</div>
        ${G.soon ? "" : `<div class="g-foot"><span class="g-dots" title="Parties restantes aujourd’hui">${dots}</span>${best ? `<span class="small muted" title="Record de la semaine">Record : <b class="num">${best}</b></span>` : ""}<span class="g-btn">${btn}</span></div>`}</div></div>`;
  }).join("");
  return head + `<div class="game-list">${cards}</div>`;
}

/* ---------------- Moteur commun ---------------- */
let GAME = null; // partie en cours
function gameOpen(id, help) {
  if (GAME || !playsLeft(id) || GAMES[id].soon || S.level < BALADES_LVL) return;
  const el = document.createElement("div"); el.id = "game"; el.className = "game g-" + id; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", GAMES[id].name);
  document.body.appendChild(el);
  history.pushState({ game: 1 }, "");
  GAME = { id, el, score: 0, state: "count", timers: [] };
  GAME_IMPL[id].setup(GAME);
  const seen = gamesState().seen = gamesState().seen || {};
  if (seen[id] && !help) gameCountdown(); else gameRules(); // la première fois : comment on joue
}
// Petite fenêtre « Comment jouer », avant la première partie (et depuis le bouton « ? » de la carte).
function gameRules() {
  const g = GAME, G = GAMES[g.id];
  g.el.insertAdjacentHTML("beforeend", `<div class="g-end g-rules"><div class="g-card">
    <div class="g-rules-art">${gameArt(g.id)}</div><h2>${G.name}</h2>
    <ol class="g-steps">${G.rules.map(r => `<li>${r}</li>`).join("")}</ol>
    <p class="small muted">${GAME_PLAYS} parties par jour. Une partie compte dès qu’elle commence.</p>
    <div class="g-acts"><button class="btn" data-act="gameGo">C’est parti !</button></div></div></div>`);
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
  gameHelp(id) { gameOpen(id, true); },
  gameGo() { if (!GAME || GAME.state !== "count") return; GAME.el.querySelector(".g-rules")?.remove(); gamesState().seen = { ...gamesState().seen, [GAME.id]: true }; save(); gameCountdown(); },
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

/* ---------------- La pêche ----------------
   40 s. On touche l'étang pour lancer, le bouchon frétille parfois (il ne faut pas toucher), puis plonge :
   il faut toucher dans la seconde. Algues 1 pt, cresson 2, menthe d'eau 3. Le panier garde les 5 plus belles prises. */
const PECHE_T = 40000, PECHE_BASKET = 5, PECHE_WIN = 900;
const PECHE_PTS = { algue: 1, cresson: 2, menthe: 3 };
const BOBBER = `<svg viewBox="0 0 40 52"><path d="M20 2v10" stroke="#3a2c1f" stroke-width="2"/><circle cx="20" cy="24" r="13" fill="#fff"/><path d="M7 24a13 13 0 0 1 26 0z" fill="#e2483d"/><circle cx="16" cy="19" r="3" fill="#fff" opacity=".6"/></svg>`;
const POND = `<svg class="pond-bg" viewBox="0 0 400 300" preserveAspectRatio="none"><ellipse cx="200" cy="150" rx="196" ry="146" fill="#6fb6df"/><ellipse cx="200" cy="150" rx="176" ry="128" fill="#7fc3e8"/>
  <g fill="#5fae4a"><path d="M70 70a26 18 0 1 0 1 0l-8 14z"/><path d="M320 220a30 20 0 1 0 1 0l-9 15z"/><path d="M300 70a20 14 0 1 0 1 0l-6 10z"/></g><circle cx="78" cy="66" r="6" fill="#ff9fc0"/>
  <g stroke="#4f9a3a" stroke-width="5" stroke-linecap="round"><path d="M28 230l-10-70M40 236l4-80M52 240l14-66"/><path d="M372 120l8-60M360 116l-6-70"/></g></svg>`;

const GAME_IMPL = {
  peche: {
    setup(g) {
      g.st = "ready"; g.caught = []; g.until = 0;
      g.el.innerHTML = `<div class="g-top"><button class="g-x" data-act="gameStop" aria-label="Arrêter">${X_SVG}</button><b class="g-name">${GAMES.peche.name}</b><span class="g-score"><span class="g-pts">Points</span><b class="num">0</b></span></div>
        <div class="g-time"><i></i></div>
        <div class="g-basket" aria-label="Ton panier">${Array.from({ length: PECHE_BASKET }, () => `<span class="gb-slot"></span>`).join("")}</div>
        <div class="g-field peche-field">${POND}<svg class="line" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"/></svg><div class="bobber" hidden>${BOBBER}</div><span class="p-msg"></span>
          <svg class="rod" viewBox="0 0 120 160" aria-hidden="true"><path d="M110 158L18 10" stroke="#8a5a3a" stroke-width="7" stroke-linecap="round"/><circle cx="96" cy="134" r="11" fill="#5e3a22"/><circle cx="96" cy="134" r="4" fill="#c9a26b"/></svg></div>
        <p class="g-hint">Touche l’étang pour lancer ta ligne</p>`;
      g.el.querySelector(".peche-field").addEventListener("pointerdown", ev => { if (g.state !== "play") return; ev.preventDefault(); GAME_IMPL.peche.tap(g, ev); });
    },
    msg(g, txt, cls) { const m = g.el.querySelector(".p-msg"); m.textContent = txt; m.className = "p-msg show " + (cls || ""); clearTimeout(g.msgT); g.msgT = setTimeout(() => { m.className = "p-msg"; }, 1100); },
    hint(g, txt) { g.el.querySelector(".g-hint").textContent = txt; },
    line(g) {
      const f = g.el.querySelector(".peche-field"), fr = f.getBoundingClientRect(), b = g.el.querySelector(".bobber"), ln = g.el.querySelector(".line line");
      const rod = g.el.querySelector(".rod").getBoundingClientRect();
      if (b.hidden) { ln.setAttribute("x2", 0); ln.setAttribute("y2", 0); ln.setAttribute("x1", 0); ln.setAttribute("y1", 0); return; }
      const br = b.getBoundingClientRect();
      ln.setAttribute("x1", rod.left + rod.width * .15 - fr.left); ln.setAttribute("y1", rod.top + rod.height * .06 - fr.top);
      ln.setAttribute("x2", br.left + br.width / 2 - fr.left); ln.setAttribute("y2", br.top + br.height * .1 - fr.top);
    },
    cast(g, e, ev) {
      const f = g.el.querySelector(".peche-field"), fr = f.getBoundingClientRect(), b = g.el.querySelector(".bobber");
      // Le bouchon tombe près de l'endroit touché, en restant dans l'étang.
      const x = Math.min(.78, Math.max(.2, (ev.clientX - fr.left) / fr.width)), y = Math.min(.72, Math.max(.22, (ev.clientY - fr.top) / fr.height));
      b.style.left = (x * 100) + "%"; b.style.top = (y * 100) + "%"; b.hidden = false; b.className = "bobber land";
      g.st = "wait"; g.bite = e + rand(1400, 4200); g.nibbles = [];
      const n = Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) g.nibbles.push(e + rand(500, g.bite - e - 300));
      GAME_IMPL.peche.hint(g, "Attends que le bouchon plonge…"); SFX.play("water");
    },
    reset(g) { const b = g.el.querySelector(".bobber"); b.hidden = true; b.className = "bobber"; g.st = "ready"; GAME_IMPL.peche.hint(g, "Touche l’étang pour lancer ta ligne"); },
    tap(g, ev) {
      const e = performance.now() - g.t0 - g.paused;
      if (g.st === "ready") return GAME_IMPL.peche.cast(g, e, ev);
      if (g.st === "wait") { GAME_IMPL.peche.msg(g, "Trop tôt, ça a filé !", "miss"); GAME_IMPL.peche.reset(g); buzz(15); return; }
      if (g.st === "bite") {
        const r = Math.random(), k = r < .5 ? "algue" : r < .82 ? "cresson" : "menthe", v = PECHE_PTS[k];
        g.score += v; g.caught.push(k); g.el.querySelector(".g-score b").textContent = g.score;
        const best = [...g.caught].sort((a, b) => PECHE_PTS[b] - PECHE_PTS[a]).slice(0, PECHE_BASKET);
        g.el.querySelectorAll(".gb-slot").forEach((sl, i) => { sl.innerHTML = best[i] ? wildArt(best[i]) : ""; });
        GAME_IMPL.peche.msg(g, `${WILD[k].name} ! +${v}`, k === "menthe" ? "gold" : "");
        SFX.play(v > 2 ? "coin" : "harvest"); buzz(12); GAME_IMPL.peche.reset(g);
      }
    },
    frame(g, e) {
      g.el.querySelector(".g-time i").style.width = Math.max(0, 100 - e / PECHE_T * 100).toFixed(1) + "%";
      if (e >= PECHE_T) { gameEnd(); return; }
      const b = g.el.querySelector(".bobber");
      if (g.st === "wait") {
        if (g.nibbles.length && e >= g.nibbles[0]) { g.nibbles.shift(); b.className = "bobber"; void b.offsetWidth; b.className = "bobber nibble"; }
        if (e >= g.bite) { g.st = "bite"; g.until = e + PECHE_WIN; b.className = "bobber bite"; GAME_IMPL.peche.hint(g, "Plouf ! Touche vite !"); buzz([30, 30, 30]); }
      } else if (g.st === "bite" && e >= g.until) { GAME_IMPL.peche.msg(g, "Il s’est échappé…", "miss"); GAME_IMPL.peche.reset(g); }
      GAME_IMPL.peche.line(g);
    },
    // Le panier garde les 5 plus belles prises ; un peu d'XP selon les points.
    reward(score) {
      const g = GAME, best = [...(g?.caught || [])].sort((a, b) => PECHE_PTS[b] - PECHE_PTS[a]).slice(0, PECHE_BASKET), wild = {};
      for (const k of best) wild[k] = (wild[k] || 0) + 1;
      return { wild, xp: Math.min(4 + S.level, Math.round(score / 2)) };
    },
    cheer: s => s >= 24 ? "Pêcheur de légende !" : s >= 14 ? "Belle pêche !" : s >= 6 ? "Ça mord !" : "Quelques prises !",
  },
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
