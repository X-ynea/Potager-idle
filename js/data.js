"use strict";
/* Données du jeu : plantes, recettes, améliorations, voisins. */
/* ---------------- Data ---------------- */
const PLANTS = {
  // Graine offerte par Mamie Lapine pendant le tutoriel : pousse en quelques secondes, donne un radis.
  radis_eclair: { name: "Radis éclair", desc: "Une graine de Mamie Lapine, qui pousse en un clin d’œil.", lvl: 1, cost: 0, time: 3, sell: 5, xp: 2, shape: "bulb", color: "#ec5b82", tuto: true, img: "radis" },
  radis:    { name: "Radis", desc: "Croquant et un brin piquant. Le premier légume de tout bon potager.", lvl: 1, season: "printemps", cost: 2, time: 180, sell: 5, xp: 2, shape: "bulb", color: "#ec5b82" },
  laitue:   { name: "Laitue", desc: "Tendre et fraîche, elle pousse sans se faire prier.", lvl: 1, season: "printemps", cost: 3, time: 360, sell: 9, xp: 3, shape: "leafy", color: "#a6dc78" },
  patate:   { name: "Pomme de terre", desc: "Elle pousse cachée sous terre et se prête à toutes les recettes.", lvl: 2, season: "automne", cost: 4, time: 480, sell: 11, xp: 3, shape: "bulb", color: "#c9a26b" },
  carotte:  { name: "Carotte", desc: "Elle se cache sous terre : seules ses fanes trahissent sa présence.", lvl: 4, season: "hiver", cost: 5, time: 540, sell: 14, xp: 4, shape: "root", color: "#f28a2e" },
  ble:      { name: "Blé", desc: "Quelques épis dorés, et c’est déjà le début d’un bon pain.", lvl: 5, season: "hiver", cost: 6, time: 720, sell: 17, xp: 5, shape: "grain", color: "#e8b94a" },
  fraise:   { name: "Fraise", desc: "Petite, rouge et parfumée. Difficile de ne pas en goûter une en passant.", lvl: 7, season: "printemps", cost: 8, time: 900, sell: 24, xp: 6, shape: "berry", color: "#e8414f" },
  basilic:  { name: "Basilic", desc: "Son parfum embaume tout le jardin dès qu’on frôle ses feuilles.", lvl: 9, season: "ete", cost: 10, time: 1080, sell: 28, xp: 7, shape: "herb", color: "#3e9a4b" },
  tomate:   { name: "Tomate", desc: "Gorgée de soleil, elle fait le bonheur des sauces et des salades.", lvl: 11, season: "ete", cost: 12, time: 1350, sell: 36, xp: 8, shape: "round", color: "#e2483d" },
  tournesol:{ name: "Tournesol", desc: "Il suit le soleil toute la journée sans jamais se lasser.", lvl: 18, season: "ete", cost: 28, time: 2700, sell: 80, xp: 16, shape: "flower", color: "#f6c62f", center: "#7a4b2a" },
  myrtille: { name: "Myrtille", desc: "De petites billes bleues qui tachent les doigts.", lvl: 13, season: "automne", cost: 16, time: 1800, sell: 48, xp: 10, shape: "berry", round: true, color: "#5a6fd6" },
  lavande:  { name: "Lavande", desc: "Les abeilles l’adorent, les tisanes aussi.", lvl: 15, season: "ete", cost: 20, time: 2160, sell: 58, xp: 12, shape: "flower", spike: true, color: "#9f7ae0" },
  potiron:  { name: "Potiron", desc: "Il prend son temps, mais quel résultat !", lvl: 19, season: "automne", cost: 35, time: 3600, sell: 110, xp: 20, shape: "big", color: "#f08a24" },
  // Plantes de saison : graines vendues seulement pendant leur saison (only), elles se gardent ensuite.
  petitpois: { name: "Petits pois", desc: "De petites billes vertes et sucrées, bien rangées dans leur cosse.", lvl: 3, season: "printemps", only: true, cost: 5, time: 600, sell: 15, xp: 4, shape: "berry", round: true, color: "#7cc24a" },
  courgette: { name: "Courgette", desc: "Elle grandit si vite qu’on la surveille de près tout l’été.", lvl: 6, season: "ete", only: true, cost: 7, time: 780, sell: 19, xp: 5, shape: "round", color: "#4f9a3a" },
  betterave: { name: "Betterave", desc: "Une racine d’un rouge profond, douce et un peu terreuse.", lvl: 8, season: "automne", only: true, cost: 8, time: 900, sell: 23, xp: 6, shape: "bulb", color: "#a3213f" },
  poireau:   { name: "Poireau", desc: "Il brave le froid sans broncher, droit comme un piquet.", lvl: 10, season: "hiver", only: true, cost: 10, time: 1140, sell: 30, xp: 7, shape: "herb", color: "#9cc46a" },
  asperge:   { name: "Asperge", desc: "Les premières pointes vertes qui sortent de terre au printemps.", lvl: 14, season: "printemps", only: true, cost: 18, time: 1980, sell: 52, xp: 11, shape: "grain", color: "#8dbb5a" },
  melon:     { name: "Melon", desc: "Juteux et parfumé, le goût même des vacances.", lvl: 16, season: "ete", only: true, cost: 24, time: 2520, sell: 72, xp: 14, shape: "big", color: "#f2a65a" },
  champignon:{ name: "Champignon des bois", desc: "Il pousse sur une petite souche moussue, à l’ombre du bac.", lvl: 20, season: "automne", only: true, cost: 30, time: 2880, sell: 90, xp: 17, shape: "big", color: "#b98a5a" },
  chou:      { name: "Chou d’hiver", desc: "Un gros chou frisé, croquant même sous la neige.", lvl: 22, season: "hiver", only: true, cost: 34, time: 3300, sell: 100, xp: 19, shape: "leafy", color: "#6fa85a" },
  // Hybrides : découverts dans la Serre
  poivree:  { name: "Laitue poivrée", desc: "Une laitue au cœur vert tendre dont les feuilles froissées se teintent de pourpre sur les bords.", hybrid: true, parents: ["laitue", "basilic"], time: 900, sell: 52, xp: 11, shape: "leafy", color: "#b8e07a", hint: "Une salade qui aurait des envies d’herbes aromatiques…" },
  lune:     { name: "Radis lune", desc: "Un radis nacré, entre lilas et blanc, parsemé de reflets argentés qui scintillent.", hybrid: true, parents: ["radis", "myrtille"], time: 1260, sell: 72, xp: 14, shape: "bulb", color: "#b9a6e8", hint: "Une racine rose qui rêve de bleu…" },
  fraisille: { name: "Fraisille", desc: "Une fraise couleur myrtille, violette et poudrée, deux fois plus sucrée.", hybrid: true, parents: ["fraise", "myrtille"], time: 1620, sell: 96, xp: 18, shape: "berry", color: "#b04fc0", hint: "Deux baies de couleurs différentes…" },
  lilas:    { name: "Soleil lilas", desc: "Un tournesol aux pétales lilas et violets autour d’un cœur doré, le joyau de l’herbier.", hybrid: true, parents: ["lavande", "tournesol"], time: 3000, sell: 205, xp: 34, shape: "flower", color: "#c79bf2", hint: "Deux fleurs, une violette et une géante…" },
  coeur:    { name: "Patate cœur", desc: "De petites pommes de terre rouge fraise en forme de cœur, piquetées de minuscules points dorés.", hybrid: true, parents: ["patate", "fraise"], time: 1080, sell: 60, xp: 12, shape: "bulb", color: "#e05a7a", hint: "Un tubercule qui rêverait d’être un fruit rouge…" },
  lanterne: { name: "Tomate lanterne", desc: "Des tomates orange doré à côtes, lumineuses comme de petites lanternes suspendues.", hybrid: true, parents: ["tomate", "potiron"], time: 3000, sell: 200, xp: 33, shape: "round", color: "#f59a2a", hint: "Un fruit rouge qui voudrait devenir un potiron…" },
  azur:     { name: "Épi d’azur", desc: "Des épis aux grains bleu turquoise nacrés, sur des tiges argentées.", hybrid: true, parents: ["ble", "radis"], time: 960, sell: 55, xp: 11, shape: "grain", color: "#3fc4d6", hint: "Une céréale qui aurait croisé une racine croquante…" },
  amethyste: { name: "Carotte améthyste", desc: "Des carottes violet profond, translucides comme une pierre précieuse, aux fanes argentées.", hybrid: true, parents: ["carotte", "lavande"], time: 2160, sell: 140, xp: 24, shape: "root", color: "#9b3fd0", hint: "Une racine orange qui rêve de violet…" },
  // v3 : un hybride par saison (un parent ne se cultive qu'en saison : il faut garder des récoltes de côté)
  //   été : melon étoilé · automne : champignon nuage · printemps : asperge rubis · hiver : chou de cristal
  etoile:   { name: "Melon étoilé", desc: "De petits melons jaune soleil à côtes, en forme d’étoile, au parfum de miel.", hybrid: true, parents: ["melon", "tournesol"], time: 3000, sell: 230, xp: 38, shape: "big", color: "#f7d046", hint: "Un fruit d’été qui voudrait suivre le soleil…" },
  nuage:    { name: "Champignon nuage", desc: "Des champignons au chapeau bleu ciel, doux comme du coton, qui sentent la myrtille.", hybrid: true, parents: ["champignon", "myrtille"], time: 3060, sell: 215, xp: 35, shape: "big", color: "#8fb3e8", hint: "Un habitant des sous-bois qui rêve de baies bleues…" },
  rubis:    { name: "Asperge rubis", desc: "Des pointes d’asperge rouge rubis, tendres et légèrement sucrées.", hybrid: true, parents: ["asperge", "betterave"], time: 2100, sell: 120, xp: 21, shape: "grain", color: "#c0304f", hint: "Une pousse de printemps jalouse d’une racine d’automne…" },
  cristal:  { name: "Chou de cristal", desc: "Un chou aux feuilles bleutées et translucides, givrées comme du cristal, étonnamment tendres.", hybrid: true, parents: ["chou", "laitue"], time: 3360, sell: 165, xp: 28, shape: "leafy", color: "#a9d4e8", hint: "Un gros chou d’hiver qui envie la tendresse d’une salade…" },
  // v4 : un hybride pour chacune des trois plantes de saison qui n'en avaient pas
  cerise:   { name: "Courgette cerise", desc: "De petites courgettes rondes comme des cerises, rouge vif rayé de vert.", hybrid: true, parents: ["courgette", "tomate"], time: 1560, sell: 88, xp: 17, shape: "round", color: "#d9453a", hint: "Une courgette d’été qui rêve d’être un fruit rouge…" },
  poireau_soleil: { name: "Poireau soleil", desc: "Un poireau au fût orange doré, aux feuilles vert tendre, doux et sucré.", hybrid: true, parents: ["poireau", "carotte"], time: 1260, sell: 70, xp: 14, shape: "herb", color: "#f2a03a", hint: "Un poireau d’hiver jaloux d’une racine orange…" },
  pois_sucre: { name: "Pois sucré", desc: "Des cosses roses pleines de petits pois sucrés, à croquer comme des bonbons.", hybrid: true, parents: ["petitpois", "fraise"], time: 1140, sell: 62, xp: 13, shape: "berry", round: true, color: "#f08aa8", hint: "De petites billes vertes qui voudraient rougir comme un fruit…" },
};
const ORDER = Object.keys(PLANTS).filter(k => !PLANTS[k].tuto); // la plante du tutoriel reste hors des listes
const HYBRID_BY_PAIR = {};
for (const k of ORDER) { const d = PLANTS[k]; if (d.hybrid) { HYBRID_BY_PAIR[pairKey(...d.parents)] = k; d.cost = Math.round(d.sell * 0.35); } }
function pairKey(a, b) { return [a, b].sort().join("+"); }

/* Progression (2.5) : au moins une nouveauté à chaque niveau jusqu'au 30, un grand palier tous les 3 niveaux. */
const RECIPES = {
  salade:   { name: "Salade croquante", desc: "Laitue fraîche et radis croquants : simple et efficace.", lvl: 2, price: 35, need: { laitue: 2, radis: 1 }, time: 90, sell: 34, xp: 12, look: "bowl", color: "#93d26b" },
  puree:    { name: "Purée maison", desc: "Onctueuse, avec une noisette de beurre qui fond dessus.", lvl: 3, price: 55, need: { patate: 3 }, time: 120, sell: 49, xp: 14, look: "bowl", color: "#f2dca0" },
  pain:     { name: "Pain de campagne", desc: "Croûte dorée, mie moelleuse : l’odeur attire tout le village.", lvl: 6, price: 80, need: { ble: 3 }, time: 150, sell: 74, xp: 22, look: "bread", color: "#d39a52" },
  soupe:    { name: "Soupe de carottes", desc: "Douce, chaude et très, très orange.", lvl: 5, price: 65, need: { carotte: 2, patate: 1 }, time: 120, sell: 57, xp: 16, look: "bowl", color: "#f28a2e" },
  tarte:    { name: "Tarte aux fraises", desc: "Une pâte sablée et des fraises bien rangées.", lvl: 7, price: 130, need: { fraise: 2, ble: 2 }, time: 200, sell: 117, xp: 32, look: "pie", color: "#e8414f" },
  gnocchis: { name: "Gnocchis roses", desc: "De petits gnocchis roses et fondants, faits avec des patates cœur.", lvl: 12, price: 325, need: { coeur: 3, ble: 1 }, time: 260, sell: 294, xp: 58, look: "bowl", color: "#e98aa0" },
  sauce:    { name: "Sauce tomate", desc: "Mijotée longtemps, avec une feuille de basilic pour finir.", lvl: 12, price: 155, need: { tomate: 2, basilic: 1 }, time: 220, sell: 142, xp: 34, look: "jar", color: "#e2483d" },
  lanterne_soupe: { name: "Soupe lanterne", desc: "Une soupe dorée et parfumée, servie avec une feuille de basilic.", lvl: 24, price: 695, need: { lanterne: 2, basilic: 1 }, time: 300, sell: 631, xp: 100, look: "bowl", color: "#f59a2a" },
  graines:  { name: "Pain aux graines", desc: "Un pain croustillant parsemé de graines de tournesol.", lvl: 21, price: 295, need: { ble: 2, tournesol: 2 }, time: 240, sell: 270, xp: 59, look: "bread", color: "#c08a4a" },
  pizza:    { name: "Pizza du potager", desc: "Pâte dorée, sauce tomate et basilic frais : le repas du jardinier.", lvl: 16, price: 210, need: { ble: 2, tomate: 2, basilic: 1 }, time: 240, sell: 189, xp: 47, look: "pie", color: "#e2483d" },
  muffins:  { name: "Muffins myrtille", desc: "Moelleux, avec des myrtilles qui éclatent sous la dent.", lvl: 14, price: 175, need: { myrtille: 2, ble: 1 }, time: 240, sell: 161, xp: 37, look: "cake", color: "#5a6fd6" },
  smoothie: { name: "Smoothie fraisille", desc: "Rose-violet, frais et plein de vitamines.", lvl: 18, price: 315, need: { fraisille: 2 }, time: 200, sell: 285, xp: 50, look: "cup", color: "#b04fc0" },
  biscuits: { name: "Biscuits à la lavande", desc: "De petits sablés parfumés, à grignoter avec une tisane.", lvl: 28, price: 145, need: { lavande: 1, ble: 2 }, time: 180, sell: 130, xp: 32, look: "cake", color: "#a57be0" },
  tisane:   { name: "Tisane lavande", desc: "Une infusion apaisante pour la fin de journée.", lvl: 17, price: 180, need: { lavande: 2 }, time: 180, sell: 163, xp: 34, look: "cup", color: "#a57be0" },
  veloute:  { name: "Velouté de potiron", desc: "Onctueux et réconfortant, parfait quand il fait frais.", lvl: 20, price: 210, need: { potiron: 1, patate: 1, carotte: 1 }, time: 300, sell: 192, xp: 40, look: "bowl", color: "#f08a24" },
  pain_azur: { name: "Pain d’azur", desc: "Un pain à la mie bleutée, étonnamment moelleux.", lvl: 8, price: 270, need: { azur: 3 }, time: 240, sell: 247, xp: 47, look: "bread", color: "#3fc4d6" },
  salade_pourpre: { name: "Salade pourpre", desc: "Laitue poivrée et radis croquants : une salade qui pique un peu.", lvl: 10, price: 185, need: { poivree: 2, radis: 2 }, time: 150, sell: 170, xp: 36, look: "bowl", color: "#a3475e" },
  veloute_lune: { name: "Velouté lunaire", desc: "Un velouté nacré qui brille doucement dans le bol.", lvl: 17, price: 275, need: { lune: 2, patate: 2 }, time: 300, sell: 251, xp: 49, look: "bowl", color: "#cfc4f0" },
  sirop_lilas: { name: "Sirop de soleil lilas", desc: "Un sirop parfumé couleur crépuscule.", lvl: 27, price: 760, need: { lilas: 2, lavande: 1 }, time: 300, sell: 689, xp: 109, look: "jar", color: "#c79bf2" },
  puree_amethyste: { name: "Purée améthyste", desc: "Une purée violette et fondante, digne d’un festin royal.", lvl: 23, price: 495, need: { amethyste: 2, patate: 2 }, time: 300, sell: 448, xp: 75, look: "bowl", color: "#9b3fd0" },
  // Recettes de saison
  veloute_pois: { name: "Velouté de petits pois", desc: "Un velouté vert tendre, frais comme un matin d’avril.", lvl: 4, price: 86, need: { petitpois: 3, laitue: 1 }, time: 150, sell: 78, xp: 18, look: "bowl", color: "#8ccf5a" },
  gratin:   { name: "Gratin de courgettes", desc: "Doré sur le dessus, fondant dessous, et une tomate pour la couleur.", lvl: 14, price: 135, need: { courgette: 2, patate: 1, tomate: 1 }, time: 200, sell: 123, xp: 28, look: "pie", color: "#9bc35a" },
  soupe_bette: { name: "Soupe de betterave", desc: "Une soupe rubis qui réchauffe les soirées d’automne.", lvl: 9, price: 92, need: { betterave: 2, patate: 1 }, time: 150, sell: 83, xp: 19, look: "bowl", color: "#b0284f" },
  fondue:   { name: "Fondue de poireaux", desc: "Des poireaux tout doux, sur une tartine bien grillée.", lvl: 11, price: 145, need: { poireau: 3, ble: 1 }, time: 180, sell: 140, xp: 30, look: "bowl", color: "#c9dc8a" },
  tarte_asperge: { name: "Tarte aux asperges", desc: "Une tarte fine où les asperges dessinent un soleil.", lvl: 15, price: 220, need: { asperge: 2, ble: 2 }, time: 240, sell: 200, xp: 42, look: "pie", color: "#9dc46a" },
  salade_melon: { name: "Salade de melon", desc: "Melon, fraises et basilic : l’été dans un bol.", lvl: 19, price: 200, need: { melon: 1, fraise: 1, basilic: 1 }, time: 180, sell: 180, xp: 38, look: "bowl", color: "#f5a05a" },
  tourte:   { name: "Tourte forestière", desc: "Une tourte généreuse aux champignons des bois.", lvl: 25, price: 360, need: { champignon: 2, ble: 2, patate: 1 }, time: 280, sell: 326, xp: 62, look: "pie", color: "#a2774a" },
  potee:    { name: "Potée au chou", desc: "Le grand plat d’hiver qui mijote toute l’après-midi.", lvl: 26, price: 240, need: { chou: 1, carotte: 2, patate: 2 }, time: 300, sell: 218, xp: 45, look: "bowl", color: "#8fb86a" },
  gateau:   { name: "Gâteau des moissons", desc: "Le chef-d’œuvre des récoltes, qui réunit les plus rares variétés du jardin.", lvl: 30, price: 3850, need: { azur: 2, amethyste: 2, lanterne: 2, lilas: 1, myrtille: 3 }, time: 1800, sell: 2566, xp: 290, look: "cake", color: "#ffcf1f" },
  // v3 : une recette par hybride de saison
  tarte_rubis: { name: "Tarte rubis", desc: "Une tarte dorée garnie de pointes rouge rubis, croustillante et fondante.", lvl: 15, price: 445, need: { rubis: 2, ble: 2 }, time: 240, sell: 405, xp: 68, look: "pie", color: "#c0304f" },
  sorbet_etoile: { name: "Sorbet étoilé", desc: "Des boules de sorbet jaune soleil en forme d’étoile, au parfum de miel.", lvl: 19, price: 785, need: { etoile: 2, fraise: 1 }, time: 300, sell: 715, xp: 110, look: "cup", color: "#f7d046" },
  veloute_nuage: { name: "Velouté nuage", desc: "Un velouté bleu pâle, léger comme un nuage, au parfum de sous-bois.", lvl: 21, price: 735, need: { nuage: 2, patate: 2 }, time: 300, sell: 670, xp: 105, look: "bowl", color: "#8fb3e8" },
  // v4 : une recette par nouvel hybride de saison
  tian_cerise: { name: "Tian cerise", desc: "Des rondelles de courgettes cerises rôties au four, parfumées au basilic.", lvl: 13, price: 325, need: { cerise: 2, basilic: 1 }, time: 240, sell: 296, xp: 60, look: "pie", color: "#d9453a" },
  quiche_soleil: { name: "Quiche soleil", desc: "Une quiche dorée aux poireaux soleil, fondante et légèrement sucrée.", lvl: 12, price: 275, need: { poireau_soleil: 2, ble: 2 }, time: 240, sell: 252, xp: 52, look: "pie", color: "#f2a03a" },
  flan_pois: { name: "Flan au pois sucré", desc: "Un petit flan rose et tremblotant, avec une fraise sur le dessus.", lvl: 9, price: 235, need: { pois_sucre: 2, fraise: 1 }, time: 200, sell: 215, xp: 44, look: "cup", color: "#f08aa8" },
  // v4 : recettes avec les ingrédients de balade (WILD, plus bas), qu'on trouve dans les mini-jeux
  tartine_miel: { name: "Tartine au miel", desc: "Une tranche de pain bien dorée, nappée de miel qui coule sur les doigts.", lvl: 5, price: 100, need: { miel: 1, ble: 2 }, time: 120, sell: 92, xp: 22, look: "bread", color: "#f2b632" },
  soupe_cresson: { name: "Soupe de cresson", desc: "Un velouté vert vif, poivré juste ce qu’il faut.", lvl: 6, price: 80, need: { cresson: 2, patate: 1 }, time: 150, sell: 74, xp: 18, look: "bowl", color: "#5fae4a" },
  the_menthe: { name: "Thé à la menthe", desc: "Une tasse fumante de menthe d’eau, fraîche et parfumée.", lvl: 7, price: 110, need: { menthe: 3 }, time: 150, sell: 100, xp: 24, look: "cup", color: "#4fb39a" },
  salade_mer: { name: "Salade de la mer", desc: "Des algues croquantes sur un lit de laitue : un air de bord de mer.", lvl: 9, price: 90, need: { algue: 3, laitue: 1 }, time: 150, sell: 82, xp: 20, look: "bowl", color: "#3f8f6a" },
  pesto_ail: { name: "Pesto d’ail des ours", desc: "Un pesto vert intense, à tartiner ou à mélanger aux pâtes.", lvl: 11, price: 110, need: { ail: 2, basilic: 1 }, time: 180, sell: 98, xp: 24, look: "jar", color: "#6fbf5a" },
  confiture_mure: { name: "Confiture de mûres", desc: "Un pot de confiture noire et brillante, avec une fraise pour la douceur.", lvl: 12, price: 125, need: { mure: 3, fraise: 1 }, time: 200, sell: 112, xp: 27, look: "jar", color: "#4a2a5a" },
  veloute_chataigne: { name: "Velouté de châtaignes", desc: "Doux et onctueux, il sent bon les après-midi d’automne.", lvl: 14, price: 108, need: { chataigne: 2, patate: 1, carotte: 1 }, time: 220, sell: 98, xp: 24, look: "jar", color: "#8a5a3a" },
  gateau_noisette: { name: "Gâteau aux noisettes", desc: "Un gâteau moelleux, croquant de noisettes grillées et parfumé au miel.", lvl: 16, price: 165, need: { noisette: 2, ble: 2, miel: 1 }, time: 240, sell: 150, xp: 36, look: "cake", color: "#b08350" },
  pique_nique: { name: "Grand pique-nique", desc: "Un panier garni de toutes les trouvailles des balades, à partager au bord de l’étang.", lvl: 24, price: 480, need: { miel: 1, algue: 1, cresson: 1, menthe: 1, ail: 1, mure: 1, chataigne: 1, noisette: 1 }, time: 300, sell: 260, xp: 64, look: "pie", color: "#e8a83a" },
  potee_cristal: { name: "Potée de cristal", desc: "Une potée d’hiver aux feuilles bleutées, qui réchauffe jusqu’au bout des doigts.", lvl: 23, price: 585, need: { cristal: 2, carotte: 2 }, time: 300, sell: 530, xp: 85, look: "bowl", color: "#a9d4e8" },
};
const RORDER = Object.keys(RECIPES);

/* v4 : ingrédients de balade. Ils ne se cultivent pas : on les trouve dans les mini-jeux de l'onglet Balades. */
const WILD = {
  algue:     { name: "Algues", desc: "De longues algues vertes et brillantes, repêchées au bord de l’étang.", sell: 16, src: "peche", color: "#3f8f6a", emoji: "🌿" },
  cresson:   { name: "Cresson", desc: "Une botte de cresson poivré, cueillie les pieds dans l’eau fraîche.", sell: 20, src: "peche", color: "#5fae4a", emoji: "🌱" },
  menthe:    { name: "Menthe d’eau", desc: "Ses petites feuilles sentent bon dès qu’on les froisse.", sell: 24, src: "peche", color: "#4fb39a", emoji: "🍃" },
  ail:       { name: "Ail des ours", desc: "De larges feuilles vertes au parfum d’ail, cueillies au printemps dans les sous-bois.", sell: 20, src: "foret", color: "#6fbf5a", emoji: "🧄" },
  chataigne: { name: "Châtaignes", desc: "Bien à l’abri dans leur bogue piquante, elles n’attendent que le feu.", sell: 22, src: "foret", color: "#8a5a3a", emoji: "🌰" },
  mure:      { name: "Mûres", desc: "Des mûres sauvages, noires et sucrées. Gare aux ronces !", sell: 18, src: "foret", color: "#4a2a5a", emoji: "🫐" },
  noisette:  { name: "Noisettes", desc: "Ramassées sous le noisetier, avant que les écureuils ne passent.", sell: 20, src: "foret", color: "#b08350", svg: '<svg viewBox="0 0 40 40"><path d="M20 9c8 0 13 7 13 15s-6 12-13 12S7 32 7 24 12 9 20 9z" fill="#b07a45"/><path d="M11 20c2-5 6-7 9-7s7 2 9 7" stroke="#8a5a2e" stroke-width="1.5" fill="none" opacity=".6"/><path d="M8 15c3-8 21-8 24 0-4 3-20 3-24 0z" fill="#7aa35a"/><path d="M20 4v7" stroke="#6a4a2a" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="15" cy="26" rx="3" ry="5" fill="#fff" opacity=".2"/></svg>' },
  miel:      { name: "Miel", desc: "Un pot de miel doré, butiné sur les fleurs du jardin.", sell: 30, src: "ruche", color: "#f2b632", emoji: "🍯" },
};
const WORDER = Object.keys(WILD);

const UPG = {
  water: { name: "Arrosoir", steps: [{ cost: 150, lvl: 6 }, { cost: 900, lvl: 12 }, { cost: 3000, lvl: 18 }], values: [5, 8, 15, 30],
           desc: v => `L’eau tient ${v} min dans la terre` },
  basket:{ name: "Panier en osier", steps: [{ cost: 100, lvl: 2 }], values: [0, 1], desc: () => "Débloque le bouton « Tout récolter »" },
  hose:  { name: "Tuyau d’arrosage", steps: [{ cost: 300, lvl: 3 }], values: [0, 1], desc: () => "Débloque le bouton « Tout arroser »" },
  gloves:{ name: "Gants de jardinage", steps: [{ cost: 250, lvl: 4 }], values: [0, 1], desc: () => "Débloque le bouton pour libérer d’un coup tous les bacs bloqués (escargots, herbes folles, feuilles, gel)" },
  fert:  { name: "Compost maison", steps: [{ cost: 500, lvl: 9 }, { cost: 2700, lvl: 17 }, { cost: 7500, lvl: 24 }], values: [1, 1.15, 1.3, 1.5],
           desc: v => v === 1 ? "Vitesse de pousse normale" : `Les plantes poussent ${Math.round((v - 1) * 100)} % plus vite` },
  stove: { name: "Fourneau", steps: [{ cost: 800, lvl: 7 }, { cost: 7500, lvl: 21 }], values: [1, 2, 3], desc: v => `${v} plat${v > 1 ? "s" : ""} en même temps` },
  village: { name: "Banc des voisins", img: "decos/deco-bench", steps: [{ cost: 1200, lvl: 11 }, { cost: 6000, lvl: 20 }], values: [3, 4, 5],
           desc: v => `${v} voisins peuvent passer commander en même temps` },
  guard: { name: "Hérisson gardien", img: "decos/deco-f_automne", steps: [{ cost: 15000, lvl: 28 }], values: [0, 1], desc: v => v ? "Plus aucun bac n’est bloqué par les embêtements" : "Plus aucun bac ne sera bloqué par les embêtements (escargots, herbes folles, feuilles, gel)" },
  auto:  { name: "Arroseur automatique", steps: [{ cost: 12000, lvl: 25 }], values: [0, 1], desc: v => v ? "Tes plantes n’ont plus jamais soif" : "Tes plantes n’auront plus jamais soif" },
};
const PLOT_STEPS = [{ cost: 120, lvl: 3 }, { cost: 350, lvl: 8 }, { cost: 1350, lvl: 13 }, { cost: 3000, lvl: 19 }, { cost: 6000, lvl: 25 }, { cost: 10500, lvl: 29 }];
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
  // Voisins de saison : ils ne passent que pendant leur saison.
  { name: "Mlle Hirondelle", season: "printemps", color: "#4a5a8a", ear: "#2e3a66", say: ["Je rentre de voyage, j’ai une faim de loup !", "Le printemps, c’est la saison des pique-niques !"] },
  { name: "Léon le Lézard", season: "ete", color: "#8fbf4a", ear: "#5f8a2c", say: ["Il fait si bon au soleil !", "Un petit quelque chose de frais ?"] },
  { name: "Noisette la Souris", season: "automne", color: "#b89a7a", ear: "#8a6a4c", say: ["Je fais des provisions pour l’hiver !", "Les feuilles tombent, j’ai envie de soupe."] },
  { name: "Edmond l’Ours", season: "hiver", color: "#8a5a3a", ear: "#5e3a22", say: ["Je me suis réveillé exprès pour ça !", "Il me faut des forces pour finir l’hiver."] },
  // v4 : voisins des Balades (ils passent une fois leur jeu ouvert, et demandent volontiers ses plats).
  { name: "Margot la Cane", balade: "peche", likes: ["salade_mer", "soupe_cresson", "the_menthe"], color: "#e8e0c8", ear: "#f2a03a", say: ["Coin ! J’ai nagé jusqu’ici exprès !", "C’est pour le goûter au bord de l’eau."] },
  { name: "Firmin le Renard", balade: "foret", likes: ["confiture_mure", "veloute_chataigne", "gateau_noisette", "tartine_miel", "pesto_ail"], color: "#e07a3a", ear: "#a3521f", say: ["Je reviens de la forêt, j’ai une faim de loup… enfin, de renard !", "Un petit quelque chose pour ma promenade ?"] },
];

