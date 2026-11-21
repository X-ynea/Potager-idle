"use strict";
/* Dessins SVG de Potager idle.
   Style « volume doux » : dégradés pour le relief, lumière venant du haut à gauche,
   ombre de contact au pied des plantes. Pas de visage sur les légumes. */

const SVGNS = "http://www.w3.org/2000/svg";
const GRADS = new Map();
let DEFS_EL = null;

function hexToRgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(h, target, t) { const a = hexToRgb(h), b = hexToRgb(target); return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join(""); }
const lighten = (h, t) => mix(h, "#ffffff", t);
const darken = (h, t) => mix(h, "#1c1408", t);

function addGrad(id, html) {
  if (GRADS.has(id)) return;
  GRADS.set(id, html);
  if (DEFS_EL) DEFS_EL.insertAdjacentHTML("beforeend", html);
}
/* Volume : dégradé radial, clair en haut à gauche, sombre en bas à droite. */
function vol(c) {
  const id = "v" + c.slice(1);
  addGrad(id, `<radialGradient id="${id}" cx=".34" cy=".28" r=".8"><stop offset="0" stop-color="${lighten(c, .55)}"/><stop offset=".42" stop-color="${c}"/><stop offset="1" stop-color="${darken(c, .45)}"/></radialGradient>`);
  return `url(#${id})`;
}
/* Feuilles et pétales : base plus sombre, pointe éclairée. */
function lin(c) {
  const id = "l" + c.slice(1);
  addGrad(id, `<linearGradient id="${id}" x1=".3" y1="1" x2=".7" y2="0"><stop offset="0" stop-color="${darken(c, .38)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${lighten(c, .4)}"/></linearGradient>`);
  return `url(#${id})`;
}
addGrad("shadow", `<radialGradient id="shadow"><stop offset="0" stop-color="#4a3210" stop-opacity=".38"/><stop offset=".6" stop-color="#4a3210" stop-opacity=".14"/><stop offset="1" stop-color="#4a3210" stop-opacity="0"/></radialGradient>`);
addGrad("shine", `<radialGradient id="shine"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
addGrad("mound", `<radialGradient id="mound" cx=".42" cy=".2" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#5a3a14" stop-opacity=".18"/></radialGradient>`);

const LEAF = { a: "#52b343", b: "#3f9a3d", c: "#93c487", d: "#74cf4f" };
const STEM = "#4a963a";

const shadow = (cx, cy, rx, ry = rx * .3) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#shadow)"/>`;
const shine = (cx, cy, rx, ry, rot = -30) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#shine)" transform="rotate(${rot} ${cx} ${cy})"/>`;
/* Petit tas de terre : prend la couleur de la parcelle (sèche ou humide). */
const mound = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" style="fill:var(--soil-fill,#ecd6a6)"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#mound)"/>`;
const stem = (d, c = STEM, w = 2.2) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

function leaf(x, y, rot, L, W, c) {
  const p = `M0 0 C${W} ${-L * .18} ${W * .95} ${-L * .68} 0 ${-L} C${-W * .95} ${-L * .68} ${-W} ${-L * .18} 0 0Z`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="${p}" fill="${lin(c)}"/>` +
    `<path d="M0 -1 Q${W * .14} ${-L * .5} 0 ${-L * .86}" stroke="${lighten(c, .5)}" stroke-width="${Math.max(.5, W * .11).toFixed(2)}" fill="none" opacity=".6" stroke-linecap="round"/></g>`;
}
function speckles(cx, cy, r, col) {
  if (!col) return "";
  return [[.35, -.3, .13], [-.25, .25, .1], [.45, .3, .09], [-.1, -.45, .08], [.1, .55, .07]]
    .map(([dx, dy, s]) => `<circle cx="${cx + dx * r}" cy="${cy + dy * r}" r="${s * r}" fill="${col}" opacity=".75"/>`).join("");
}

/* ---- Formes à maturité ---- */
const SHAPES = {
  bulb(d) { // radis : moitié enterrée, fanes dressées
    const c = d.color;
    let g = shadow(32, 53, 16);
    g += leaf(32, 35, -50, 17, 5.5, LEAF.b) + leaf(32, 35, 50, 17, 5.5, LEAF.b) + leaf(32, 34, -18, 22, 6.2, LEAF.a) + leaf(32, 34, 18, 22, 6.2, LEAF.d);
    g += `<path d="M32 31.5 C41 31.5 44.5 37 43.5 43 C42.5 48 37 51 33 57 L31 57 C27 51 21.5 48 20.5 43 C19.5 37 23 31.5 32 31.5Z" fill="${vol(c)}"/>`;
    g += speckles(32, 41, 9, d.spot) + shine(27, 36.5, 4, 2.4);
    g += mound(32, 53.5, 17, 5);
    return g;
  },
  root(d) { // carotte : collet orange qui dépasse, fanes plumeuses
    const c = d.color;
    let g = shadow(32, 53, 16);
    for (const [r, L] of [[-40, 21], [-13, 26], [13, 25], [40, 20]]) g += frond(32, 46, r, L);
    g += `<ellipse cx="32" cy="47" rx="7.5" ry="5.2" fill="${vol(c)}"/>`;
    g += `<path d="M26.5 47.5 q5.5 2 11 0" stroke="${darken(c, .3)}" stroke-width=".8" fill="none" opacity=".5"/>`;
    g += speckles(32, 46, 6, d.spot) + shine(29.4, 45, 2.4, 1.3, -10);
    g += mound(32, 52, 16, 4.6);
    return g;
  },
  leafy(d) { // laitue / chou : grandes feuilles extérieures + pomme serrée
    const c = d.color;
    let g = shadow(32, 53, 21);
    const o = d.outer;
    for (const [r, L, W, col] of [[-84, 19, 10, o || LEAF.c], [84, 19, 10, o || LEAF.c], [-54, 21, 11, o || LEAF.a], [54, 21, 11, o || LEAF.c], [-24, 18, 10, LEAF.a], [24, 18, 10, LEAF.d]]) g += leaf(32, 51, r, L, W, col);
    g += `<circle cx="32" cy="40" r="12" fill="${vol(c)}"/>`;
    g += `<path d="M20.5 42 C21.5 32 29 28 36 29 C30 32.5 27 38.5 28 51 C24 49.5 21 46 20.5 42Z" fill="${vol(darken(c, .1))}" opacity=".92"/>`;
    g += `<path d="M43.5 42 C42.5 33 37.5 29 33 29.5 C37.5 33.5 38.5 40.5 36 51 C40 49.5 43 46 43.5 42Z" fill="${vol(lighten(c, .06))}" opacity=".88"/>`;
    g += speckles(32, 40, 9, d.spot) + shine(28, 34, 4.2, 2.6);
    return g;
  },
  herb(d) { // basilic : buisson de feuilles ovales et brillantes
    const c = d.color;
    let g = shadow(32, 53, 17);
    g += stem("M32 52 Q32 40 32 21", STEM, 2.2) + stem("M32 46 Q26 41 22 37", STEM, 1.4) + stem("M32 44 Q38 39 42 35", STEM, 1.4);
    for (const [x, y, r, l, w] of [[32, 50, -78, 12, 6.5], [32, 50, 78, 12, 6.5], [22, 37, -40, 11, 6.2], [42, 35, 40, 11, 6.2], [32, 41, -50, 12, 6.6], [32, 40, 50, 12, 6.6], [32, 30, -35, 10, 5.8], [32, 30, 35, 10, 5.8], [32, 23, 0, 9, 5.2]])
      g += leaf(x, y, r, l, w, c);
    g += speckles(32, 34, 8, d.spot);
    return g;
  },
  berry(d) { // fraisier / myrtillier : feuilles trifoliées, fruits qui pendent
    const c = d.color;
    let g = shadow(32, 53, 20);
    for (const [x, y, r, k] of [[32, 47, -68, 1.1], [32, 47, 68, 1.1], [32, 46, -34, 1.2], [32, 46, 34, 1.2], [32, 46, 0, 1.25]]) g += trifoliate(x, y, r, k);
    const fr = [[21, 48], [33, 50], [44, 47]];
    for (const [x, y] of fr) g += stem(`M32 44 Q${(x + 32) / 2} ${y - 10} ${x} ${y - 6}`, STEM, 1.1);
    for (const [x, y] of fr) g += d.round ? blueberries(x, y, c) : strawberry(x, y, c, d.spot);
    return g;
  },
  grain(d) { // blé : épis dorés
    const c = d.color;
    let g = shadow(32, 53, 16);
    for (const [r, L] of [[-30, 17], [30, 17], [-12, 20], [12, 20]]) g += leaf(32, 52, r, L, 2.3, LEAF.a);
    for (const [r, h] of [[-17, 34], [-6, 39], [6, 38], [17, 33]]) g += wheat(32, 52, r, h, c, d.spot);
    return g;
  },
  round(d) { // tomate : plant feuillu, fruits ronds et brillants
    const c = d.color;
    let g = shadow(32, 53, 19);
    g += stem("M32 52 Q31 38 32 17", STEM, 2.4);
    for (const [x, y, r, l, w, col] of [[32, 49, -72, 13, 5, LEAF.b], [32, 48, 72, 13, 5, LEAF.a], [32, 37, -60, 12, 4.6, LEAF.a], [32, 35, 60, 12, 4.6, LEAF.b], [32, 25, -30, 9, 3.8, LEAF.d], [32, 24, 30, 9, 3.8, LEAF.a]])
      g += leaf(x, y, r, l, w, col);
    for (const [x, y, r] of [[23.5, 43, 6.5], [40.5, 41, 7], [31, 30, 5.6]])
      g += stem(`M32 ${y - 7} Q${x} ${y - 10} ${x} ${y - r}`, STEM, 1) + tomato(x, y, r, c, d.spot);
    return g;
  },
  flower(d) { return d.spike ? lavender(d) : sunflower(d); },
  big(d) { // potiron : côtes bien marquées
    const c = d.color;
    let g = shadow(32, 55, 22, 5.5) + `<g transform="translate(32 47) scale(.86) translate(-32 -47)">`;
    g += leaf(17, 45, -76, 20, 10, LEAF.b) + leaf(47, 45, 76, 20, 10, LEAF.a) + leaf(27, 35, -32, 15, 8, LEAF.d) + leaf(38, 34, 30, 14, 7.5, LEAF.a);
    for (const [dx, rx] of [[-13, 9], [13, 9], [-7, 10.5], [7, 10.5], [0, 11]]) g += `<ellipse cx="${32 + dx}" cy="43.5" rx="${rx}" ry="12.5" fill="${vol(c)}"/>`;
    g += `<path d="M32 32 C31 27.5 33 24.5 36.5 23.5" stroke="#6f7f2c" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    g += speckles(32, 43, 10, d.spot) + shine(25, 37, 4.4, 2.3) + "</g>";
    return g;
  },
};

function frond(x, y, rot, L) {
  let g = `<path d="M0 0 Q1 ${-L * .5} 0 ${-L}" stroke="#3f8f37" stroke-width="1.3" fill="none"/>`;
  for (let i = 1; i <= 5; i++) {
    const t = i / 6, yy = -L * t, s = (1 - t * .45) * 5.6;
    g += leaf(0, yy, -58, s, 2.1, LEAF.d) + leaf(0, yy, 58, s, 2.1, LEAF.a);
  }
  g += leaf(0, -L, 0, 5, 2.3, LEAF.d);
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${g}</g>`;
}
function trifoliate(x, y, r, k = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${k})">${stem("M0 0 L0 -9", STEM, 1.2)}${leaf(0, -9, -42, 8.5, 4.4, LEAF.b)}${leaf(0, -9, 42, 8.5, 4.4, LEAF.a)}${leaf(0, -9, 0, 9.5, 4.8, LEAF.d)}</g>`;
}
function strawberry(x, y, c, spot) {
  const seeds = [[-2.5, -2], [0, -3], [2.5, -1.6], [-3, 1.2], [0, .2], [3, 1.6], [-1.3, 3.6], [1.4, 4]]
    .map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx=".42" ry=".6" fill="${spot || "#f5dd7c"}"/>`).join("");
  return `<g transform="translate(${x} ${y})"><path d="M0 -6 C5.5 -6 6.8 -2 5.2 2 C3.6 5.6 1.6 7.2 0 8.2 C-1.6 7.2 -3.6 5.6 -5.2 2 C-6.8 -2 -5.5 -6 0 -6Z" fill="${vol(c)}"/>${seeds}${shine(-2.2, -2.8, 1.8, 1.1)}${[-62, -22, 22, 62].map(a => leaf(0, -5.6, a, 3.8, 1.7, LEAF.a)).join("")}</g>`;
}
function blueberries(x, y, c) {
  return `<g transform="translate(${x} ${y})">${[[-2.6, 0, 3.1], [2.6, .6, 3.1], [0, -3.2, 2.9]].map(([a, b, r]) =>
    `<circle cx="${a}" cy="${b}" r="${r}" fill="${vol(c)}"/><circle cx="${a}" cy="${b}" r="${r}" fill="#fff" opacity=".12"/><circle cx="${a + .3}" cy="${b - r * .55}" r=".7" fill="${darken(c, .5)}"/>${shine(a - r * .35, b - r * .3, r * .3, r * .2)}`).join("")}</g>`;
}
function tomato(x, y, r, c, spot) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${vol(c)}"/>${speckles(x, y, r, spot)}${shine(x - r * .36, y - r * .38, r * .34, r * .2)}` +
    [-70, -25, 25, 70, 180].map(a => leaf(x, y - r + .7, a, r * .55, r * .22, LEAF.a)).join("");
}
function wheat(x, y, rot, h, c, spot) {
  let g = `<path d="M0 0 Q1 ${-h * .5} 0 ${-h}" stroke="${darken(c, .18)}" stroke-width="1.3" fill="none"/>`;
  for (let i = 0; i < 6; i++) {
    const yy = -h + 2.5 + i * 2.4;
    g += `<ellipse cx="-1.6" cy="${yy}" rx="1.9" ry="2.8" fill="${vol(c)}" transform="rotate(-22 -1.6 ${yy})"/><ellipse cx="1.6" cy="${yy + 1.2}" rx="1.9" ry="2.8" fill="${vol(lighten(c, .06))}" transform="rotate(22 1.6 ${yy + 1.2})"/>`;
  }
  g += `<ellipse cx="0" cy="${-h}" rx="1.6" ry="2.7" fill="${vol(c)}"/>`;
  if (spot) g += `<circle cx="0" cy="${-h + 6}" r="1.1" fill="${spot}" opacity=".85"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${g}</g>`;
}
function lavender(d) {
  const c = d.color;
  let g = shadow(32, 53, 15);
  for (const r of [-46, -28, -12, 12, 28, 46]) g += leaf(32, 52, r, 16, 1.9, LEAF.c);
  for (const [r, h] of [[-24, 34], [-12, 39], [0, 42], [12, 38], [24, 33]]) {
    let s = `<path d="M0 0 Q.8 ${-h * .5} 0 ${-h}" stroke="#6f9a5e" stroke-width="1.1" fill="none"/>`;
    for (let i = 0; i < 7; i++) {
      const yy = -h + 1 + i * 1.9, rr = 1.25 + i * .07;
      s += `<ellipse cx="-1.1" cy="${yy}" rx="${rr}" ry="${rr * 1.3}" fill="${vol(i % 2 ? c : darken(c, .12))}"/><ellipse cx="1.1" cy="${yy + .9}" rx="${rr}" ry="${rr * 1.3}" fill="${vol(lighten(c, .08))}"/>`;
    }
    g += `<g transform="translate(32 52) rotate(${r})">${s}</g>`;
  }
  return g;
}
function sunflower(d) {
  const c = d.color, cen = d.center || "#7a4b2a";
  let g = shadow(32, 54, 15);
  g += stem("M32 54 Q29.5 40 32 25", STEM, 2.8) + leaf(31, 46, -68, 16, 7, LEAF.b) + leaf(31, 39, 66, 15, 6.6, LEAF.a);
  for (let i = 0; i < 16; i++) g += leaf(32, 21, i * 22.5, 11.5, 3.3, c);
  g += `<circle cx="32" cy="21" r="7.4" fill="${vol(cen)}"/>`;
  for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = 1.2 + i * .38; g += `<circle cx="${(32 + Math.cos(a) * rr).toFixed(2)}" cy="${(21 + Math.sin(a) * rr).toFixed(2)}" r=".55" fill="${darken(cen, .4)}" opacity=".7"/>`; }
  g += shine(29.5, 18.5, 2.4, 1.4);
  return g;
}
function young(d) { // jeune plant, avec un indice de la couleur finale
  const s = d.shape;
  if (s === "grain" || d.spike) return [-24, -9, 7, 22].map((r, i) => leaf(32, 51, r, 22 - (i % 2) * 3, 2.3, i % 2 ? LEAF.a : LEAF.d)).join("");
  let g = stem("M32 50 Q31 40 32 30");
  g += leaf(32, 47, -70, 13, 5, LEAF.b) + leaf(32, 46, 70, 13, 5, LEAF.a) + leaf(32, 39, -45, 11, 4.5, LEAF.a) + leaf(32, 38, 45, 11, 4.5, LEAF.d) + leaf(32, 31, -15, 8, 3.6, LEAF.d) + leaf(32, 31, 15, 8, 3.6, LEAF.a);
  if (["round", "berry", "big", "flower"].includes(s)) g += `<circle cx="32" cy="28.5" r="2.6" fill="${vol(d.color)}"/>${shine(31, 27.5, 1, .6)}`;
  if (s === "bulb" || s === "root") g += `<ellipse cx="32" cy="49" rx="4.2" ry="2.6" fill="${vol(d.color)}"/>`;
  return g;
}

/* ---- Images détaillées (assets/img), utilisées dès qu'elles existent ---- */
const IMG = Object.assign({ plants: [], dishes: [], ui: [] }, window.IMG || {});
const hasImg = (kind, k) => IMG[kind].includes(k);
/* Une image dans un <svg> : elle se place exactement comme les dessins vectoriels. */
const imgSvg = (src, cls = "") => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><image href="${src}" width="64" height="64" preserveAspectRatio="xMidYMid meet"/></svg>`;
function cropArt(k) { return hasImg("plants", k) ? imgSvg(`assets/img/${k}-crop.webp`) : plantArt(k, 3); }
function seedArt(k) { return hasImg("plants", k) ? imgSvg(`assets/img/${k}-seeds.webp`) : packetArt(k); }

/* Pousses et jeunes plants dessinés sans terre, posés directement dans le bac. */
const SPROUTS = new Set(["rubis", "lilas", "citrouillotte", "bledor", "fraisille", "basilomate", "lune", "poivree", "radis", "laitue", "patate", "carotte", "ble", "fraise", "basilic", "tomate", "myrtille", "lavande", "potiron", "tournesol"]);
/* Plantes mûres dessinées sans terre (posées directement dans le bac). */
const RIPE_NO_SOIL = new Set(["radis", "laitue", "patate", "carotte", "ble", "fraise", "basilic", "tomate", "myrtille", "lavande", "potiron", "tournesol"]);
function plantArt(k, stage, inPlot) {
  if (stage === 1 && SPROUTS.has(k)) return imgSvg(`assets/img/${k}-sprout.webp`, "art img sprout");
  if (stage === 2 && SPROUTS.has(k)) return imgSvg(`assets/img/${k}-young.webp`, "art img young");
  if (stage === 3 && RIPE_NO_SOIL.has(k) && hasImg("plants", k)) return imgSvg(`assets/img/${k}-3.webp`, "art img ripe");
  if (hasImg("plants", k)) return stage === 0 ? imgSvg(`assets/img/${k}-grain.webp`, "art img grain") : imgSvg(`assets/img/${k}-${stage}.webp`, "art img");
  const d = PLANTS[k];
  let g;
  if (stage === 0) {
    g = shadow(32, 51, 15) + mound(32, 48.5, 13, 5.5) +
      `<ellipse cx="32" cy="47.5" rx="3.4" ry="1.5" fill="#6b4a26" opacity=".45"/><ellipse cx="30.6" cy="46.6" rx="1.6" ry="1.1" fill="${vol("#efd593")}"/><ellipse cx="33.7" cy="47" rx="1.4" ry="1" fill="${vol("#e4c47c")}"/>`;
  } else if (stage === 1) {
    g = shadow(32, 51, 10) + mound(32, 49.5, 10, 4.2) + stem("M32 49 Q31.5 44 32 39") + leaf(32, 40, -62, 8.5, 4.4, LEAF.d) + leaf(32, 40, 62, 8.5, 4.4, LEAF.a);
  } else if (stage === 2) {
    g = shadow(32, 52, 15) + mound(32, 50.5, 12, 4.6) + young(d);
  } else {
    g = SHAPES[d.shape](d);
  }
  const vb = inPlot || stage < 3 ? "0 0 64 64" : "7 9 50 50";
  return `<svg class="art" viewBox="${vb}" aria-hidden="true">${g}</svg>`;
}

/* Sachet de graines : papier kraft, bandeau de couleur, la plante dessinée dessus. */
function packetArt(k) {
  const inner = plantArt(k, 3).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const c = PLANTS[k].color, kraft = "#f1dfb8";
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${shadow(32, 58, 19, 3.5)}<path d="M13 9h38l-2.2 47.5H15.2z" fill="${vol(kraft)}"/>` +
    `<path d="M13 9h38v8.5H13z" fill="${vol(lighten(c, .12))}"/><path d="M13 17.5h38" stroke="${darken(kraft, .3)}" stroke-width=".8" stroke-dasharray="1.6 1.4"/>` +
    `<path d="M13 9h38" stroke="${darken(kraft, .2)}" stroke-width="1.2"/><svg x="15" y="19" width="34" height="35" viewBox="7 9 50 50">${inner}</svg></svg>`;
}

/* ---- Plats ---- */
const CERAMIC = "#fbf5ea";
function dishArt(r) {
  if (hasImg("dishes", r)) return imgSvg(`assets/img/dish-${r}.webp`);
  const d = RECIPES[r], c = d.color;
  const steam = (x) => `<path d="M${x} 16c-2 3 2 5 0 8M${x + 6} 14c-2 3 2 5 0 8" stroke="#b9c4c0" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>`;
  let g = shadow(32, 54, 22, 5);
  switch (d.look) {
    case "bowl":
      g += steam(29) + `<path d="M10 33h44a22 19 0 0 1-44 0z" fill="${vol(CERAMIC)}"/><ellipse cx="32" cy="33" rx="22" ry="5.2" fill="${darken(CERAMIC, .12)}"/><ellipse cx="32" cy="33.3" rx="19.5" ry="4.3" fill="${vol(c)}"/>` +
        `<circle cx="27" cy="32.5" r="1.4" fill="${lighten(c, .35)}"/><circle cx="35" cy="33.6" r="1.1" fill="${LEAF.a}"/>${shine(18, 40, 3, 6, 0)}`; break;
    case "bread":
      g += `<path d="M9 47c0-15 10.5-23 23-23s23 8 23 23z" fill="${vol(c)}"/><path d="M9 47h46v3H9z" fill="${darken(c, .3)}"/>` +
        `<path d="M21 32l4.5 6M30 29l4.5 6M39 30l4.5 6" stroke="${lighten(c, .55)}" stroke-width="2.2" stroke-linecap="round"/>${shine(22, 31, 6, 2.6)}`; break;
    case "pie":
      g += `<ellipse cx="32" cy="45" rx="26" ry="8.5" fill="${vol(CERAMIC)}"/><path d="M12 40c0-8 9-12 20-12s20 4 20 12c0 4-9 6-20 6s-20-2-20-6z" fill="${vol("#e1ad66")}"/><ellipse cx="32" cy="34.5" rx="17" ry="5" fill="${vol(c)}"/>` +
        [[-8, 0], [-2, -1.5], [5, -.5], [10, .8], [1, 1.5]].map(([a, b]) => `<circle cx="${32 + a}" cy="${34.5 + b}" r="2.3" fill="${vol(lighten(c, .1))}"/>`).join(""); break;
    case "jar":
      g += `<rect x="18" y="15" width="28" height="7.5" rx="3" fill="${vol("#c98a3a")}"/><path d="M17 23.5h30v24.5a6 6 0 0 1-6 6H23a6 6 0 0 1-6-6z" fill="#eef6f7" opacity=".9"/>` +
        `<path d="M19 30h26v18a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4z" fill="${vol(c)}"/><rect x="21" y="35" width="22" height="9" rx="2" fill="${CERAMIC}" opacity=".9"/>${shine(22, 27, 2, 5, 0)}`; break;
    case "cup":
      g += steam(27) + `<path d="M44 30h4a6.5 6.5 0 0 1 0 13h-4" stroke="${darken(CERAMIC, .08)}" stroke-width="4" fill="none"/><path d="M14 26h32v16a12 12 0 0 1-12 12h-8a12 12 0 0 1-12-12z" fill="${vol(CERAMIC)}"/>` +
        `<ellipse cx="30" cy="27" rx="15" ry="3.2" fill="${vol(c)}"/>${shine(19, 36, 2.4, 6, 0)}`; break;
    case "cake":
      g += `<ellipse cx="32" cy="51" rx="23" ry="4.5" fill="${vol(CERAMIC)}"/><path d="M13 29h38v20H13z" fill="${vol("#f3d6a2")}"/><path d="M13 29h38v6H13z" fill="${vol(c)}"/>` +
        `<path d="M13 35c3 4 6 0 9.5 3s6-1 9.5 2 6-1 9.5 1 6-2 9.5-2" stroke="${c}" stroke-width="3" fill="none"/><circle cx="32" cy="23.5" r="5" fill="${vol("#e8414f")}"/>${stem("M32 18.5v-4", STEM, 2)}`; break;
  }
  return `<svg viewBox="5 7 54 54" aria-hidden="true">${g}</svg>`;
}

/* ---- Voisins (eux gardent leur frimousse) ---- */
const INK = "#3a2a22";
function face(cx, cy, s) {
  return `<circle cx="${cx - s}" cy="${cy}" r="${s * .3}" fill="${INK}"/><circle cx="${cx + s}" cy="${cy}" r="${s * .3}" fill="${INK}"/>` +
    `<path d="M${cx - s * .45} ${cy + s * .55} Q${cx} ${cy + s * 1.05} ${cx + s * .45} ${cy + s * .55}" stroke="${INK}" stroke-width="${s * .22}" fill="none" stroke-linecap="round"/>` +
    `<circle cx="${cx - s * 1.65}" cy="${cy + s * .6}" r="${s * .38}" fill="#ff8fa3" opacity=".6"/><circle cx="${cx + s * 1.65}" cy="${cy + s * .6}" r="${s * .38}" fill="#ff8fa3" opacity=".6"/>`;
}
function avatar(v) {
  const i = VILLAGERS.indexOf(v);
  if (i >= 0) return `<img src="assets/img/villager-${i}.webp" alt="" loading="lazy">`;
  return `<svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="23" fill="${v.color}" opacity=".22"/><circle cx="12" cy="13" r="6" fill="${vol(v.ear)}"/><circle cx="34" cy="13" r="6" fill="${vol(v.ear)}"/><circle cx="23" cy="25" r="15" fill="${vol(v.color)}"/><ellipse cx="23" cy="31" rx="7" ry="5" fill="#fff" opacity=".55"/><circle cx="23" cy="29" r="2.2" fill="${INK}"/>${face(23, 23, 3.2)}</svg>`;
}

const DROP = `<svg viewBox="0 0 16 16"><path d="M8 1.5C6 5 3.5 7.5 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.5 10 5 8 1.5z" fill="${vol("#3f9bdc")}"/><ellipse cx="6.4" cy="9.6" rx="1" ry="1.6" fill="#fff" opacity=".6"/></svg>`;
const STAR = `<svg viewBox="0 0 16 16"><path d="M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.2 4 13.5l1-4.4-3.4-3 4.5-.5z" fill="${vol("#f4c03e")}"/></svg>`;
const WEED = `<g>${leaf(17, 61, -20, 15, 3, "#6e9a3a")}${leaf(21, 61, 8, 18, 3.2, "#5d8a30")}${leaf(25, 61, 30, 13, 2.8, "#7aa845")}` +
  `<ellipse cx="45" cy="56" rx="10" ry="4.5" fill="${vol("#d9bf94")}"/><circle cx="47" cy="50.5" r="6.5" fill="${vol("#b07a48")}"/>` +
  `<path d="M47 50.5m-3 0a3 3 0 1 0 3-3" stroke="#7d5230" stroke-width="1.3" fill="none"/><path d="M37 53l-3-5M39 52l-1-6" stroke="#c9a77a" stroke-width="1.5" stroke-linecap="round"/></g>`;

/* Pré-calcule tous les dégradés, puis les place une seule fois dans la page. */
(function installArtDefs() {
  for (const k in PLANTS) for (let s = 0; s < 4; s++) plantArt(k, s);
  for (const r in RECIPES) dishArt(r);
  for (const v of VILLAGERS) avatar(v);
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML = `<defs>${[...GRADS.values()].join("")}</defs>`;
  document.body.prepend(svg);
  DEFS_EL = svg.querySelector("defs");
})();
