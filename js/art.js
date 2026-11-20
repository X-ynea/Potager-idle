"use strict";
/* Dessins SVG des plantes, plats et voisins. */
/* ---------------- Art (SVG) ---------------- */
const G = "#5bb04f", G2 = "#3f8f3e", INK = "#3a2a22";
function face(cx, cy, s) {
  return `<circle cx="${cx - s}" cy="${cy}" r="${s * .3}" fill="${INK}"/><circle cx="${cx + s}" cy="${cy}" r="${s * .3}" fill="${INK}"/>` +
    `<path d="M${cx - s * .45} ${cy + s * .55} Q${cx} ${cy + s * 1.05} ${cx + s * .45} ${cy + s * .55}" stroke="${INK}" stroke-width="${s * .22}" fill="none" stroke-linecap="round"/>` +
    `<circle cx="${cx - s * 1.65}" cy="${cy + s * .6}" r="${s * .38}" fill="#ff8fa3" opacity=".65"/><circle cx="${cx + s * 1.65}" cy="${cy + s * .6}" r="${s * .38}" fill="#ff8fa3" opacity=".65"/>`;
}
function leaf(x, y, rot, len, color) {
  return `<ellipse cx="0" cy="${-len / 2}" rx="${len * .32}" ry="${len / 2}" transform="translate(${x} ${y}) rotate(${rot})" fill="${color}"/>`;
}
function shine(cx, cy, r) { return `<ellipse cx="${cx - r * .4}" cy="${cy - r * .45}" rx="${r * .28}" ry="${r * .18}" fill="#fff" opacity=".45" transform="rotate(-30 ${cx - r * .4} ${cy - r * .45})"/>`; }
function plantArt(k, stage) {
  const d = PLANTS[k];
  let g = "";
  if (stage === 0) {
    g = `<ellipse cx="32" cy="52" rx="13" ry="4.5" fill="#000" opacity=".12"/><ellipse cx="32" cy="49" rx="9" ry="5" fill="#8a5f3c"/><ellipse cx="32" cy="46.5" rx="3.4" ry="2.6" fill="#f0dca2"/>`;
  } else if (stage === 1) {
    g = `<path d="M32 54 V40" stroke="${G2}" stroke-width="3" stroke-linecap="round"/>${leaf(32, 41, -55, 11, G)}${leaf(32, 41, 55, 11, "#7cc46e")}`;
  } else if (stage === 2) {
    g = `<path d="M32 55 V28" stroke="${G2}" stroke-width="3.2" stroke-linecap="round"/>${leaf(32, 44, -62, 14, G)}${leaf(32, 44, 62, 14, "#7cc46e")}${leaf(32, 34, -38, 12, "#7cc46e")}${leaf(32, 34, 38, 12, G)}<circle cx="32" cy="27" r="3.4" fill="${d.color}"/>`;
  } else {
    const c = d.color, sp = d.spot;
    const spots = (cx, cy, r) => sp ? `<circle cx="${cx + r * .45}" cy="${cy - r * .35}" r="${r * .16}" fill="${sp}"/><circle cx="${cx - r * .1}" cy="${cy + r * .55}" r="${r * .12}" fill="${sp}"/><circle cx="${cx + r * .6}" cy="${cy + r * .3}" r="${r * .1}" fill="${sp}"/>` : "";
    switch (d.shape) {
      case "bulb":
        g = `${leaf(32, 30, -32, 17, G)}${leaf(32, 30, 32, 17, G)}${leaf(32, 30, 0, 19, "#7cc46e")}<path d="M32 52 L32 58" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="41" r="13" fill="${c}"/>${shine(32, 41, 13)}${spots(32, 41, 13)}${face(32, 42, 3.1)}`; break;
      case "root":
        g = `${leaf(32, 24, -35, 15, G)}${leaf(32, 24, 35, 15, G)}${leaf(32, 24, 0, 17, "#7cc46e")}<path d="M20 27 Q32 21 44 27 Q39 46 32 58 Q25 46 20 27Z" fill="${c}"/><path d="M24 38h4M36 44h-3M27 49h3" stroke="#000" opacity=".15" stroke-width="1.6" stroke-linecap="round"/>${spots(32, 34, 10)}${face(32, 33, 2.9)}`; break;
      case "leafy":
        g = [-75, -45, -15, 15, 45, 75].map((r, i) => leaf(32, 50, r, 24, i % 2 ? G : G2)).join("") + `<circle cx="32" cy="40" r="12.5" fill="${c}"/><path d="M24 38 Q32 30 40 38" stroke="#fff" opacity=".35" stroke-width="2" fill="none"/>${spots(32, 40, 12)}${face(32, 42, 3)}`; break;
      case "berry":
        g = `<circle cx="22" cy="40" r="11" fill="${G2}"/><circle cx="42" cy="40" r="11" fill="${G2}"/><circle cx="32" cy="30" r="12" fill="${G}"/><circle cx="21" cy="30" r="4.5" fill="${c}"/><circle cx="44" cy="31" r="4.5" fill="${c}"/><circle cx="32" cy="43" r="10" fill="${c}"/>${shine(32, 43, 10)}${spots(32, 43, 10)}${face(32, 44, 2.6)}`; break;
      case "grain":
        g = [[22, -10], [32, 0], [42, 10]].map(([x, r]) => `<path d="M${x} 56 Q${x + r * .3} 38 ${x + r * .6} 22" stroke="${G2}" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="${x + r * .6}" cy="18" rx="4.6" ry="10" fill="${c}" transform="rotate(${r} ${x + r * .6} 18)"/>`).join("") + `${leaf(28, 50, -60, 12, G)}${leaf(36, 50, 60, 12, G)}${spots(32, 18, 8)}${face(32, 18, 1.7)}`; break;
      case "round":
        g = `<path d="M32 56 V26" stroke="${G2}" stroke-width="3" stroke-linecap="round"/>${leaf(32, 52, -65, 13, G)}${leaf(32, 52, 65, 13, G)}<circle cx="32" cy="38" r="14" fill="${c}"/>${shine(32, 38, 14)}${spots(32, 38, 14)}${[-60, -20, 20, 60].map(r => leaf(32, 25.5, r, 7, G2)).join("")}${face(32, 40, 3.3)}`; break;
      case "flower": {
        const cen = d.center || "#f6c62f";
        let petals = ""; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; petals += `<circle cx="${32 + Math.cos(a) * 10}" cy="${24 + Math.sin(a) * 10}" r="6.2" fill="${c}"/>`; }
        g = `<path d="M32 58 V32" stroke="${G2}" stroke-width="3.2" stroke-linecap="round"/>${leaf(32, 50, -60, 14, G)}${leaf(32, 44, 60, 14, G)}${petals}<circle cx="32" cy="24" r="8" fill="${cen}"/>${face(32, 24.5, 2.2)}`; break;
      }
      case "big":
        g = `${leaf(20, 36, -70, 16, G)}${leaf(44, 36, 70, 16, G)}<rect x="30" y="20" width="4" height="9" rx="2" fill="#6b4a2a"/><ellipse cx="32" cy="42" rx="22" ry="15" fill="${c}"/><ellipse cx="32" cy="42" rx="8" ry="15" fill="none" stroke="#000" opacity=".12" stroke-width="2"/><ellipse cx="32" cy="42" rx="16" ry="15" fill="none" stroke="#000" opacity=".1" stroke-width="2"/>${shine(32, 42, 18)}${spots(32, 42, 16)}${face(32, 44, 3.6)}`; break;
    }
  }
  return `<svg class="art" viewBox="0 0 64 64" aria-hidden="true">${g}</svg>`;
}
function dishArt(r) {
  const d = RECIPES[r], c = d.color;
  let g = "";
  switch (d.look) {
    case "bowl": g = `<path d="M30 14c-2 4 2 6 0 10M36 14c-2 4 2 6 0 10" stroke="#9aa" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/><ellipse cx="32" cy="34" rx="22" ry="5" fill="${c}"/><path d="M10 34h44a22 18 0 0 1-44 0z" fill="#fff6ea" stroke="#d9c7a8" stroke-width="1.5"/>${face(32, 44, 2.8)}`; break;
    case "bread": g = `<path d="M10 46c0-14 10-22 22-22s22 8 22 22z" fill="${c}"/><path d="M10 46h44v4H10z" fill="#b07a3c"/><path d="M22 32l4 6M30 29l4 6M38 30l4 6" stroke="#fff" opacity=".5" stroke-width="2.2" stroke-linecap="round"/>${face(32, 41, 2.6)}`; break;
    case "pie": g = `<ellipse cx="32" cy="44" rx="26" ry="9" fill="#fff6ea" stroke="#d9c7a8" stroke-width="1.5"/><path d="M12 40c0-8 9-12 20-12s20 4 20 12c0 4-9 6-20 6s-20-2-20-6z" fill="#e2b06a"/><ellipse cx="32" cy="34" rx="17" ry="5" fill="${c}"/><circle cx="25" cy="33" r="2.4" fill="#fff" opacity=".4"/>${face(32, 41, 2.4)}`; break;
    case "jar": g = `<rect x="18" y="16" width="28" height="7" rx="3" fill="#c98a3a"/><path d="M17 24h30v24a6 6 0 0 1-6 6H23a6 6 0 0 1-6-6z" fill="#eaf4f6" stroke="#b9cfd3" stroke-width="1.5"/><path d="M19 30h26v18a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4z" fill="${c}"/>${face(32, 40, 2.8)}`; break;
    case "cup": g = `<path d="M28 10c-2 4 2 6 0 10M35 10c-2 4 2 6 0 10" stroke="#9aa" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/><path d="M44 30h4a6 6 0 0 1 0 12h-4" stroke="#fff6ea" stroke-width="4" fill="none"/><path d="M14 26h32v16a12 12 0 0 1-12 12h-8a12 12 0 0 1-12-12z" fill="#fff6ea" stroke="#d9c7a8" stroke-width="1.5"/><ellipse cx="30" cy="27" rx="15" ry="3" fill="${c}"/>${face(30, 40, 2.8)}`; break;
    case "cake": g = `<path d="M14 30h36v20H14z" fill="#f3d9a8"/><path d="M14 30h36v6H14z" fill="${c}"/><path d="M14 36c3 4 6 0 9 3s6-1 9 2 6-1 9 1 6-2 9-2" stroke="${c}" stroke-width="3" fill="none"/><ellipse cx="32" cy="52" rx="22" ry="4" fill="#fff6ea" stroke="#d9c7a8" stroke-width="1.2"/><circle cx="32" cy="24" r="5" fill="#e8414f"/><path d="M32 19v-4" stroke="${G2}" stroke-width="2"/>${face(32, 44, 2.6)}`; break;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${g}</svg>`;
}
function avatar(v) {
  return `<svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="23" fill="${v.color}" opacity=".25"/><circle cx="12" cy="13" r="6" fill="${v.ear}"/><circle cx="34" cy="13" r="6" fill="${v.ear}"/><circle cx="23" cy="25" r="15" fill="${v.color}"/><ellipse cx="23" cy="31" rx="7" ry="5" fill="#fff" opacity=".55"/><circle cx="23" cy="29" r="2.2" fill="${INK}"/>${face(23, 23, 3.2)}</svg>`;
}
const DROP = `<svg viewBox="0 0 16 16"><path d="M8 1.5C6 5 3.5 7.5 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.5 10 5 8 1.5z" fill="#3f9bdc"/></svg>`;
const STAR = `<svg viewBox="0 0 16 16"><path d="M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.2 4 13.5l1-4.4-3.4-3 4.5-.5z" fill="#f4c03e"/></svg>`;
const WEED = `<g><path d="M18 60c0-8 2-12 6-16M24 60c0-10 4-14 10-16M30 60c1-7-1-12-5-15" stroke="#4d7c2e" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="44" cy="54" rx="9" ry="5" fill="#c9a77a"/><circle cx="46" cy="50" r="6" fill="#a8764d" stroke="#7d5538" stroke-width="1.5"/><path d="M46 50m-3 0a3 3 0 1 0 3-3" stroke="#7d5538" stroke-width="1.3" fill="none"/><path d="M36 52l-3-5M38 51l-1-6" stroke="#c9a77a" stroke-width="1.5" stroke-linecap="round"/></g>`;

