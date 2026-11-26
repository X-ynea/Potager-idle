"use strict";
/* ---------------- v4 · Onglet « Balades » : les mini-jeux ----------------
   Cinq petits jeux (pêche, forêt, memory, cueillette, ruche), 3 parties par jeu et par jour (jour de Paris).
   Les récompenses restent petites : des ingrédients de balade (WILD, js/data.js), un peu d'XP, parfois des pièces.
   S.games = { day, plays: { ruche: 2 }, best: { ruche: { week, score } } } */
const BALADES_LVL = 4; // ouverture de l'onglet ; chaque jeu a ensuite son niveau (GAMES[id].lvl)
const GAME_PLAYS = 3;
const GAMES = {
  ruche:      { lvl: 4, name: "La ruche", tag: "Rythme", desc: "Touche les fleurs qui s’ouvrent pour que les abeilles viennent butiner.", gives: ["miel"],
    rules: ["Des fleurs s’ouvrent une à une dans le pré, de plus en plus vite.", "Touche une fleur ouverte avant qu’elle se referme : une abeille part de la ruche pour la butiner.", "Une fleur dorée vaut 3 points. Toucher un bouton encore fermé ne fait rien perdre.", "Tu as 30 secondes. Plus tu butines, plus tu rapportes de miel (jusqu’à 4 pots)."], emoji: "🐝", color: "#f2b632" },
  peche:      { lvl: 5, name: "Pêche à l’étang", tag: "Détente", desc: "Lance ta ligne et attends que le bouchon plonge…", gives: ["algue", "cresson", "menthe"], emoji: "🎣", color: "#5aa7ee",
    rules: ["Touche l’étang pour lancer ta ligne.", "Attends que le bouchon plonge pour de bon, avec un grand « plouf », puis touche vite ! S’il ne fait que frétiller, patience…", "La partie dure 5 prises ou 30 secondes.", "Algues 1 point, cresson 2, menthe d’eau 3 (la plus rare), et 1 point par seconde restante quand le panier est plein."] },
  foret:      { lvl: 6, name: "Balade en forêt", tag: "Détente", desc: "Suis le sentier et fouille les buissons.", gives: ["ail", "mure", "chataigne", "noisette"], emoji: "🍂", color: "#8a5a3a",
    rules: ["Tu marches tranquillement sur le sentier, les buissons défilent.", "Touche un buisson qui frémit : quelque chose s’y cache !", "Chaque saison a sa trouvaille : ail des ours au printemps, mûres l’été, châtaignes l’automne, noisettes l’hiver. Elle vaut 1 point, les autres, plus rares, 3 points.", "La partie dure 5 trouvailles ou 30 secondes."] },
  memory:     { lvl: 7, name: "Memory des graines", tag: "Mémoire", desc: "Retrouve les paires de sachets de graines.", coins: true, seeds: true, emoji: "🃏", color: "#9a6cf0",
    rules: ["Touche deux cartes pour les retourner.", "Si ce sont les mêmes graines, la paire reste visible. Sinon, elles se retournent : retiens bien où elles sont !", "La partie dure 8 paires ou 25 secondes. Chaque paire rapporte des pièces, et si tu trouves tout, tu gardes un sachet de graines."] },
  cueillette: { lvl: 8, name: "Cueillette express", tag: "Réflexes", desc: "Attrape les légumes qui tombent, pas les cailloux !", coins: true, emoji: "🧺", color: "#ec7d2e",
    rules: ["Fais glisser ton doigt pour déplacer le panier.", "Attrape les légumes qui tombent. Un légume doré vaut 3 points.", "Évite les cailloux : ils font perdre 2 points.", "La partie dure 30 secondes."] },
};
const GORDER = Object.keys(GAMES);
// Version de test : tous les jeux ouverts, quel que soit le niveau.
const gameLocked = id => !IS_TEST && S.level < GAMES[id].lvl;

// Jour de Paris (AAAA-MM-JJ), comme le serveur.
const parisDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
function gamesState() {
  const g = S.games = S.games || {};
  const d = parisDay();
  if (g.day !== d) { g.day = d; g.plays = {}; }
  g.plays = g.plays || {}; g.best = g.best || {};
  return g;
}
// Version de test : parties illimitées (la limite revient d'elle-même sur la version des joueurs).
const playsLeft = id => IS_TEST ? GAME_PLAYS : Math.max(0, GAME_PLAYS - (gamesState().plays[id] || 0));
const weekBest = id => { const b = gamesState().best[id]; return b && b.week === weekId() ? b.score : 0; };

const SIGNPOST = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="10.8" y="2.5" width="2.4" height="19" rx="1" fill="currentColor"/><path d="M4 5.5h11.5l3 2.6-3 2.6H4z" fill="currentColor"/><path d="M20 12.5H8.5l-3 2.6 3 2.6H20z" fill="currentColor" opacity=".6"/></svg>`;
const gameArt = id => !VEC_ONLY ? `<img src="assets/img/balades/game-${id}.webp" alt="">` : `<span class="game-ph" style="--c:${GAMES[id].color}">${GAMES[id].emoji}</span>`;

function views_balades() {
  if (friendsReady() && Date.now() - BOARD.at > 60e3) setTimeout(() => loadBoard(), 0);
  const head = `<section class="panel"><div class="row spread"><h2>Balades</h2><span class="small muted">${IS_TEST ? "Tout ouvert, parties illimitées (test)" : `${GAME_PLAYS} parties par jeu et par jour`}</span></div></section>`;
  if (!IS_TEST && S.level < BALADES_LVL) return head + `<section class="panel"><div class="empty-note"><span style="font-size:2.4rem">${SIGNPOST}</span><span>Les balades ouvrent au niveau ${BALADES_LVL}.</span></div></section>`;
  const cards = GORDER.map(id => {
    const G = GAMES[id], left = playsLeft(id), best = weekBest(id), locked = gameLocked(id);
    const gives = G.gives ? G.gives.map(k => `<span class="g-give">${wildArt(k)}${WILD[k].name}</span>`).join("")
      : `<span class="g-give">${coin}Pièces</span>` + (G.seeds ? `<span class="g-give">${seedArt("radis")}Graines</span>` : "");
    const dots = Array.from({ length: GAME_PLAYS }, (_, i) => `<i class="${i < left ? "on" : ""}"></i>`).join("");
    const btn = left ? `<button class="btn sm" data-act="gamePlay" data-arg="${id}">Jouer</button>` : `<button class="btn ghost sm" disabled>Reviens demain</button>`;
    return `<div class="game-card${G.soon || locked ? " soon" : ""}"><div class="g-art">${gameArt(id)}</div>
      <div class="g-body"><div class="g-title"><b>${G.name}</b><span class="g-tag">${G.tag}</span>${!G.soon && !locked && left ? `<button class="g-help" data-act="gameHelp" data-arg="${id}" aria-label="Comment jouer">?</button>` : ""}${G.soon ? `<span class="g-tag g-soon">Bientôt</span>` : locked ? `<span class="g-tag g-soon">Niveau ${G.lvl}</span>` : ""}</div>
        <div class="g-gives">${gives}</div>
        ${G.soon || locked ? "" : `<div class="g-foot"><span class="g-dots" title="Parties restantes aujourd’hui">${dots}</span>${boardChip(id, best)}<span class="g-btn">${btn}</span></div>`}</div></div>`;
  }).join("");
  return head + `<div class="game-list">${cards}</div>`;
}

/* ---------------- Moteur commun ---------------- */
let GAME = null; // partie en cours
function gameOpen(id, help) {
  if (GAME || !playsLeft(id) || GAMES[id].soon || gameLocked(id)) return;
  const el = document.createElement("div"); el.id = "game"; el.className = "game g-" + id; if (id === "peche" || id === "ruche") el.style.backgroundImage = `url("assets/img/jardin/bg-${season()}.webp")`;
  if (id === "foret" || id === "cueillette") el.style.backgroundImage = (id === "cueillette" ? "linear-gradient(transparent 80%, #a9d68a 93%), " : "") + `url("assets/img/balades/sky-${season()}.webp")`; // le ciel de la saison el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", GAMES[id].name);
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
  if (rec) setTimeout(() => loadBoard(true), 300); // nouveau record : on l'envoie au tableau des amis
  // Succès des Balades : prises, trouvailles, fleurs butinées, jeux essayés.
  const stt = S.stats; stt.gamesSet = [...new Set([...(stt.gamesSet || []), g.id])];
  if (g.id === "peche") stt.fish = (stt.fish || 0) + g.caught.length;
  if (g.id === "foret") stt.forage = (stt.forage || 0) + g.caught.length;
  if (g.id === "ruche") stt.flowers = (stt.flowers || 0) + (g.bees || 0);
  const r = GAME_IMPL[g.id].reward(g.score);
  for (const k in r.wild || {}) S.wild[k] = cnt(S.wild, k) + r.wild[k];
  if (r.coins) S.coins += r.coins;
  if (r.xp) addXp(r.xp);
  save();
  const items = [...Object.entries(r.wild || {}).map(([k, n]) => `<span class="g-rew">${wildArt(k)}<b>${n} × ${WILD[k].name}</b></span>`),
    r.coins ? `<span class="g-rew">${coin}<b>${fmt(r.coins)} pièces</b></span>` : "", r.extra || "", r.xp ? `<span class="g-rew"><span class="g-xp">XP</span><b>+${r.xp} XP</b></span>` : ""].filter(Boolean);
  const left = playsLeft(g.id);
  g.el.querySelector(".g-end")?.remove();
  g.el.insertAdjacentHTML("beforeend", `<div class="g-end"><div class="g-card">
    <h2>${g.score ? GAME_IMPL[g.id].cheer(g.score) : "Oh, pas cette fois !"}</h2>
    <p class="g-final">Score : <b class="num">${g.score}</b>${rec ? ` <span class="g-rec">Record de la semaine !</span>` : prev ? ` <span class="small muted">(record : ${prev})</span>` : ""}</p>
    ${items.length ? `<div class="g-rews">${items.join("")}</div>` : `<p class="small muted">Rien de rapporté cette fois.</p>`}
    <p class="small muted">${IS_TEST ? "Version de test : parties illimitées." : left ? `Encore ${left} partie${left > 1 ? "s" : ""} aujourd’hui.` : "Plus de partie aujourd’hui pour ce jeu : reviens demain !"}</p>
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

/* ---------------- Tableau des scores entre amis (docs/balades.sql) ----------------
   Le meilleur score de la semaine de chacun, par jeu. Sans récompense : juste une couronne pour le premier. */
const BOARD = { data: null, error: "", loading: false, at: 0 };
async function loadBoard(force) {
  if (!friendsReady() || BOARD.loading || (!force && Date.now() - BOARD.at < 60e3)) return;
  BOARD.loading = true;
  try {
    const g = gamesState(), sent = g.sent = g.sent || {};
    for (const id of GORDER) { const b = weekBest(id), key = `${weekId()}:${b}`; if (b > 0 && sent[id] !== key) { await CLOUD.rpc("report_score", { p_game: id, p_score: b }); sent[id] = key; } }
    const d = await CLOUD.rpc("week_scores");
    BOARD.data = d && typeof d === "object" && !Array.isArray(d) ? d : {}; BOARD.error = ""; BOARD.at = Date.now(); save();
  } catch (e) { BOARD.error = /function|does not exist|404/.test(String(e.message)) ? "Le tableau des scores n’est pas encore prêt sur le serveur (script docs/balades.sql)." : "Scores des amis indisponibles pour le moment."; BOARD.at = Date.now(); }
  BOARD.loading = false; render(true);
}
setInterval(() => { if (!document.hidden && (tab === "balades" || (modalBoard && modalView))) loadBoard(); }, 20e3);
// Lignes du tableau d'un jeu : celles du serveur, avec mon record local s'il est plus récent.
function boardRows(id) {
  const rows = [...((BOARD.data || {})[id] || [])].map(r => ({ ...r })), best = weekBest(id);
  let me = rows.find(r => r.me);
  if (best > 0) { if (me) me.score = Math.max(me.score, best); else rows.push(me = { name: "Toi", score: best, me: true }); }
  return rows.sort((a, b) => b.score - a.score);
}
const BOARD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M10 13h4l-.5 4h-3z" fill="currentColor"/><rect x="7.5" y="17" width="9" height="3" rx="1" fill="currentColor"/></svg>`;
function boardChip(id, best) {
  const rows = friendsReady() ? boardRows(id) : [], rank = rows.findIndex(r => r.me) + 1, crown = rank === 1 && rows.length > 1;
  if (!best && rows.length < 1) return "";
  const txt = best ? `${crown ? "👑 " : ""}<b class="num">${best}</b>${rows.length > 1 && rank ? ` <span class="g-rank">· ${rank}${rank === 1 ? "ᵉʳ" : "ᵉ"}</span>` : ""}` : `<span class="g-rank">Scores des amis</span>`;
  return `<button class="g-board" data-act="gameBoard" data-arg="${id}" aria-label="Scores de la semaine">${BOARD_ICON}${txt}</button>`;
}
let modalBoard = null;
function viewBoard(id) {
  const G = GAMES[id], rows = friendsReady() ? boardRows(id) : (weekBest(id) ? [{ name: "Toi", score: weekBest(id), me: true }] : []), left = seasonDaysLeft();
  const note = !friendsReady() ? "Connecte-toi et ajoute des amis pour comparer vos scores."
    : BOARD.error || (rows.filter(r => !r.me).length ? "" : "Aucun ami n’a encore joué cette semaine. Invite-les à te battre, sans pression !");
  return `<div class="sheet board-sheet" role="dialog" aria-modal="true" aria-label="Scores de la semaine">
    <div class="sheet-head"><div><h2>${G.name}</h2><span class="small muted">Meilleurs scores de la semaine · encore ${left} jour${left > 1 ? "s" : ""}</span></div>${SHEET_X}</div>
    ${rows.length ? `<div class="goal-members">${rows.map((r, i) => `<div class="goal-m board-row${r.me ? " me" : ""}"><span class="b-rank">${i === 0 && rows.length > 1 ? "👑" : i + 1}</span><span class="fr-av">${r.me ? `<img src="${esc(CLOUD.user?.avatar || "assets/img/interface/xp-leaf.webp")}" alt="">` : friendAvatar(r.avatar)}</span><b>${r.me ? "Toi" : esc(r.name)}</b><span class="num">${r.score}</span></div>`).join("")}</div>`
      : `<p class="small muted" style="margin:0">Personne n’a encore joué cette semaine.</p>`}
    ${note ? `<p class="small muted" style="margin:0">${esc(note)}</p>` : ""}
    <p class="small muted" style="margin:0">Le tableau repart à zéro chaque lundi.<br>Pas de récompense, juste le plaisir !</p></div>`;
}

const BALADES_ACTS = {
  gameBoard(id) { modalBoard = id; modalView = () => viewBoard(id); $("#modal").innerHTML = modalView(); openModal(); loadBoard(true); },
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
// Images de la ruche : un bouton de fleur par emplacement, qui s'ouvre en fleur de sa couleur ; un bouton doré donne une fleur dorée.
const RIMG = n => `<img src="assets/img/balades/ruche-${n}.webp" alt="" draggable="false">`;
const FLOWER = c => RIMG("fl-" + c).replace("<img ", '<img class="fl-open" ');
const BUDIMG = c => RIMG("bud-" + c).replace("<img ", '<img class="fl-bud" ');
const BEE = RIMG("bee");
const rucheColor = () => pick(["rose", "bleue", "blanche"]); // couleur d'un emplacement, gardée toute la partie
const RUCHE_SPOTS = [[50, 50], [24, 36], [76, 36], [24, 66], [76, 66], [50, 22], [50, 80]]; // une fleur au centre, six autour
const RUCHE_T = 30000;

/* ---------------- La pêche ----------------
   30 s ou 5 prises. On touche l'étang pour lancer, le bouchon frétille parfois (il ne faut pas toucher), puis plonge :
   il faut toucher dans la seconde. On garde toutes ses prises (5 au plus).
   Score : algues 1, cresson 2, menthe d'eau 3, + 1 par seconde restante quand le panier est plein. */
const PECHE_T = 30000, PECHE_BASKET = 5, PECHE_WIN = 900;
const PECHE_PTS = { algue: 1, cresson: 2, menthe: 3 };
const BOBBER = `<img src="assets/img/balades/peche-bobber.webp" alt="" draggable="false">`;

/* ---------------- La balade en forêt ----------------
   30 s ou 5 trouvailles. Les buissons défilent ; ceux qui frémissent cachent une trouvaille,
   révélée seulement quand on les touche. Score : trouvaille de la saison 1, les autres 3, + 1 par seconde restante quand le panier est plein. */
const FORET_T = 30000, FORET_BASKET = 5, FORET_CROSS = 3800, FORET_SPAN = 1.35; // un buisson parcourt 1,35 largeur d'écran en 3,8 s
// Une trouvaille par saison (fréquente, 1 point) ; les trois autres sont plus rares (3 points).
const FORET_SEASON = { printemps: "ail", ete: "mure", automne: "chataigne", hiver: "noisette" };
const FORET_ITEMS = ["ail", "mure", "chataigne", "noisette"];
const foretMain = () => FORET_SEASON[season()] || "ail";
const foretPts = k => k === foretMain() ? 1 : 3;
// Les buissons, la lisière et le chemin changent avec la saison (4 variantes de buisson).
const BUSH = () => `<img class="bush-svg" src="assets/img/balades/bush-${season()}-${1 + Math.floor(Math.random() * 4)}.webp" alt="" draggable="false">`;
const TREES = () => `<img class="forest-bg" src="assets/img/balades/foret-${season()}.webp" alt="" draggable="false">`;
function foretPick() { const m = foretMain(); return Math.random() < .55 ? m : pick(FORET_ITEMS.filter(k => k !== m)); }

/* ---------------- Memory des graines ----------------
   16 cartes (8 paires de sachets de graines), 25 s. Score : 3 par paire + 1 par seconde restante si tout est trouvé.
   Pièces : (4 + niveau) par paire ; tout trouvé = 1 sachet de graines d'une des plantes débloquées. */
const MEMO_T = 25000, MEMO_PAIRS = 8;
const CARD_BACK = `<svg viewBox="0 0 60 80"><rect width="60" height="80" rx="8" fill="#9a6cf0"/><rect x="4" y="4" width="52" height="72" rx="6" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/><path d="M30 58V36m0 0c-7 0-10-5-10-11 7 0 10 5 10 11zm0 0c0-7 3-11 10-11 0 6-3 11-10 11z" fill="#fff" opacity=".85"/></svg>`;
function memoPool() {
  const base = ORDER.filter(k => !PLANTS[k].hybrid).sort((a, b) => PLANTS[a].lvl - PLANTS[b].lvl);
  const open = base.filter(k => PLANTS[k].lvl <= S.level);
  const pool = open.length >= MEMO_PAIRS ? open : base.slice(0, MEMO_PAIRS);
  return [...pool].sort(() => Math.random() - .5).slice(0, MEMO_PAIRS);
}

/* ---------------- Cueillette express ----------------
   30 s. Des légumes (débloqués) tombent de plus en plus vite ; on déplace le panier du doigt.
   Légume 1 point, légume doré 3, caillou -2. Pièces : 1 + niveau / 5 par point, au plus 8 × (4 + niveau). */
const CUEI_T = 30000;
const STONE = () => `<img src="assets/img/balades/cuei-stone${1 + Math.floor(Math.random() * 3)}.webp" alt="" draggable="false">`; // trois cailloux différents
const BASKET = `<img src="assets/img/balades/cuei-basket.webp" alt="" draggable="false">`;

const GAME_IMPL = {
  cueillette: {
    setup(g) {
      const pool = ORDER.filter(k => !PLANTS[k].hybrid && (PLANTS[k].lvl <= S.level || IS_TEST));
      g.pool = pool.length ? pool : ["radis", "laitue"]; g.items = []; g.next = 300; g.last = 0; g.bx = .5;
      g.el.innerHTML = `<div class="g-top"><button class="g-x" data-act="gameStop" aria-label="Arrêter">${X_SVG}</button><b class="g-name">${GAMES.cueillette.name}</b><span class="g-score"><span class="g-pts">Points</span><b class="num">0</b></span></div>
        <div class="g-time"><i></i></div>
        <div class="g-field cuei-field"><span class="p-msg"></span><div class="cuei-basket">${BASKET}</div></div>
        <p class="g-hint">Fais glisser ton doigt pour déplacer le panier</p>`;
      const f = g.el.querySelector(".cuei-field");
      const move = ev => { if (g.state !== "play" && g.state !== "count") return; const r = f.getBoundingClientRect(); g.bx = Math.min(.92, Math.max(.08, (ev.clientX - r.left) / r.width)); ev.preventDefault(); };
      f.addEventListener("pointerdown", move); f.addEventListener("pointermove", move);
    },
    frame(g, e) {
      g.el.querySelector(".g-time i").style.width = Math.max(0, 100 - e / CUEI_T * 100).toFixed(1) + "%";
      if (e >= CUEI_T) { gameEnd(); return; }
      const f = g.el.querySelector(".cuei-field"), W = f.clientWidth, H = f.clientHeight, dt = Math.min(60, e - g.last) / 1000; g.last = e;
      const bk = g.el.querySelector(".cuei-basket"), bw = bk.offsetWidth;
      bk.style.transform = `translateX(${(g.bx * W - bw / 2).toFixed(1)}px)`;
      const d = Math.min(1, e / CUEI_T);
      if (e >= g.next) {
        const r = Math.random(), kind = r < .2 ? "stone" : r < .28 ? "gold" : "veg", k = pick(g.pool);
        const el = document.createElement("span"); el.className = "fall " + kind;
        el.innerHTML = kind === "stone" ? STONE() : kind === "gold" ? goldArt(k) : cropArt(k);
        f.appendChild(el);
        g.items.push({ el, kind, x: .08 + Math.random() * .84, y: -50, vy: 170 + 170 * d + Math.random() * 40 });
        g.next = e + 720 - 330 * d + Math.random() * 120;
      }
      const top = bk.offsetTop + bk.offsetHeight * .5; // ouverture du panier (sous l'anse)
      g.items = g.items.filter(it => {
        it.y += it.vy * dt;
        if (it.y >= top && it.y <= top + 30 && Math.abs(it.x * W - g.bx * W) < bw * .45) {
          const v = it.kind === "stone" ? -2 : it.kind === "gold" ? 3 : 1;
          g.score = Math.max(0, g.score + v); g.el.querySelector(".g-score b").textContent = g.score;
          bk.classList.remove("bump", "ouch"); void bk.offsetWidth; bk.classList.add(v < 0 ? "ouch" : "bump");
          const pop = document.createElement("span"); pop.className = "g-pop" + (v > 1 ? " gold" : v < 0 ? " bad" : ""); pop.textContent = (v > 0 ? "+" : "") + v;
          pop.style.left = (it.x * W) + "px"; pop.style.top = (top - 10) + "px"; f.appendChild(pop); g.timers.push(setTimeout(() => pop.remove(), 800));
          SFX.play(v < 0 ? "snail" : v > 1 ? "coin" : "harvest"); buzz(v < 0 ? [20, 30, 20] : 8);
          it.el.remove(); return false;
        }
        if (it.y > H + 40) { it.el.remove(); return false; }
        it.el.style.transform = `translate(${(it.x * W).toFixed(1)}px, ${it.y.toFixed(1)}px)`; return true;
      });
    },
    reward(score) {
      return { coins: Math.min(8 * (4 + S.level), Math.round(score * (1 + S.level / 5))), xp: Math.min(4 + S.level, Math.round(score / 2)) };
    },
    cheer: s => s >= 40 ? "Des réflexes d’écureuil !" : s >= 25 ? "Quelle récolte !" : s >= 10 ? "Bien attrapé !" : "Quelques légumes !",
  },
  memory: {
    setup(g) {
      g.kinds = memoPool(); g.found = 0; g.open = []; g.lock = false;
      const deck = [...g.kinds, ...g.kinds].sort(() => Math.random() - .5);
      g.deck = deck;
      g.el.innerHTML = `<div class="g-top"><button class="g-x" data-act="gameStop" aria-label="Arrêter">${X_SVG}</button><b class="g-name">${GAMES.memory.name}</b><span class="g-score"><span class="g-pts">Paires</span><b class="num">0 / ${MEMO_PAIRS}</b></span></div>
        <div class="g-time"><i></i></div>
        <div class="g-field memo-field"><div class="memo-grid">${deck.map((k, i) => `<button class="memo-card" data-i="${i}" aria-label="Carte"><span class="mc-in"><span class="mc-back">${CARD_BACK}</span><span class="mc-front">${seedArt(k)}<small>${PLANTS[k].name}</small></span></span></button>`).join("")}</div></div>
        <p class="g-hint">Retrouve les paires de graines !</p>`;
      g.el.querySelector(".memo-grid").addEventListener("pointerdown", ev => {
        const c = ev.target.closest(".memo-card"); if (!c || g.state !== "play") return; ev.preventDefault(); GAME_IMPL.memory.tap(g, c);
      });
    },
    tap(g, c) {
      if (g.lock || c.classList.contains("up")) return;
      c.classList.add("up"); g.open.push(c); SFX.play("click");
      if (g.open.length < 2) return;
      const [a, b] = g.open; g.open = [];
      if (g.deck[a.dataset.i] === g.deck[b.dataset.i]) {
        g.found++; g.score += 3; a.classList.add("match"); b.classList.add("match");
        g.el.querySelector(".g-score b").textContent = `${g.found} / ${MEMO_PAIRS}`;
        SFX.play("harvest"); buzz(10);
        if (g.found >= MEMO_PAIRS) {
          const e = performance.now() - g.t0 - g.paused, left = Math.max(0, Math.floor((MEMO_T - e) / 1000));
          g.score += left; g.done = true; GAME_IMPL.peche.hint(g, `Tout trouvé ! +${left} pour le temps restant`);
          g.timers.push(setTimeout(gameEnd, 900));
        }
      } else {
        g.lock = true;
        g.timers.push(setTimeout(() => { a.classList.remove("up"); b.classList.remove("up"); g.lock = false; }, 750));
      }
    },
    frame(g, e) {
      g.el.querySelector(".g-time i").style.width = Math.max(0, 100 - e / MEMO_T * 100).toFixed(1) + "%";
      if (e >= MEMO_T && !g.done) gameEnd();
    },
    reward(score) {
      const g = GAME, pairs = g?.found || 0, out = { coins: pairs * (4 + S.level), xp: Math.min(4 + S.level, Math.round(score / 2)) };
      if (pairs >= MEMO_PAIRS) { // tout trouvé : un sachet de graines d'une plante débloquée de la grille
        const ok = g.kinds.filter(k => PLANTS[k].lvl <= S.level), k = ok.length ? pick(ok) : null;
        if (k) { S.seeds[k] = cnt(S.seeds, k) + 1; out.extra = `<span class="g-rew">${seedArt(k)}<b>1 sachet de ${PLANTS[k].name.toLowerCase()}</b></span>`; }
      }
      return out;
    },
    cheer: s => s >= 34 ? "Mémoire d’éléphant !" : s >= 24 ? "Tout retrouvé !" : s >= 12 ? "Bien joué !" : "Quelques paires !",
  },
  foret: {
    setup(g) {
      g.st = "walk"; g.caught = []; g.bushes = []; g.next = 200; g.uid = 0;
      g.el.innerHTML = `<div class="g-top"><button class="g-x" data-act="gameStop" aria-label="Arrêter">${X_SVG}</button><b class="g-name">${GAMES.foret.name}</b><span class="g-score"><span class="g-pts">Points</span><b class="num">0</b></span></div>
        <div class="g-time"><i></i></div>
        <div class="g-basket" aria-label="Ton panier">${Array.from({ length: FORET_BASKET }, () => `<span class="gb-slot"></span>`).join("")}</div>
        <div class="g-field foret-field"><div class="path" style="background-image:url('assets/img/balades/chemin-${season()}.webp')"></div>${TREES()}<span class="p-msg"></span></div>
        <p class="g-hint">Touche les buissons qui frémissent !</p>`;
      g.el.querySelector(".foret-field").addEventListener("pointerdown", ev => {
        const b = ev.target.closest(".bush"); if (!b || g.state !== "play") return; ev.preventDefault(); GAME_IMPL.foret.tap(g, b);
      });
    },
    tap(g, el) {
      const b = g.bushes.find(x => x.el === el); if (!b || g.st !== "walk") return;
      if (!b.item) { el.classList.remove("rustle"); void el.offsetWidth; el.classList.add("rustle"); return; }
      const k = b.item, v = foretPts(k); b.item = null; el.classList.remove("has"); el.classList.add("rustle");
      el.insertAdjacentHTML("afterbegin", `<span class="bush-item">${wildArt(k)}</span>`); // la surprise sort du buisson
      g.score += v; g.caught.push(k); g.el.querySelector(".g-score b").textContent = g.score;
      g.el.querySelectorAll(".gb-slot")[g.caught.length - 1].innerHTML = wildArt(k);
      GAME_IMPL.peche.msg(g, `${WILD[k].name} ! +${v}`, v > 1 ? "gold" : "");
      SFX.play(v > 2 ? "coin" : "harvest"); buzz(10);
      if (g.caught.length >= FORET_BASKET) {
        const e = performance.now() - g.t0 - g.paused, left = Math.max(0, Math.floor((FORET_T - e) / 1000));
        g.score += left; g.st = "done"; g.el.querySelector(".g-score b").textContent = g.score;
        GAME_IMPL.peche.hint(g, `Panier plein ! +${left} pour le temps restant`);
        g.timers.push(setTimeout(gameEnd, 900));
      }
    },
    frame(g, e) {
      g.el.querySelector(".g-time i").style.width = Math.max(0, 100 - e / FORET_T * 100).toFixed(1) + "%";
      if (e >= FORET_T) { gameEnd(); return; }
      if (g.st !== "walk") return;
      const field = g.el.querySelector(".foret-field"), W = field.clientWidth;
      g.el.querySelector(".path").style.backgroundPositionX = (-(e / FORET_CROSS) * W * FORET_SPAN).toFixed(1) + "px"; // même vitesse que les buissons
      if (e >= g.next) {
        // Un buisson sur trois environ cache quelque chose ; trois rangées.
        const lane = Math.floor(Math.random() * 3), item = Math.random() < .3 ? foretPick() : null;
        const el = document.createElement("button"); el.className = "bush lane" + lane + (item ? " has" : ""); el.setAttribute("aria-label", "Buisson");
        el.style.setProperty("--d", (Math.random() * -1.4).toFixed(2) + "s"); el.innerHTML = BUSH();
        field.appendChild(el); g.bushes.push({ el, t: e, item });
        g.next = e + rand(650, 1100);
      }
      g.bushes = g.bushes.filter(b => {
        const x = W * 1.1 - (e - b.t) / FORET_CROSS * W * FORET_SPAN;
        if (x < -W * .3) { b.el.remove(); return false; }
        b.el.style.transform = `translateX(${x.toFixed(1)}px)`; return true;
      });
    },
    reward(score) {
      const wild = {}; for (const k of GAME?.caught || []) wild[k] = (wild[k] || 0) + 1;
      return { wild, xp: Math.min(4 + S.level, Math.round(score / 2)) };
    },
    cheer: s => s >= 25 ? "Reine des sous-bois !" : s >= 15 ? "Jolie cueillette !" : s >= 6 ? "Bonne balade !" : "Quelques trouvailles !",
  },
  peche: {
    setup(g) {
      g.st = "ready"; g.caught = []; g.until = 0;
      g.el.innerHTML = `<div class="g-top"><button class="g-x" data-act="gameStop" aria-label="Arrêter">${X_SVG}</button><b class="g-name">${GAMES.peche.name}</b><span class="g-score"><span class="g-pts">Points</span><b class="num">0</b></span></div>
        <div class="g-time"><i></i></div>
        <div class="g-basket" aria-label="Ton panier">${Array.from({ length: PECHE_BASKET }, () => `<span class="gb-slot"></span>`).join("")}</div>
        <div class="g-field peche-field"><img class="pond-bg" src="assets/img/balades/pond-${season()}.webp" alt="" draggable="false"><svg class="line" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"/></svg><div class="bobber" hidden>${BOBBER}</div><span class="p-msg"></span>
          <div class="rod"><img src="assets/img/balades/peche-rod.webp" alt="" draggable="false"><span class="rod-tip"></span></div></div>
        <p class="g-hint">Touche l’étang pour lancer ta ligne</p>`;
      g.el.querySelector(".peche-field").addEventListener("pointerdown", ev => { if (g.state !== "play") return; ev.preventDefault(); GAME_IMPL.peche.tap(g, ev); });
    },
    msg(g, txt, cls) { const m = g.el.querySelector(".p-msg"); m.textContent = txt; m.className = "p-msg show " + (cls || ""); clearTimeout(g.msgT); g.msgT = setTimeout(() => { m.className = "p-msg"; }, 1100); },
    hint(g, txt) { g.el.querySelector(".g-hint").textContent = txt; },
    line(g) {
      const f = g.el.querySelector(".peche-field"), fr = f.getBoundingClientRect(), b = g.el.querySelector(".bobber"), ln = g.el.querySelector(".line line");
      const rod = g.el.querySelector(".rod-tip").getBoundingClientRect(); // bout de la canne (la canne est inclinée)
      if (b.hidden) { ln.setAttribute("x2", 0); ln.setAttribute("y2", 0); ln.setAttribute("x1", 0); ln.setAttribute("y1", 0); return; }
      const br = b.getBoundingClientRect();
      ln.setAttribute("x1", rod.left - fr.left); ln.setAttribute("y1", rod.top - fr.top);
      ln.setAttribute("x2", br.left + br.width / 2 - fr.left); ln.setAttribute("y2", br.top + br.height * .1 - fr.top);
    },
    cast(g, e, ev) {
      const f = g.el.querySelector(".peche-field"), fr = f.getBoundingClientRect(), b = g.el.querySelector(".bobber");
      // Le bouchon tombe près de l'endroit touché, en restant dans l'étang.
      const x = Math.min(.78, Math.max(.2, (ev.clientX - fr.left) / fr.width)), y = Math.min(.72, Math.max(.22, (ev.clientY - fr.top) / fr.height));
      b.style.left = (x * 100) + "%"; b.style.top = (y * 100) + "%"; b.hidden = false; b.className = "bobber land";
      g.st = "wait"; g.bite = e + rand(1200, 3500); g.nibbles = [];
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
        g.el.querySelectorAll(".gb-slot")[g.caught.length - 1].innerHTML = wildArt(k);
        GAME_IMPL.peche.msg(g, `${WILD[k].name} ! +${v}`, k === "menthe" ? "gold" : "");
        SFX.play(v > 2 ? "coin" : "harvest"); buzz(12); GAME_IMPL.peche.reset(g);
        if (g.caught.length >= PECHE_BASKET) { // panier plein : bonus du temps restant
          const left = Math.floor((PECHE_T - e) / 1000); g.score += left; g.st = "done";
          g.el.querySelector(".g-score b").textContent = g.score;
          GAME_IMPL.peche.hint(g, `Panier plein ! +${left} pour le temps restant`);
          g.timers.push(setTimeout(gameEnd, 900));
        }
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
    // On garde toutes ses prises (5 au plus) ; un peu d'XP selon le score.
    reward(score) {
      const wild = {};
      for (const k of GAME?.caught || []) wild[k] = (wild[k] || 0) + 1;
      return { wild, xp: Math.min(4 + S.level, Math.round(score / 2)) };
    },
    cheer: s => s >= 25 ? "Pêcheur de légende !" : s >= 15 ? "Belle pêche !" : s >= 6 ? "Ça mord !" : "Quelques prises !",
  },
  ruche: {
    setup(g) {
      g.flowers = RUCHE_SPOTS.map(() => ({ open: false, until: 0, gold: false, color: rucheColor() }));
      g.next = 400; g.combo = 0;
      g.el.innerHTML = `<div class="g-top"><button class="g-x" data-act="gameStop" aria-label="Arrêter">${X_SVG}</button><b class="g-name">${GAMES.ruche.name}</b><span class="g-score">${wildArt("miel")}<b class="num">0</b></span></div>
        <div class="g-time"><i></i></div>
        <div class="g-field ruche-field"><div class="hive" aria-hidden="true">${RIMG("hive")}</div>
        ${RUCHE_SPOTS.map(([x, y], i) => `<button class="flower" data-i="${i}" style="left:${x}%;top:${y}%" aria-label="Fleur"><span class="bud-wrap">${BUDIMG(g.flowers[i].color)}</span><span class="fl-wrap"></span></button>`).join("")}</div>
        <p class="g-hint">Touche les fleurs dès qu’elles s’ouvrent !</p>`;
      g.el.querySelector(".ruche-field").addEventListener("pointerdown", ev => {
        const b = ev.target.closest(".flower"); if (!b || g.state !== "play") return;
        ev.preventDefault(); GAME_IMPL.ruche.tap(g, +b.dataset.i, b);
      });
    },
    open(g, i, e) {
      const f = g.flowers[i], b = g.el.querySelector(`.flower[data-i="${i}"]`);
      f.open = true; f.gold = Math.random() < .12; f.until = e + 1700 - 750 * Math.min(1, e / RUCHE_T);
      b.querySelector(".fl-wrap").innerHTML = FLOWER(f.gold ? "or" : f.color); // la fleur dorée peut s'ouvrir n'importe où
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
      const v = f.gold ? 3 : 1; g.score += v; g.combo++; g.bees = (g.bees || 0) + 1;
      GAME_IMPL.ruche.close(g, i, false);
      g.el.querySelector(".g-score b").textContent = g.score;
      // Une seule abeille, qui vole de fleur en fleur (elle part de la ruche au début de la partie).
      const field = g.el.querySelector(".ruche-field"), fr = field.getBoundingClientRect(), br = b.getBoundingClientRect();
      let bee = g.bee;
      if (!bee) { const hr = field.querySelector(".hive").getBoundingClientRect(); bee = g.bee = document.createElement("span"); bee.className = "bee"; bee.innerHTML = BEE;
        bee.style.left = (hr.left + hr.width / 2 - fr.left) + "px"; bee.style.top = (hr.top + hr.height / 2 - fr.top) + "px"; field.appendChild(bee); void bee.offsetWidth; }
      const x = br.left + br.width / 2 - fr.left, y = br.top + br.height * .35 - fr.top;
      bee.classList.toggle("flip", x < parseFloat(bee.style.left)); // elle regarde où elle va
      bee.style.left = x + "px"; bee.style.top = y + "px";
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
