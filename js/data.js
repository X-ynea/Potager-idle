"use strict";
/* Données du jeu : plantes, recettes, améliorations, voisins. */
/* ---------------- Data ---------------- */
const PLANTS = {
  radis:    { name: "Radis", lvl: 1, cost: 2, time: 60, sell: 5, xp: 2, shape: "bulb", color: "#ec5b82" },
  laitue:   { name: "Laitue", lvl: 1, cost: 3, time: 120, sell: 9, xp: 3, shape: "leafy", color: "#a6dc78" },
  carotte:  { name: "Carotte", lvl: 2, cost: 5, time: 180, sell: 14, xp: 4, shape: "root", color: "#f28a2e" },
  ble:      { name: "Blé", lvl: 3, cost: 6, time: 240, sell: 17, xp: 5, shape: "grain", color: "#e8b94a" },
  fraise:   { name: "Fraise", lvl: 3, cost: 8, time: 300, sell: 24, xp: 6, shape: "berry", color: "#e8414f" },
  basilic:  { name: "Basilic", lvl: 4, cost: 10, time: 360, sell: 28, xp: 7, shape: "herb", color: "#3e9a4b" },
  tomate:   { name: "Tomate", lvl: 5, cost: 12, time: 450, sell: 36, xp: 8, shape: "round", color: "#e2483d" },
  myrtille: { name: "Myrtille", lvl: 6, cost: 16, time: 600, sell: 48, xp: 10, shape: "berry", round: true, color: "#5a6fd6" },
  lavande:  { name: "Lavande", lvl: 7, cost: 20, time: 720, sell: 58, xp: 12, shape: "flower", spike: true, color: "#9f7ae0" },
  potiron:  { name: "Potiron", lvl: 8, cost: 35, time: 1200, sell: 110, xp: 20, shape: "big", color: "#f08a24" },
  tournesol:{ name: "Tournesol", lvl: 10, cost: 28, time: 900, sell: 80, xp: 16, shape: "flower", color: "#f6c62f", center: "#7a4b2a" },
  // Hybrides : découverts dans la Serre
  rubis:    { name: "Radis rubis", hybrid: true, parents: ["radis", "fraise"], time: 240, sell: 42, xp: 10, shape: "bulb", color: "#c2185b", spot: "#ff9fc0", hint: "Une racine ronde et un petit fruit rouge…" },
  poivree:  { name: "Laitue poivrée", hybrid: true, parents: ["laitue", "basilic"], time: 300, sell: 52, xp: 11, shape: "leafy", color: "#b8e07a", outer: "#a3475e", hint: "Deux feuillages qui se ressemblent…" },
  lune:     { name: "Radis lune", hybrid: true, parents: ["radis", "myrtille"], time: 420, sell: 72, xp: 14, shape: "bulb", color: "#6b7fe0", spot: "#d6ddff", hint: "Une racine rose qui rêve de bleu…" },
  basilomate:{ name: "Basilomate", hybrid: true, parents: ["tomate", "basilic"], time: 480, sell: 86, xp: 16, shape: "round", color: "#e8633f", spot: "#7fcf6a", hint: "Le duo préféré des sauces…" },
  fraisille:{ name: "Fraisille", hybrid: true, parents: ["fraise", "myrtille"], time: 540, sell: 96, xp: 18, shape: "berry", color: "#b04fc0", spot: "#ffb3e0", hint: "Deux baies de couleurs différentes…" },
  bledor:   { name: "Blé d’or", hybrid: true, parents: ["ble", "tournesol"], time: 800, sell: 150, xp: 26, shape: "grain", color: "#ffcf1f", spot: "#fff2a8", hint: "Un épi qui suit le soleil…" },
  citrouillotte:{ name: "Citrouillotte", hybrid: true, parents: ["carotte", "potiron"], time: 1100, sell: 195, xp: 32, shape: "big", color: "#ff9a3d", spot: "#ffd08a", hint: "Le plus gros et le plus pointu des orange…" },
  lilas:    { name: "Soleil lilas", hybrid: true, parents: ["lavande", "tournesol"], time: 1000, sell: 205, xp: 34, shape: "flower", color: "#c79bf2", center: "#f6c62f", hint: "Deux fleurs, une violette et une géante…" },
};
const ORDER = Object.keys(PLANTS);
const HYBRID_BY_PAIR = {};
for (const k of ORDER) { const d = PLANTS[k]; if (d.hybrid) { HYBRID_BY_PAIR[pairKey(...d.parents)] = k; d.cost = Math.round(d.sell * 0.35); } }
function pairKey(a, b) { return [a, b].sort().join("+"); }

const RECIPES = {
  salade:   { name: "Salade croquante", lvl: 2, price: 25, need: { laitue: 2, radis: 1 }, time: 90, sell: 34, xp: 8, look: "bowl", color: "#93d26b" },
  soupe:    { name: "Soupe de carottes", lvl: 3, price: 45, need: { carotte: 3 }, time: 120, sell: 56, xp: 10, look: "bowl", color: "#f28a2e" },
  pain:     { name: "Pain de campagne", lvl: 3, price: 50, need: { ble: 3 }, time: 150, sell: 66, xp: 12, look: "bread", color: "#d39a52" },
  tarte:    { name: "Tarte aux fraises", lvl: 4, price: 80, need: { fraise: 2, ble: 2 }, time: 200, sell: 108, xp: 16, look: "pie", color: "#e8414f" },
  sauce:    { name: "Sauce tomate", lvl: 5, price: 110, need: { tomate: 2, basilic: 1 }, time: 220, sell: 128, xp: 18, look: "jar", color: "#e2483d" },
  muffins:  { name: "Muffins myrtille", lvl: 6, price: 140, need: { myrtille: 2, ble: 1 }, time: 240, sell: 142, xp: 20, look: "cake", color: "#5a6fd6" },
  smoothie: { name: "Smoothie fraisille", lvl: 6, price: 200, need: { fraisille: 2 }, time: 200, sell: 235, xp: 26, look: "cup", color: "#b04fc0" },
  tisane:   { name: "Tisane lavande", lvl: 7, price: 160, need: { lavande: 2 }, time: 180, sell: 138, xp: 18, look: "cup", color: "#a57be0" },
  pesto:    { name: "Pesto basilomate", lvl: 7, price: 260, need: { basilomate: 2, ble: 1 }, time: 260, sell: 225, xp: 28, look: "jar", color: "#6fae4a" },
  veloute:  { name: "Velouté de potiron", lvl: 8, price: 220, need: { potiron: 1, carotte: 2 }, time: 300, sell: 165, xp: 24, look: "bowl", color: "#f08a24" },
  confiture:{ name: "Confiture rubis", lvl: 9, price: 300, need: { rubis: 2, fraise: 2 }, time: 300, sell: 225, xp: 30, look: "jar", color: "#c2185b" },
  gateau:   { name: "Gâteau des moissons", lvl: 11, price: 500, need: { bledor: 2, citrouillotte: 1, myrtille: 2 }, time: 600, sell: 720, xp: 60, look: "cake", color: "#ffcf1f" },
};
const RORDER = Object.keys(RECIPES);

const UPG = {
  water: { name: "Arrosoir", steps: [{ cost: 60, lvl: 2 }, { cost: 220, lvl: 4 }, { cost: 650, lvl: 7 }], values: [4, 8, 15, 30],
           desc: v => `L’eau tient ${v} min dans la terre` },
  hose:  { name: "Tuyau d’arrosage", steps: [{ cost: 120, lvl: 3 }], values: [0, 1], desc: () => "Débloque le bouton « Tout arroser »" },
  fert:  { name: "Compost maison", steps: [{ cost: 150, lvl: 4 }, { cost: 450, lvl: 6 }, { cost: 1200, lvl: 9 }], values: [1, 1.15, 1.3, 1.5],
           desc: v => v === 1 ? "Vitesse de pousse normale" : `Les plantes poussent ${Math.round((v - 1) * 100)} % plus vite` },
  stove: { name: "Fourneau", steps: [{ cost: 250, lvl: 5 }, { cost: 900, lvl: 9 }], values: [1, 2, 3], desc: v => `${v} plat${v > 1 ? "s" : ""} en même temps` },
  auto:  { name: "Arroseur automatique", steps: [{ cost: 2500, lvl: 12 }], values: [0, 1], desc: v => v ? "Tes plantes n’ont plus jamais soif" : "Tes plantes n’auront plus jamais soif" },
};
const PLOT_STEPS = [{ cost: 40, lvl: 1 }, { cost: 90, lvl: 2 }, { cost: 180, lvl: 3 }, { cost: 350, lvl: 5 }, { cost: 600, lvl: 7 }, { cost: 1000, lvl: 9 }];
const MAX_PLOTS = 6 + PLOT_STEPS.length;
const LAB_TIME = 90;

const VILLAGERS = [
  { name: "Mme Hérisson", color: "#c49a6c", ear: "#8c6a46", say: ["Pour mon petit-déjeuner, s’il te plaît !", "J’ai des invités ce soir…"] },
  { name: "Papi Blaireau", color: "#9aa3a8", ear: "#5d666b", say: ["Comme au bon vieux temps !", "Ma soupe du dimanche en dépend."] },
  { name: "Lou la Loutre", color: "#b07a4f", ear: "#7c5434", say: ["Pique-nique au bord de l’eau !", "C’est pour un goûter entre amis."] },
  { name: "Pip le Moineau", color: "#d9a066", ear: "#9b6b3c", say: ["Juste un petit en-cas !", "Cuicui, merci d’avance !"] },
  { name: "Tante Grenouille", color: "#7fbf6a", ear: "#4d8a3c", say: ["Pour ma fête de la mare !", "Croâ, j’en rêve depuis hier."] },
  { name: "Basile l’Écureuil", color: "#d07a3c", ear: "#9a5222", say: ["Pour mes réserves d’hiver !", "Je paie bien, promis !"] },
];

