"use strict";
/* Données du jeu : plantes, recettes, améliorations, voisins. */
/* ---------------- Data ---------------- */
const PLANTS = {
  radis:    { name: "Radis", desc: "Croquant et un brin piquant. Le premier légume de tout bon potager.", lvl: 1, cost: 2, time: 180, sell: 5, xp: 2, shape: "bulb", color: "#ec5b82" },
  laitue:   { name: "Laitue", desc: "Tendre et fraîche, elle pousse sans se faire prier.", lvl: 1, cost: 3, time: 360, sell: 9, xp: 3, shape: "leafy", color: "#a6dc78" },
  patate:   { name: "Pomme de terre", desc: "Elle pousse cachée sous terre et se prête à toutes les recettes.", lvl: 2, cost: 4, time: 480, sell: 11, xp: 3, shape: "bulb", color: "#c9a26b" },
  carotte:  { name: "Carotte", desc: "Elle se cache sous terre : seules ses fanes trahissent sa présence.", lvl: 3, cost: 5, time: 540, sell: 14, xp: 4, shape: "root", color: "#f28a2e" },
  ble:      { name: "Blé", desc: "Quelques épis dorés, et c’est déjà le début d’un bon pain.", lvl: 4, cost: 6, time: 720, sell: 17, xp: 5, shape: "grain", color: "#e8b94a" },
  fraise:   { name: "Fraise", desc: "Petite, rouge et parfumée. Difficile de ne pas en goûter une en passant.", lvl: 5, cost: 8, time: 900, sell: 24, xp: 6, shape: "berry", color: "#e8414f" },
  basilic:  { name: "Basilic", desc: "Son parfum embaume tout le jardin dès qu’on frôle ses feuilles.", lvl: 6, cost: 10, time: 1080, sell: 28, xp: 7, shape: "herb", color: "#3e9a4b" },
  tomate:   { name: "Tomate", desc: "Gorgée de soleil, elle fait le bonheur des sauces et des salades.", lvl: 7, cost: 12, time: 1350, sell: 36, xp: 8, shape: "round", color: "#e2483d" },
  tournesol:{ name: "Tournesol", desc: "Il suit le soleil toute la journée sans jamais se lasser.", lvl: 8, cost: 28, time: 2700, sell: 80, xp: 16, shape: "flower", color: "#f6c62f", center: "#7a4b2a" },
  myrtille: { name: "Myrtille", desc: "De petites billes bleues qui tachent les doigts.", lvl: 9, cost: 16, time: 1800, sell: 48, xp: 10, shape: "berry", round: true, color: "#5a6fd6" },
  lavande:  { name: "Lavande", desc: "Les abeilles l’adorent, les tisanes aussi.", lvl: 10, cost: 20, time: 2160, sell: 58, xp: 12, shape: "flower", spike: true, color: "#9f7ae0" },
  potiron:  { name: "Potiron", desc: "Il prend son temps, mais quel résultat !", lvl: 11, cost: 35, time: 3600, sell: 110, xp: 20, shape: "big", color: "#f08a24" },
  // Hybrides : découverts dans la Serre
  poivree:  { name: "Laitue poivrée", desc: "Une laitue au cœur vert tendre dont les feuilles froissées se teintent de pourpre sur les bords.", hybrid: true, parents: ["laitue", "basilic"], time: 900, sell: 52, xp: 11, shape: "leafy", color: "#b8e07a", hint: "Une salade qui aurait des envies d’herbes aromatiques…" },
  lune:     { name: "Radis lune", desc: "Un radis nacré, entre lilas et blanc, parsemé de reflets argentés qui scintillent.", hybrid: true, parents: ["radis", "myrtille"], time: 1260, sell: 72, xp: 14, shape: "bulb", color: "#b9a6e8", hint: "Une racine rose qui rêve de bleu…" },
  fraisille: { name: "Fraisille", desc: "Une fraise couleur myrtille, violette et poudrée, deux fois plus sucrée.", hybrid: true, parents: ["fraise", "myrtille"], time: 1620, sell: 96, xp: 18, shape: "berry", color: "#b04fc0", hint: "Deux baies de couleurs différentes…" },
  lilas:    { name: "Soleil lilas", desc: "Un tournesol aux pétales lilas et violets autour d’un cœur doré, le joyau de l’herbier.", hybrid: true, parents: ["lavande", "tournesol"], time: 3000, sell: 205, xp: 34, shape: "flower", color: "#c79bf2", hint: "Deux fleurs, une violette et une géante…" },
  coeur:    { name: "Patate cœur", desc: "De petites pommes de terre rose framboise en forme de cœur, piquetées de points comme une fraise.", hybrid: true, parents: ["patate", "fraise"], time: 1080, sell: 60, xp: 12, shape: "bulb", color: "#e05a7a", hint: "Un tubercule qui rêverait d’être un fruit rouge…" },
  lanterne: { name: "Tomate lanterne", desc: "Des tomates orange doré à côtes, lumineuses comme de petites lanternes suspendues.", hybrid: true, parents: ["tomate", "potiron"], time: 3000, sell: 200, xp: 33, shape: "round", color: "#f59a2a", hint: "Un fruit rouge qui voudrait devenir une citrouille…" },
  azur:     { name: "Épi d’azur", desc: "Des épis aux grains bleu turquoise nacrés, sur des tiges argentées.", hybrid: true, parents: ["ble", "radis"], time: 960, sell: 55, xp: 11, shape: "grain", color: "#3fc4d6", hint: "Une céréale qui aurait croisé une racine croquante…" },
  amethyste: { name: "Carotte améthyste", desc: "Des carottes violet profond, translucides comme une pierre précieuse, aux fanes argentées.", hybrid: true, parents: ["carotte", "lavande"], time: 2160, sell: 140, xp: 24, shape: "root", color: "#9b3fd0", hint: "Une racine orange qui rêve de violet…" },
};
const ORDER = Object.keys(PLANTS);
const HYBRID_BY_PAIR = {};
for (const k of ORDER) { const d = PLANTS[k]; if (d.hybrid) { HYBRID_BY_PAIR[pairKey(...d.parents)] = k; d.cost = Math.round(d.sell * 0.35); } }
function pairKey(a, b) { return [a, b].sort().join("+"); }

/* Progression : une petite nouveauté à chaque niveau, un grand palier tous les 3 niveaux
   (3 : Serre + tuyau, 6 : 2ᵉ fourneau, 9 : arrosoir 30 min, 12 : arroseur automatique, 15 : 3ᵉ fourneau). */
const RECIPES = {
  salade:   { name: "Salade croquante", desc: "Laitue fraîche et radis croquants : simple et efficace.", lvl: 2, price: 25, need: { laitue: 2, radis: 1 }, time: 90, sell: 34, xp: 8, look: "bowl", color: "#93d26b" },
  puree:    { name: "Purée maison", desc: "Onctueuse, avec une noisette de beurre qui fond dessus.", lvl: 3, price: 35, need: { patate: 3 }, time: 120, sell: 45, xp: 9, look: "bowl", color: "#f2dca0" },
  pain:     { name: "Pain de campagne", desc: "Croûte dorée, mie moelleuse : l’odeur attire tout le village.", lvl: 4, price: 50, need: { ble: 3 }, time: 150, sell: 66, xp: 12, look: "bread", color: "#d39a52" },
  soupe:    { name: "Soupe de carottes", desc: "Douce, chaude et très, très orange.", lvl: 5, price: 45, need: { carotte: 2, patate: 1 }, time: 120, sell: 56, xp: 10, look: "bowl", color: "#f28a2e" },
  tarte:    { name: "Tarte aux fraises", desc: "Une pâte sablée et des fraises bien rangées.", lvl: 5, price: 80, need: { fraise: 2, ble: 2 }, time: 200, sell: 108, xp: 16, look: "pie", color: "#e8414f" },
  gnocchis: { name: "Gnocchis roses", desc: "De petits gnocchis roses et fondants, faits avec des patates cœur.", lvl: 6, price: 260, need: { coeur: 3, ble: 1 }, time: 260, sell: 245, xp: 30, look: "bowl", color: "#e98aa0" },
  sauce:    { name: "Sauce tomate", desc: "Mijotée longtemps, avec une feuille de basilic pour finir.", lvl: 7, price: 110, need: { tomate: 2, basilic: 1 }, time: 220, sell: 128, xp: 18, look: "jar", color: "#e2483d" },
  lanterne_soupe: { name: "Soupe lanterne", desc: "Une soupe dorée et parfumée, servie avec une feuille de basilic.", lvl: 7, price: 300, need: { lanterne: 2, basilic: 1 }, time: 300, sell: 470, xp: 40, look: "bowl", color: "#f59a2a" },
  graines:  { name: "Pain aux graines", desc: "Un pain croustillant parsemé de graines de tournesol.", lvl: 8, price: 150, need: { ble: 2, tournesol: 2 }, time: 240, sell: 240, xp: 26, look: "bread", color: "#c08a4a" },
  pizza:    { name: "Pizza du potager", desc: "Pâte dorée, sauce tomate et basilic frais : le repas du jardinier.", lvl: 8, price: 180, need: { ble: 2, tomate: 2, basilic: 1 }, time: 240, sell: 175, xp: 24, look: "pie", color: "#e2483d" },
  muffins:  { name: "Muffins myrtille", desc: "Moelleux, avec des myrtilles qui éclatent sous la dent.", lvl: 9, price: 140, need: { myrtille: 2, ble: 1 }, time: 240, sell: 142, xp: 20, look: "cake", color: "#5a6fd6" },
  smoothie: { name: "Smoothie fraisille", desc: "Rose-violet, frais et plein de vitamines.", lvl: 9, price: 200, need: { fraisille: 2 }, time: 200, sell: 235, xp: 26, look: "cup", color: "#b04fc0" },
  biscuits: { name: "Biscuits à la lavande", desc: "De petits sablés parfumés, à grignoter avec une tisane.", lvl: 10, price: 160, need: { lavande: 1, ble: 2 }, time: 180, sell: 125, xp: 18, look: "cake", color: "#a57be0" },
  tisane:   { name: "Tisane lavande", desc: "Une infusion apaisante pour la fin de journée.", lvl: 10, price: 160, need: { lavande: 2 }, time: 180, sell: 138, xp: 18, look: "cup", color: "#a57be0" },
  veloute:  { name: "Velouté de potiron", desc: "Onctueux et réconfortant, parfait quand il fait frais.", lvl: 11, price: 220, need: { potiron: 1, patate: 1, carotte: 1 }, time: 300, sell: 165, xp: 24, look: "bowl", color: "#f08a24" },
  gateau:   { name: "Gâteau des moissons", desc: "Le chef-d’œuvre des récoltes : doré, fruité et généreux.", lvl: 14, price: 500, need: { azur: 2, amethyste: 1, myrtille: 2 }, time: 600, sell: 720, xp: 60, look: "cake", color: "#ffcf1f" },
};
const RORDER = Object.keys(RECIPES);

const UPG = {
  water: { name: "Arrosoir", steps: [{ cost: 150, lvl: 4 }, { cost: 600, lvl: 7 }, { cost: 2000, lvl: 9 }], values: [5, 8, 15, 30],
           desc: v => `L’eau tient ${v} min dans la terre` },
  basket:{ name: "Panier en osier", steps: [{ cost: 100, lvl: 2 }], values: [0, 1], desc: () => "Débloque le bouton « Tout récolter »" },
  hose:  { name: "Tuyau d’arrosage", steps: [{ cost: 300, lvl: 3 }], values: [0, 1], desc: () => "Débloque le bouton « Tout arroser »" },
  gloves:{ name: "Gants de jardinage", steps: [{ cost: 250, lvl: 4 }], values: [0, 1], desc: () => "Débloque le bouton « Retirer les escargots »" },
  fert:  { name: "Compost maison", steps: [{ cost: 500, lvl: 5 }, { cost: 1800, lvl: 10 }, { cost: 5000, lvl: 13 }], values: [1, 1.15, 1.3, 1.5],
           desc: v => v === 1 ? "Vitesse de pousse normale" : `Les plantes poussent ${Math.round((v - 1) * 100)} % plus vite` },
  stove: { name: "Fourneau", steps: [{ cost: 800, lvl: 6 }, { cost: 5000, lvl: 15 }], values: [1, 2, 3], desc: v => `${v} plat${v > 1 ? "s" : ""} en même temps` },
  auto:  { name: "Arroseur automatique", steps: [{ cost: 8000, lvl: 12 }], values: [0, 1], desc: v => v ? "Tes plantes n’ont plus jamais soif" : "Tes plantes n’auront plus jamais soif" },
};
const PLOT_STEPS = [{ cost: 120, lvl: 3 }, { cost: 350, lvl: 6 }, { cost: 900, lvl: 9 }, { cost: 2000, lvl: 12 }, { cost: 4000, lvl: 15 }, { cost: 7000, lvl: 15 }];
const MAX_PLOTS = 6 + PLOT_STEPS.length;
const LAB_TIME = 90;

const VILLAGERS = [
  { name: "Mme Hérisson", color: "#c49a6c", ear: "#8c6a46", say: ["Pour mon petit-déjeuner, s’il te plaît !", "J’ai des invités ce soir…"] },
  { name: "Papi Blaireau", color: "#9aa3a8", ear: "#5d666b", say: ["Comme au bon vieux temps !", "Ma soupe du dimanche en dépend."] },
  { name: "Lou la Loutre", color: "#b07a4f", ear: "#7c5434", say: ["Pique-nique au bord de l’eau !", "C’est pour un goûter entre amis."] },
  { name: "Pip le Moineau", color: "#d9a066", ear: "#9b6b3c", say: ["Juste un petit en-cas !", "Cuicui, merci d’avance !"] },
  { name: "Tante Grenouille", color: "#7fbf6a", ear: "#4d8a3c", say: ["Pour ma fête de la mare !", "Croâ, j’en rêve depuis hier."] },
  { name: "Basile l’Écureuil", color: "#d07a3c", ear: "#9a5222", say: ["Pour mes réserves d’hiver !", "Je paie bien, promis !"] },
  { name: "Mamie Lapine", color: "#e8d9c8", ear: "#c9a98c", say: ["Pour mon potage du soir, ma belle !", "Rien ne vaut les légumes du jardin."] },
  { name: "Gaston la Taupe", color: "#6e6070", ear: "#4c4150", say: ["J’ai creusé jusqu’ici rien que pour ça !", "Ça me changera des vers de terre."] },
];

