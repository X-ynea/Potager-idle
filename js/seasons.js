"use strict";
/* ---------------- Saisons ----------------
   Une saison par semaine réelle (du lundi au dimanche), la même pour tout le monde :
   printemps → été → automne → hiver, puis on recommence.
   Chaque saison change le décor (teinte du jardin, particules), le visiteur à attraper,
   ce qui bloque les bacs (même fonctionnement, seul l'élément change) et les plantes de saison
   qui poussent plus vite. Pour tester une saison : ajouter ?saison=hiver à l'adresse. */
const SEASON_ORDER = ["printemps", "ete", "automne", "hiver"];
const SEASON_BONUS = 1.25; // une plante de saison pousse 25 % plus vite pendant sa saison
const SEASONS = {
  printemps: {
    name: "Printemps", of: "de printemps", arrive: "Le printemps est là !",
    pest: { key: "snail", one: "Un escargot", name: "escargot", remove: "Retirer les escargots", act: "Escargot délogé",
      quest: n => `Déloger ${n} escargots`, notif: ["Un escargot !", "Il bloque une plante. Viens le déloger."],
      tip: "Oh non, un escargot grignote une de tes plantes ! Touche le bac pour le déloger, sinon elle arrête de pousser." },
    visitor: { key: "butterfly", name: "papillon", plural: "papillons", label: "Attraper le papillon" },
    intro: "Les fleurs s’ouvrent et les papillons reviennent. Attention aux escargots, ils adorent les jeunes pousses !",
  },
  ete: {
    name: "Été", of: "d’été", arrive: "L’été est arrivé !",
    pest: { key: "weeds", one: "Des herbes folles", name: "herbes folles", remove: "Arracher les herbes folles", act: "Herbes arrachées",
      quest: n => `Arracher ${n} touffes d’herbes folles`, notif: ["Des herbes folles !", "Elles étouffent une plante. Viens les arracher."],
      tip: "Avec la chaleur, les herbes folles poussent partout et étouffent tes plantes ! Touche le bac pour les arracher." },
    visitor: { key: "dragonfly", name: "libellule", plural: "libellules", label: "Attraper la libellule" },
    intro: "Le soleil tape fort et les libellules dansent au-dessus du jardin. Les herbes folles, elles, poussent à toute vitesse…",
  },
  automne: {
    name: "Automne", of: "d’automne", arrive: "L’automne est arrivé !",
    pest: { key: "leaves", one: "Des feuilles mortes", name: "feuilles mortes", remove: "Balayer les feuilles", act: "Feuilles balayées",
      quest: n => `Balayer ${n} tas de feuilles mortes`, notif: ["Des feuilles mortes !", "Elles recouvrent une plante. Viens les balayer."],
      tip: "Le vent a soufflé un tas de feuilles mortes sur une de tes plantes ! Touche le bac pour les balayer, sinon elle arrête de pousser." },
    visitor: { key: "ladybug", name: "coccinelle", plural: "coccinelles", label: "Attraper la coccinelle" },
    intro: "Les feuilles tombent en tourbillonnant et les coccinelles cherchent un abri. Pense à balayer tes bacs !",
  },
  hiver: {
    name: "Hiver", of: "d’hiver", arrive: "L’hiver est arrivé !",
    pest: { key: "frost", one: "Du gel", name: "gel", remove: "Dégivrer les bacs", act: "Bac dégivré",
      quest: n => `Dégivrer ${n} bacs`, notif: ["Un bac a gelé !", "La plante est prise dans la glace. Viens la dégivrer."],
      tip: "Brr, un bac a gelé pendant la nuit ! Touche-le pour le dégivrer, sinon la plante reste figée." },
    visitor: { key: "robin", name: "rouge-gorge", plural: "rouges-gorges", label: "Attraper le rouge-gorge" },
    intro: "La neige tombe doucement sur le jardin et les rouges-gorges viennent picorer. Gare au gel sur les bacs !",
  },
};
// Images déjà fournies (les autres sont dessinées en attendant : voir docs/prompts-images.md).
const SEASON_IMG = new Set(["ui-snail", "ui-butterfly", "ui-weeds", "ui-leaves", "ui-ladybug", "ui-dragonfly", "ui-robin"]);

/* Lundi 16 novembre 2026 : début d'une semaine d'automne. */
const SEASON_ANCHOR_DAY = Date.UTC(2026, 10, 16) / 864e5;
const SEASON_FORCE = (() => { try { const s = new URLSearchParams(location.search).get("saison"); return SEASONS[s] ? s : null; } catch (e) { return null; } })();
const dayNum = t => { const d = new Date(t); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
function seasonAt(t) {
  if (SEASON_FORCE) return SEASON_FORCE;
  const w = Math.floor((dayNum(t) - SEASON_ANCHOR_DAY) / 7);
  return SEASON_ORDER[(((w + 2) % 4) + 4) % 4];
}
const season = () => seasonAt(Date.now());
const seasonDaysLeft = () => { const d = dayNum(Date.now()) - SEASON_ANCHOR_DAY; return 7 - (((d % 7) + 7) % 7); };
const nextSeason = s => SEASON_ORDER[(SEASON_ORDER.indexOf(s) + 1) % 4];
const inSeason = k => !!PLANTS[k]?.season && PLANTS[k].season === season();
const PEST = () => SEASONS[season()].pest;
const VISITOR = () => SEASONS[season()].visitor;

/* Icônes de saison : fleur, soleil, feuille, flocon. */
const SEASON_ICON = {
  printemps: `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="#f58fb5">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="12" cy="6.6" rx="3.6" ry="4.6" transform="rotate(${a} 12 12)"/>`).join("")}</g><circle cx="12" cy="12" r="3.2" fill="#ffd23f"/></svg>`,
  ete: `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#f5a623" stroke-width="2.2" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="12" y1="2.2" x2="12" y2="5" transform="rotate(${a} 12 12)"/>`).join("")}</g><circle cx="12" cy="12" r="5.4" fill="#ffc533"/></svg>`,
  automne: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 2.5C11.5 2.4 4.6 7.6 4.6 14.8c0 2 .5 3.6 1.4 4.9L3.4 22.3l1.3 1.2 2.6-2.6c1.3.8 2.9 1.2 4.7 1.2 6.8 0 9.6-7.8 8.5-19.6z" fill="#e8742c"/><path d="M6.6 20.6c3.2-4.8 7.1-8.6 11.6-11.6M10.4 16.2l-.6-3.8M13.6 13.2l3.4.2" stroke="#a8471a" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`,
  hiver: `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#5aa7e6" stroke-width="1.9" stroke-linecap="round" fill="none">${[0, 60, 120].map(a => `<g transform="rotate(${a} 12 12)"><line x1="12" y1="2.5" x2="12" y2="21.5"/><path d="M9.4 4.6L12 6.8l2.6-2.2M9.4 19.4L12 17.2l2.6 2.2"/></g>`).join("")}</g></svg>`,
};
const seasonIcon = (s, cls = "") => `<span class="sz-ico sz-${s} ${cls}" title="Saison : ${SEASONS[s].name.toLowerCase()}">${SEASON_ICON[s]}</span>`;
// Petite icône posée sur la vignette d'une plante de saison (herbier, graines, marché…).
// Seulement pour les plantes de la saison en cours, pour ne pas surcharger les vignettes.
const seasonBadge = k => inSeason(k) ? seasonIcon(PLANTS[k].season, "sz-badge") : "";

/* Ce qui bloque un bac : même mécanique, élément différent selon la saison. */
const PEST_SVG = {
  weeds: `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke-linecap="round" fill="none">
    <path d="M14 58c0-14 3-24 9-32M22 58c0-12-3-20-9-26M30 58c1-16 6-26 14-34M40 58c-1-11 2-19 8-25M48 58c0-9-3-15-8-19" stroke="#5c9a2e" stroke-width="4"/>
    <path d="M18 58c2-10 7-17 13-21M36 58c0-8-4-14-9-17" stroke="#7cbf3c" stroke-width="3.4"/></g>
    <circle cx="44" cy="22" r="5" fill="#ffd84a"/><circle cx="44" cy="22" r="2.2" fill="#f2a516"/></svg>`,
  leaves: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 46c6-12 18-16 28-12-4 10-16 16-28 12z" fill="#c9562a"/><path d="M10 46l26-11" stroke="#8a3415" stroke-width="1.4"/>
    <path d="M26 54c2-13 12-21 24-21-1 11-11 20-24 21z" fill="#e89a2c"/><path d="M26 54l22-20" stroke="#a5611a" stroke-width="1.4"/>
    <path d="M30 40c-3-11 2-21 12-26 3 10-1 21-12 26z" fill="#d9772f"/><path d="M30 40l11-25" stroke="#97461a" stroke-width="1.4"/>
    <path d="M40 56c5-9 14-12 21-9-3 8-12 12-21 9z" fill="#b8452a"/></svg>`,
  frost: `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#e9f6ff" stroke-width="3.4" stroke-linecap="round" fill="none">
    ${[0, 60, 120].map(a => `<g transform="rotate(${a} 32 32)"><line x1="32" y1="8" x2="32" y2="56"/><path d="M25 14l7 6 7-6M25 50l7-6 7 6"/></g>`).join("")}</g>
    <g stroke="#7cc3f2" stroke-width="1.4" stroke-linecap="round" fill="none">${[0, 60, 120].map(a => `<line x1="32" y1="9" x2="32" y2="55" transform="rotate(${a} 32 32)"/>`).join("")}</g></svg>`,
};
function pestArt(key) {
  if (SEASON_IMG.has("ui-" + key)) return `<img class="pest pest-${key}" src="assets/img/ui-${key}.webp" alt="">`;
  return `<span class="pest pest-${key}">${PEST_SVG[key] || ""}</span>`;
}

// Même élément, en simple icône (objectifs du jour, fiche de saison).
const pestIcon = key => SEASON_IMG.has("ui-" + key) ? `<img src="assets/img/ui-${key}.webp" alt="">` : PEST_SVG[key] || "";
/* Visiteurs ailés : papillon, libellule, coccinelle, rouge-gorge. */
const VISITOR_SVG = {
  dragonfly: `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#bfe6ff" fill-opacity=".85" stroke="#6bb6e6" stroke-width="1.2">
    <ellipse cx="20" cy="22" rx="15" ry="6" transform="rotate(-18 20 22)"/><ellipse cx="44" cy="22" rx="15" ry="6" transform="rotate(18 44 22)"/>
    <ellipse cx="21" cy="33" rx="13" ry="5" transform="rotate(14 21 33)"/><ellipse cx="43" cy="33" rx="13" ry="5" transform="rotate(-14 43 33)"/></g>
    <rect x="29.5" y="16" width="5" height="40" rx="2.5" fill="#2f9fb8"/><circle cx="32" cy="15" r="5" fill="#1f7e96"/></svg>`,
  ladybug: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="20" r="7" fill="#2b2b2b"/>
    <path d="M32 18c13 0 20 10 20 21S43 58 32 58 12 50 12 39s7-21 20-21z" fill="#e2392f"/><path d="M32 19v39" stroke="#2b2b2b" stroke-width="2"/>
    <g fill="#2b2b2b"><circle cx="23" cy="32" r="3.6"/><circle cx="41" cy="32" r="3.6"/><circle cx="21" cy="45" r="3.2"/><circle cx="43" cy="45" r="3.2"/><circle cx="32" cy="51" r="2.6"/></g>
    <circle cx="29" cy="18" r="1.5" fill="#fff"/><circle cx="35" cy="18" r="1.5" fill="#fff"/></svg>`,
  robin: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M50 34c4 5 9 6 12 5-3 5-8 7-14 6z" fill="#7a5a3c"/>
    <ellipse cx="32" cy="36" rx="19" ry="16" fill="#9a7550"/><circle cx="22" cy="27" r="12" fill="#9a7550"/>
    <path d="M14 30c0 10 7 18 17 18 3-8 1-16-5-21-5-2-9-1-12 3z" fill="#ec6a36"/>
    <path d="M30 32c6-4 14-3 18 2-5 3-12 4-18-2z" fill="#7a5a3c"/>
    <circle cx="19" cy="24" r="2.4" fill="#1d1d1d"/><circle cx="18.3" cy="23.3" r=".8" fill="#fff"/><path d="M9 26l-5 2 5 1.5z" fill="#3a2a1a"/>
    <path d="M28 51l-2 7M36 51l1 7" stroke="#5a3a24" stroke-width="2" stroke-linecap="round"/></svg>`,
};
function visitorArt(key) {
  if (SEASON_IMG.has("ui-" + key)) return `<img src="assets/img/ui-${key}.webp" alt="">`;
  return VISITOR_SVG[key] || `<img src="assets/img/ui-butterfly.webp" alt="">`;
}

/* Particules de saison : pétales, pollen doré, feuilles mortes, flocons. Boucles CSS infinies. */
function seasonFxHTML(s) {
  const n = { printemps: 10, ete: 12, automne: 11, hiver: 16 }[s];
  const cols = { printemps: ["#ffc2d8", "#ffd9e6", "#fff0f5", "#f9a8c6"], ete: ["#fff3a6", "#ffe066", "#fffbe0"], automne: ["#e8742c", "#c9562a", "#e8a33a", "#b8452a", "#d98b2b"], hiver: ["#ffffff", "#f2f8ff", "#e6f2ff"] }[s];
  let h = "";
  for (let i = 0; i < n; i++) {
    const x = (i + Math.random() * .8) / n * 100, d = (s === "hiver" ? 7 : s === "ete" ? 9 : 10) + Math.random() * 6;
    h += `<span class="sfx" style="--x:${x.toFixed(1)}%;--d:${d.toFixed(1)}s;--dl:${(-Math.random() * d).toFixed(1)}s;--sc:${(.6 + Math.random() * .7).toFixed(2)};--c:${pick(cols)};--sw:${(8 + Math.random() * 22).toFixed(0)}px;--r:${Math.floor(Math.random() * 360)}deg"><i></i></span>`;
  }
  return `<div class="season-fx fx-${s}" data-season="${s}" aria-hidden="true">${h}</div>`;
}
