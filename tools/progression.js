/* Génère docs/progression.md à partir des données du jeu (js/data.js, js/achievements.js, js/game.js).
   Usage : node tools/progression.js
   À relancer après chaque changement d'équilibrage pour garder le document à jour. */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

global.window = {};
eval(read("js/data.js") + "\n;Object.assign(global,{PLANTS,ORDER,RECIPES,RORDER,UPG,PLOT_STEPS,MAX_PLOTS,LAB_TIME,VILLAGERS});");
const game = read("js/game.js");
const xpExpr = /const xpNeed = l => (.+?);/.exec(game)[1];
const xpNeed = new Function("l", "return " + xpExpr);
const version = /const APP_VERSION = "([^"]+)"/.exec(game)[1];
global.S = { stats: {}, ach: {} }; global.st = () => 0; global.fmt = n => String(n);
global.FRIENDS_ON = false; // tableau de la version des joueurs (sans les succès entre amis)
eval(read("js/achievements.js").replace(/^(const|let) /gm, "global.$1_".replace("$1_", "")).replace(/global\.(\w+) =/g, "global.$1 ="));

const fr = n => Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
const dur = s => s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${String(Math.round(s % 3600 / 60)).padStart(2, "0")}`;
const SEASON = { printemps: "Printemps", ete: "Été", automne: "Automne", hiver: "Hiver" };
const name = k => PLANTS[k]?.name || RECIPES[k]?.name || k;
const base = ORDER.filter(k => !PLANTS[k].hybrid), hyb = ORDER.filter(k => PLANTS[k].hybrid);
const out = [];
const p = s => out.push(s);

p(`# Progression et équilibrage\n`);
p(`*Généré automatiquement par \`node tools/progression.js\` · version ${version} du jeu. Ne pas modifier à la main.*\n`);

// --- Courbe d'XP
p(`## Courbe d'XP\n`);
p(`XP nécessaire pour passer au niveau suivant : \`${xpExpr}\`. Un grand palier tous les 3 niveaux.\n`);
p(`| Niveau | XP pour le suivant | XP totale pour l'atteindre | Grand palier |`);
p(`| --- | --- | --- | --- |`);
let cum = 0;
for (let l = 1; l <= 30; l++) { p(`| ${l} | ${fr(xpNeed(l))} | ${fr(cum)} | ${l % 3 === 0 ? "★" : ""} |`); cum += xpNeed(l); }
p("");

// --- Déblocages par niveau
p(`## Déblocages par niveau\n`);
const by = {};
const add = (l, col, txt) => { by[l] = by[l] || { plants: [], recipes: [], upg: [] }; by[l][col].push(txt); };
for (const k of base) add(PLANTS[k].lvl, "plants", `${PLANTS[k].name}${PLANTS[k].only ? ` (${SEASON[PLANTS[k].season].toLowerCase()})` : ""}`);
for (const r of RORDER) add(RECIPES[r].lvl, "recipes", RECIPES[r].name);
for (const u in UPG) UPG[u].steps.forEach((s, i) => add(s.lvl, "upg", `${UPG[u].name}${UPG[u].steps.length > 1 ? ` ${i + 1}/${UPG[u].steps.length}` : ""} (${fr(s.cost)} p)`));
PLOT_STEPS.forEach((s, i) => add(s.lvl, "upg", `Bac n° ${7 + i} (${fr(s.cost)} p)`));
add(3, "upg", "Serre à hybrides");
p(`Entre parenthèses après une plante : sa saison, pour les plantes exclusives ; après une amélioration : son prix en pièces.\n`);
p(`| Niveau | Plantes | Recettes | Améliorations |`);
p(`| --- | --- | --- | --- |`);
for (let l = 1; l <= 30; l++) { const b = by[l] || { plants: [], recipes: [], upg: [] }; p(`| ${l} | ${b.plants.join(", ") || "—"} | ${b.recipes.join(", ") || "—"} | ${b.upg.join(", ") || "—"} |`); }
p("");

// --- Améliorations
p(`## Améliorations (Marché › Bonus)\n`);
p(`| Amélioration | Palier | Niveau | Prix |`);
p(`| --- | --- | --- | --- |`);
for (const u in UPG) { const U = UPG[u]; U.steps.forEach((s, i) => p(`| ${i ? "" : U.name} | ${i + 1}/${U.steps.length} | ${s.lvl} | ${fr(s.cost)} |`)); }
PLOT_STEPS.forEach((s, i) => p(`| ${i ? "" : "Nouvelle parcelle"} | bac ${7 + i}/${MAX_PLOTS} | ${s.lvl} | ${fr(s.cost)} |`));
p("");

// --- Plantes
const plantRow = k => { const d = PLANTS[k]; return `| ${d.name} | ${d.hybrid ? "Serre" : d.lvl} | ${d.season ? SEASON[d.season] + (d.only ? " (exclusive)" : "") : "—"} | ${fr(d.cost)} | ${dur(d.time)} | ${fr(d.sell)} | ${d.xp} | ${(d.sell / (d.time / 60)).toFixed(1)} |`; };
p(`## Plantes\n`);
p(`Temps de pousse sans compost ni bonus de saison (+25 % de vitesse pendant la saison de la plante). « p/min » = prix de vente par minute de pousse.\n`);
p(`| Plante | Niveau | Saison | Graine | Pousse | Vente | XP | p/min |`);
p(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
for (const k of [...base].sort((a, b) => PLANTS[a].lvl - PLANTS[b].lvl)) p(plantRow(k));
p(`\n### Hybrides\n`);
p(`| Hybride | Parents | Pousse | Vente | XP |`);
p(`| --- | --- | --- | --- | --- |`);
for (const k of hyb) { const d = PLANTS[k]; p(`| ${d.name} | ${d.parents.map(name).join(" + ")} | ${dur(d.time)} | ${fr(d.sell)} | ${d.xp} |`); }
p("");

// --- Recettes
p(`## Recettes\n`);
p(`| Recette | Niveau | Prix d'apprentissage | Ingrédients | Cuisson | Vente | XP |`);
p(`| --- | --- | --- | --- | --- | --- | --- |`);
for (const r of [...RORDER].sort((a, b) => RECIPES[a].lvl - RECIPES[b].lvl)) { const d = RECIPES[r]; p(`| ${d.name} | ${d.lvl} | ${fr(d.price)} | ${Object.entries(d.need).map(([k, n]) => `${n} ${name(k).toLowerCase()}`).join(", ")} | ${dur(d.time)} | ${fr(d.sell)} | ${d.xp} |`); }
p("");

// --- Autres sources d'XP et de pièces
p(`## Autres gains\n`);
p(`- **Commandes du village** : XP = (XP des objets × 0,8 + 3) × bonus de difficulté (×1,15 à ×1,9) ; pièces = (valeur des objets × bonus + 2) × 0,8 ; ×1,3 (XP et pièces) pour une commande « Hors saison ».`);
p(`- **Cadeau du jour** : pièces = (10 + 4 × niveau) × (1 + 0,15 par jour d'affilée, jusqu'au 6ᵉ) ; XP = (5 + 2 × niveau) × le même bonus. Le 7ᵉ jour : ×2,5, plus 1 graine de saison et 1 graine d'hybride.`);
p(`- **Serre** : croisement en ${dur(LAB_TIME)} ; nouvel hybride +25 XP, hybride déjà connu +6 XP.`);
p(`- **Récoltes** : 8 % de chances de récolte double, 2 % de récolte dorée (vaut 10 fois le prix).`);
p(`- **Terre sèche** : la plante pousse à 25 % de sa vitesse.`);
p("");

// --- Succès
p(`## Succès\n`);
p(`| Succès | Palier | Objectif | Pièces | XP | Autre |`);
p(`| --- | --- | --- | --- | --- | --- |`);
for (const a of ACHIEVEMENTS) a.tiers.forEach((t, i) => {
  const desc = typeof a.desc === "function" ? a.desc(t.n) : a.desc;
  const other = [t.title ? `titre « ${t.title} »` : "", t.bonus ? (typeof BONUS_TEXT !== "undefined" && BONUS_TEXT[t.bonus] || t.bonus) : "", t.deco ? `déco ${DECOS[t.deco]}` : ""].filter(Boolean).join(", ");
  p(`| ${i ? "" : a.name + (a.hidden ? " 🔒" : "")} | ${a.tiers.length > 1 ? i + 1 : ""} | ${desc} | ${fr(t.c || 0)} | ${t.x || 0} | ${other} |`);
});
p(`\n🔒 = succès caché.`);

fs.writeFileSync(path.join(ROOT, "docs/progression.md"), out.join("\n") + "\n");
console.log("docs/progression.md généré (" + out.length + " lignes)");
