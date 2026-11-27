"use strict";
/* ---------------- Mamie Lapine : tutoriel ----------------
   Deux sortes de conseils :
   1. Des SCÉNARIOS (premiers pas, cuisine au niveau 2, Serre au niveau 3, amis) : Mamie guide pas à pas,
      le jeu prépare la situation (graine, visiteur, commande, ingrédients…), l'élément à toucher est mis
      en avant, sans rien bloquer : on peut aller ailleurs et revenir à l'étape quand on veut. On ne peut les passer que depuis les Paramètres.
   2. Des CONSEILS ponctuels (escargot, décoration gagnée, courrier…) dans une bulle, sans rien bloquer,
      quand la situation se présente.
   « Revoir » dans les Paramètres reprend tout depuis le début. */

// Petits outils pour les scénarios
const tutoEclair = () => { const i = S.plots.findIndex(p => p.seed === "radis_eclair"); return i < 0 ? [] : `.plot[data-plot="${i}"]`; };
const tutoPlotSel = test => { const i = S.plots.findIndex(test); return i < 0 ? [] : `.plot[data-plot="${i}"]`; };
const tutoGive = (bag, k, n) => { if (cnt(S[bag], k) < n) S[bag][k] = n; };
const tutoMark = () => tutoState().mark || {};
// Un escargot (ou la bête de la saison) sur un bac qui pousse : on en plante un radis si besoin.
function tutoWeed() {
  if (S.plots.some(p => p.weed)) return;
  let q = S.plots.find(p => p.seed && !p.weed && plotState(p, now()) !== "ripe");
  if (!q) { q = S.plots.find(p => !p.seed); if (!q) return; Object.assign(q, { seed: "radis", grown: 1000, waterUntil: now() + 3e5 }); }
  Object.assign(q, { weed: true, weedAt: now(), weedKind: PEST().key, snailTime: 0 });
}
// Tutoriel en cours (premiers pas pas finis, ou un scénario en route) : on garde pour plus tard
// les cœurs des amis et les pastilles de la boîte aux lettres et du portail.
const tutoBusy = () => typeof S !== "undefined" && !!S.tuto && (!!S.tuto.flow || !S.tuto.flows?.start);
// Cuisine et Serre sont réunies dans l'Atelier : l'onglet du bas, puis le bouton en haut de la page.
const tutoTab = (t, then) => tab === t ? then : (t === "kitchen" || t === "lab") ? (tab === "kitchen" || tab === "lab" ? `.atelier-sw [data-arg="${t}"]` : '.tab[data-arg="atelier"]') : `.tab[data-arg="${t}"]`;
const tutoPicker = k => !$("#modal").hidden && document.querySelector(`#modal [data-act="plant"][data-arg="${k}"]`);
// Commande du tutoriel : faisable tout de suite (on la crée si aucune commande en cours ne l'est).
function tutoEnsureOrder() {
  const doable = o => Object.entries(o.items).every(([k, q]) => cnt(itemBag(k), k) >= q);
  if (S.orders.some(doable)) return;
  if (cnt(S.crops, "radis") < 2) S.crops.radis = 2;
  const keep = S.orders, done = S.stats.orders; S.orders = []; S.stats.orders = 0; S.tutoOrder = false;
  const o = genOrder(); S.stats.orders = done; S.orders = [o, ...keep].slice(0, maxOrders());
}

const FLOWS = {
  // Premiers pas : jardin, radis éclair, visiteur, commande, marché, objectifs, saisons.
  start: { when: () => true, steps: [
    { text: "Bonjour ! Moi, c’est Mamie Lapine, j’habite juste à côté. Regarde, tes radis sont mûrs : touche le bac où brille l’étoile pour les cueillir.",
      enter: () => { if (S.plots.some(p => p.seed && plotState(p, now()) === "ripe")) return;
        const p = S.plots.find(p => !p.seed) || S.plots[0]; Object.assign(p, { seed: "radis", grown: PLANTS.radis.time * 1000, waterUntil: now() + 3e5, weed: false }); },
      hl: () => tutoPlotSel(p => p.seed && plotState(p, now()) === "ripe"), done: () => S.stats.harvest > 0 },
    { text: "Joli panier ! Tiens, je te donne une graine de radis éclair : il pousse en un clin d’œil. Touche un bac vide pour la semer.",
      enter: () => { if (!S.plots.some(p => p.seed === "radis_eclair")) tutoGive("seeds", "radis_eclair", 1); },
      hl: () => tutoPicker("radis_eclair") ? '#modal [data-act="plant"][data-arg="radis_eclair"]' : ".plot.empty",
      done: () => S.plots.some(p => p.seed === "radis_eclair") || tutoF("eclair") },
    { text: "Oh, la terre est toute sèche : regarde la goutte au-dessus du bac. Sans eau, une plante pousse quatre fois moins vite. Touche le bac pour l’arroser !",
      hl: () => tutoEclair(), done: () => tutoF("eclair") || S.plots.some(p => p.seed === "radis_eclair" && p.waterUntil > now()) },
    { text: () => `Tu vois ? Une fois arrosé, ça pousse à toute vitesse : l’anneau vert se remplit, l’anneau bleu montre l’eau qui reste. Un arrosage tient ${UPG.water.values[S.upg.water]} minutes. Dès que l’étoile brille, cueille ton radis !`,
      hl: () => tutoEclair(), done: () => tutoF("eclair") },
    { text: () => `Oh, regarde : ${(["libellule", "coccinelle"].includes(VISITOR().name) ? "une " : "un ") + VISITOR().name} ! Les petits visiteurs passent de temps en temps au-dessus du jardin. Touche-le avant qu’il s’envole : il laisse quelques pièces.`,
      enter: () => { tutoState().mark = { b: S.stats.butterflies }; },
      tick: () => { if (!document.querySelector(".butterfly")) spawnButterfly(true); },
      hl: ".butterfly", done: () => S.stats.butterflies > (tutoMark().b ?? 0) },
    { text: () => PEST().tip,
      enter: () => { tutoState().mark = { w: S.stats.weeds || 0 }; tutoWeed(); },
      tick: () => tutoWeed(),
      hl: () => tutoPlotSel(p => p.weed), done: () => (S.stats.weeds || 0) > (tutoMark().w ?? 0) },
    { text: "Tiens, quelqu’un frappe à ta porte ! Un voisin passe une commande au Village. Tu as déjà ce qu’il demande : va la lui livrer, les commandes rapportent bien plus que le marché.",
      enter: () => { tutoEnsureOrder(); tutoState().mark = { o: S.stats.orders }; },
      tick: () => tutoEnsureOrder(),
      hl: () => tutoTab("village", '[data-act="deliver"]:not([disabled])'), done: () => S.stats.orders > (tutoMark().o ?? 0) },
    { text: "Bravo ! Avec tes pièces, achète des graines au Marché. Prends de la laitue : les voisins en demandent souvent.",
      enter: () => { tutoState().mark = { l: cnt(S.seeds, "laitue") }; if (S.coins < 10) S.coins = 10; },
      hl: () => tutoTab("market", msub !== "seeds" ? '[data-act="msub"][data-arg="seeds"]' : UI.sel.seeds !== "laitue" ? '[data-act="sel"][data-arg="seeds:laitue"]' : '[data-act="buySeed"][data-arg="laitue:1"]'),
      done: () => cnt(S.seeds, "laitue") > (tutoMark().l ?? 0) },
    { text: "Maintenant, retourne au Jardin et sème ta laitue dans un bac vide.",
      enter: () => { tutoState().mark = { n: S.plots.filter(p => p.seed === "laitue").length }; },
      hl: () => tutoTab("garden", tutoPicker("laitue") ? '#modal [data-act="plant"][data-arg="laitue"]' : ".plot.empty"),
      done: () => S.plots.filter(p => p.seed === "laitue").length > (tutoMark().n ?? 0) || !cnt(S.seeds, "laitue") },
    { text: "Regarde sous ton jardin : chaque jour, trois petits objectifs t’attendent. Fais-les pour gagner des pièces et de l’XP, et un bonus si tu les finis tous les trois. Il y en a de nouveaux chaque matin !",
      enter: () => { if (document.querySelector('#modal [data-act="plant"]')) closeModal(); },
      hl: () => tutoTab("garden", ".quests:not(.weekly)"), ok: "Compris" },
    { text: "Et là, ce sont les objectifs de la semaine ! Avec tes amis, et avec tous les jardiniers, avancez ensemble. Touche un objectif pour voir ses récompenses : la première réussite de chaque saison donne une déco rare.",
      tick: () => { tutoState().seen.weekly = true; }, // le conseil en bulle n'a plus lieu d'être
      hl: () => tutoTab("garden", ".weekly"), done: () => tab === "garden" && !document.querySelector(".weekly"), ok: "Super" },
    { text: () => `Le potager vit au rythme des saisons : une par semaine, et en ce moment c’est ${SEASONS[season()].name.toLowerCase()}. Les plantes de saison poussent 25 % plus vite, certaines ne se vendent qu’à leur saison, et les petits visiteurs changent aussi. Touche le bandeau pour tout savoir !`,
      enter: () => { delete tutoState().f.season_opened; },
      hl: () => tutoTab("garden", ".season-bar"), done: () => tutoF("season_opened") },
    { text: "Et ne t’en fais pas : ton potager continue de pousser quand tu n’es pas là. Reviens quand tu veux, il t’attendra ! Le jardin est à toi, je repasserai te voir.",
      ok: "Merci, Mamie" },
  ] },
  // Niveau 2 : la cuisine.
  cook: { when: () => S.level >= 2, steps: [
    { text: "Avec tes légumes, on peut cuisiner de bons petits plats ! Apprends ta première recette au Marché, rayon Recettes. Tiens, je t’ai mis de quoi faire une salade.",
      enter: () => { tutoGive("crops", "laitue", 2); tutoGive("crops", "radis", 1); if (S.coins < RECIPES.salade.price) S.coins = RECIPES.salade.price; },
      hl: () => tutoTab("market", msub !== "recipes" ? '[data-act="msub"][data-arg="recipes"]' : UI.sel.recipes !== "salade" ? '[data-act="sel"][data-arg="recipes:salade"]' : '[data-act="buyRecipe"][data-arg="salade"]'),
      done: () => S.recipes.includes("salade") },
    { text: () => tab === "kitchen" ? "Te voilà dans la Cuisine ! Choisis la salade et lance la cuisson." : tab === "lab" ? "Touche « Cuisine », en haut de la page : la Cuisine et la Serre sont toutes les deux ici, à l’Atelier." : "Ta recette n’attend plus que toi ! Touche l’Atelier, en bas : c’est là qu’on cuisine.",
      enter: () => { tutoGive("crops", "laitue", 2); tutoGive("crops", "radis", 1); tutoState().mark = { c: S.stats.cooked || 0 }; },
      hl: () => tutoTab("kitchen", UI.sel.kitchen && UI.sel.kitchen !== "salade" ? '[data-act="sel"][data-arg="kitchen:salade"]' : '[data-act="cook"][data-arg="salade"]'),
      done: () => S.cooking.some(c => c.r === "salade") || (S.stats.cooked || 0) > (tutoMark().c ?? 0) },
    { text: "Pendant que ça mijote, tu peux faire autre chose. Un plat se vend bien plus cher que ses légumes, et les voisins en commandent souvent !",
      ok: "Allons-y" },
  ] },
  // Niveau 3 : la Serre.
  lab: { when: () => S.level >= 3, steps: [
    { text: () => (tab === "kitchen" ? "La Serre est ouverte ! Touche « Serre », juste en haut : elle est ici, à côté de la Cuisine." : "La Serre est ouverte ! Elle s’est installée à l’Atelier, à côté de la Cuisine : touche l’Atelier, en bas, puis « Serre » en haut de la page.") + " On raconte qu’en croisant deux récoltes, on obtient parfois des graines que personne n’a jamais vues…",
      enter: () => { tutoGive("crops", "radis", 1); tutoGive("crops", "laitue", 1); },
      hl: () => tutoTab("lab", []), done: () => tab === "lab" },
    { text: "Choisis deux récoltes à croiser, par exemple un radis et une laitue, puis lance le croisement.",
      enter: () => { tutoGive("crops", "radis", 1); tutoGive("crops", "laitue", 1); tutoState().mark = { x: S.stats.crosses || 0 }; },
      hl: () => tutoTab("lab", !labSel.includes("radis") ? '[data-act="labPick"][data-arg="radis"]' : !labSel.includes("laitue") ? '[data-act="labPick"][data-arg="laitue"]' : '[data-act="labStart"]'),
      done: () => !!S.lab || (S.stats.crosses || 0) > (tutoMark().x ?? 0) },
    { text: "Le croisement prend un petit moment. Certains mélanges donnent une variété hybride : elle rejoint alors ton herbier, juste en dessous. Essaie plein de mélanges !",
      ok: "J’ai hâte" },
  ] },
  // Les amis (une fois connecté, à partir du niveau 3).
  friends: { when: () => tutoFriends() && FR.loaded, steps: [
    { text: "Tu as vu l’onglet « Amis », en bas ? Avec tes amis, vous pourrez visiter vos jardins, vous donner un coup d’arrosoir et échanger vos récoltes.",
      hl: '.tab[data-arg="friends"]', done: () => tab === "friends" },
    { text: "Voici ton code ami. Envoie-le à quelqu’un pour qu’il puisse t’ajouter en ami.",
      enter: () => { FR.tab = "friends"; }, hl: () => tutoTab("friends", ".fr-code"), ok: "Compris" },
    { text: "Tu connais quelqu’un qui joue ? Va dans « Ajouter » : tu pourras chercher son code ami ou le début de son pseudo.",
      hl: () => tutoTab("friends", '[data-act="frTab"][data-arg="add"]'), done: () => FR.tab === "add" },
    { text: "Tape son code ou son pseudo, touche « Chercher », puis « Ajouter » à côté de son nom : il recevra ta demande. Tu peux aussi le faire plus tard.",
      hl: () => tutoTab("friends", FR.tab !== "add" ? '[data-act="frTab"][data-arg="add"]' : [".fr-search", '[data-act="frAdd"]']),
      done: () => tutoF("friend_request") || tutoFriendCount() > 0, ok: "Plus tard" },
  ] },
  // v4 : les Balades (niveau 4) — on joue une vraie partie.
  balades: { when: () => S.level >= BALADES_LVL, steps: [
    { text: "Et si on allait se promener ? Touche le panneau en bois, en bas : ce sont les Balades, de petits jeux pour pêcher, fouiller les buissons ou aider les abeilles.",
      hl: () => tutoTab("balades", []), done: () => tab === "balades" },
    { text: () => `Commençons par ${GAMES[tutoGame()]?.name.toLowerCase() || "un jeu"} ! Touche « Jouer » : je t’explique les règles, et c’est parti.`,
      enter: () => { delete tutoState().f.game_end; },
      hl: () => tutoTab("balades", `[data-act="gamePlay"][data-arg="${tutoGame()}"]`),
      done: () => !!document.getElementById("game") || tutoF("game_end") || !tutoGame() },
    { text: "Amuse-toi bien !", // caché pendant la partie (le jeu est au-dessus) ; passe dès qu'on revient
      done: () => !document.getElementById("game") },
    { text: () => (tutoF("game_end") ? "Bravo, jolie balade ! " : "") + "Les balades rapportent des trouvailles qu’on ne peut pas cultiver : algues, cresson, mûres, châtaignes, miel… Elles rejoignent ton inventaire, et tu peux les vendre ou les échanger avec tes amis.",
      ok: "Super" },
    { text: "Avec tes trouvailles, de nouvelles recettes t’attendent au Marché, rayon Recettes. Et deux nouveaux voisins, Margot la Cane et Firmin le Renard, passeront t’en commander !",
      ok: "Miam" },
    { text: "Chaque jeu se joue trois fois par jour : les petits ronds montrent les parties qui restent. D’autres jeux s’ouvrent quand tu montes de niveau. Et la coupe affiche ton meilleur score de la semaine, à côté de celui de tes amis.",
      hl: () => tutoTab("balades", ".game-list > .game-card:first-child .g-foot"), ok: "J’y retourne" },
  ] },
  // v4 : le jardin commun (connecté, avec au moins un ami).
  shared: { when: () => S.level >= SG_LVL && !!tutoState().flows.friends && tutoFriends() && FR.loaded && tutoFriendCount() > 0 && typeof SG !== "undefined" && !!SG.data, steps: [
    { text: "Nouveau : le jardin commun ! Un petit potager à cultiver avec trois amis au plus. Va voir dans l’onglet Amis.",
      hl: () => tutoTab("friends", []), done: () => tab === "friends" },
    { text: () => sgG() ? "Te voilà membre d’un jardin commun : touche sa carte pour y entrer." : "Touche la carte « Jardin commun » pour le créer. Si un ami t’a déjà invité, tu peux aussi accepter son invitation juste en dessous.",
      hl: () => tutoTab("friends", sgG() ? ".sg-card.open" : [".sg-card.open", ".sg-inv"]),
      done: () => !$("#modal").hidden && (modalView === viewSG || modalView === viewSGNew) },
    { text: "Donne un nom à votre jardin et choisis jusqu’à trois amis à inviter : ils recevront ton invitation dans leur boîte aux lettres. Tu peux aussi le faire plus tard.",
      done: () => !!sgG() || modalView === viewSG, ok: "Plus tard" },
    { text: "Ici, tout le monde plante, arrose et récolte. Les graines sont gratuites (huit par jour chacun), et les récoltes vont dans le panier commun. Chaque jour, livrez ensemble deux commandes : si tu as planté au moins trois graines depuis la précédente, tu reçois ta part de la récompense.",
      done: () => !sgG(), ok: "Compris" },
    { text: "La bulle en bas de l’écran ouvre la petite discussion : des messages tout prêts pour encourager ton équipe. Et de retour chez toi, le petit portail au-dessus de ton jardin te ramène ici en un toucher.",
      hl: ".sg-chat-fab", home: null, done: () => !sgG(), ok: "À bientôt" },
  ] },
};
const FLOW_ORDER = ["start", "cook", "friends", "lab", "balades", "shared"];
// Ce qui ouvre plus tard : à la fin de chaque scénario, si rien d'autre n'attend, Mamie donne rendez-vous.
const tutoNext = () => [[2, "la Cuisine"], [3, "la Serre"], [BALADES_LVL, "les Balades"], ...(tutoFriends() ? [[SG_LVL, "le jardin commun"]] : [])].find(([l]) => l > S.level);
const tutoOtherWaiting = () => { const T = tutoState(); return FLOW_ORDER.some(k => k !== T.flow && !T.flows[k] && FLOWS[k].when()); };
for (const k of FLOW_ORDER) FLOWS[k].steps.push({
  text: () => { const n = tutoNext(); return `C’est tout pour l’instant ! Je repasserai au niveau ${n[0]} pour te montrer ${n[1]}. D’ici là, profite bien de ton potager.`; },
  done: () => !tutoNext() || tutoOtherWaiting(), ok: "À bientôt, Mamie" });
// Balades : le premier jeu ouvert qui a encore des parties aujourd'hui.
const tutoGame = () => typeof GORDER === "undefined" ? null : GORDER.find(id => !GAMES[id].soon && !gameLocked(id) && playsLeft(id) > 0) || null;

// Conseils ponctuels (bulle, rien n'est bloqué).
const TUTO = [
  { id: "visitor", tab: "garden", hl: ".butterfly",
    when: () => !S.stats.butterflies && !!document.querySelector(".butterfly"),
    text: () => `Un petit visiteur passe au-dessus du jardin ! Touche-le avant qu’il s’envole : il laisse quelques pièces.`,
    done: () => S.stats.butterflies > 0 },
  { id: "snail", tab: "garden", hl: ".plot.weed",
    when: () => S.plots.some(p => p.weed),
    text: () => PEST().tip,
    done: () => S.stats.weeds > 0 },
  { id: "deco", tab: "garden", hl: ".deco-edit",
    when: () => typeof decoUnlocked === "function" && DECO_ORDER.some(decoUnlocked),
    text: "Quelle jolie récompense ! Touche « Décorer », juste au-dessus du jardin, pour installer ta décoration.",
    done: () => S.decoSlots.some(Boolean) || !!UI.editDeco },
  { id: "visit", free: true, tab: "friends", hl: '.fr-act[data-act="frVisit"]',
    when: () => tutoFriends() && tutoFriendCount() > 0 && !visitOpen(),
    text: "Touche la petite pousse pour aller voir le jardin de ton ami.",
    done: () => tutoF("visited") },
  { id: "vwater", free: true, tab: "friends", hl: '[data-act="visitWater"]',
    when: () => tutoFriends() && visitOpen() && !!document.querySelector('#modal [data-act="visitWater"]'),
    text: "Te voilà chez ton ami ! Une fois par jour, tu peux arroser son jardin : ses plantes poussent 20 % plus vite pendant 2 h, et toi tu gagnes un peu d’XP.",
    ok: "D’accord" },
  { id: "like", free: true, tab: "friends", hl: '[data-act="visitLike"]',
    when: () => tutoFriends() && visitOpen() && !!document.querySelector('#modal [data-act="visitLike"]'),
    text: "Touche le cœur pour dire à ton ami que tu aimes son jardin : il verra une pluie de cœurs ! Un cœur par ami et par semaine.",
    ok: "C’est mignon" },
  { id: "trade", free: true, tab: "friends", hl: '#modal .tr-btn[data-act="trOpen"]',
    when: () => tutoFriends() && visitOpen() && !!document.querySelector('#modal .tr-btn[data-act="trOpen"]'),
    text: "Une plante qui n’est pas de saison chez toi ? Touche « Échanger » pour lui proposer des récoltes ou des plats, contre d’autres ou contre des pièces. Tu peux aussi le faire depuis ta liste d’amis, avec la petite flèche ⇄.",
    done: () => tutoF("trade_opened"), ok: "Bon à savoir" },
  { id: "messages", free: true, tab: "friends", hl: '.fr-chat-btn',
    when: () => tutoFriends() && tutoFriendCount() > 0 && !visitOpen() && !!tutoState().seen.trade,
    text: "Et pour discuter, touche la bulle à côté de ton ami : vous pouvez vous écrire des petits messages. Une pastille rouge s’affiche quand il t’a répondu.",
    ok: "Compris" },
  { id: "watered", free: true, tab: "garden", hl: ".fw-line",
    when: () => tutoFriends() && fwActive(now()).some(w => !w.mine),
    text: "Un ami est passé arroser ton jardin ! Tant que le compteur tourne, sous « L’eau tient… », tes plantes poussent 20 % plus vite.",
    ok: "Merci !" },
  { id: "weekly", free: true, tab: "garden", hl: ".weekly",
    when: () => tutoFriends() && typeof goalsOn === "function" && goalsOn() && S.level >= 3 && !!document.querySelector(".weekly"),
    text: "Nouveau : les objectifs de la semaine ! Avec tes amis, et avec tous les jardiniers, avancez ensemble. Touche un objectif pour voir ses récompenses : la première réussite de chaque saison donne une déco rare.",
    ok: "Super" },
  { id: "hybrids3", free: true, tab: "lab", hl: ".herbier",
    when: () => S.level >= 3 && (S.hybrids || []).length > 0 && ["etoile", "nuage", "rubis", "cristal"].some(k => !S.hybrids.includes(k)),
    text: "Quatre nouvelles variétés se cachent dans la Serre, une par saison ! Il faut garder des récoltes de saison de côté pour les croiser. Regarde leurs indices dans l’herbier.",
    ok: "J’y vais" },
  { id: "mail", free: true, tab: "garden", hl: ".mailbox",
    when: () => tutoFriends() && mailCount() > 0,
    text: "Tu as du courrier ! Touche la boîte aux lettres du jardin : tu y trouveras les échanges proposés par tes amis et les dernières nouvelles.",
    done: () => tutoF("mail_opened") },
];
// Conseils des amis : seulement là où les amis sont ouverts, une fois connecté.
const tutoFriends = () => typeof FRIENDS_ON !== "undefined" && FRIENDS_ON && CLOUD.signedIn && !CLOUD.blocked;
const tutoFriendCount = () => FR.list.filter(f => f.direction === "friend").length;
const TUTO_BY = Object.fromEntries(TUTO.map(t => [t.id, t]));

function tutoState() {
  if (!S.tuto) S.tuto = { seen: {}, f: { v3fix: true }, off: false, flows: {} };
  const T = S.tuto;
  if (!T.flows) {
    // Parties d'avant les scénarios : ce qui a déjà été fait n'est pas refait.
    T.flows = {}; const seen = T.seen || {};
    if (S.stats.harvest > 0 || seen.harvest) T.flows.start = true;
    if (S.recipes.length || seen.recipe || seen.cook) T.flows.cook = true;
    if ((S.discovered || []).length || S.hybrids.length || seen.lab || seen.lab2) T.flows.lab = true;
    if (seen.friends || seen.friends2 || seen.addfriend) T.flows.friends = true;
  }
  // Joueurs de test qui ont déjà vu les conseils v4 en bulle : pas de scénario en double.
  if (T.flows.balades === undefined && T.seen?.balades2) T.flows.balades = true;
  if (T.flows.shared === undefined && T.seen?.sg2) T.flows.shared = true;
  return T;
}
const tutoF = k => !!tutoState().f[k];
function tutoFlag(k) { const T = tutoState(); if (!T.f[k]) { T.f[k] = true; } }

/* ---------- Scénarios ---------- */
const tutoLocked = () => !!tutoState().flow;
function flowStep() {
  const T = tutoState();
  if (!T.flow) {
    // Un scénario démarre quand rien d'autre n'est ouvert (fenêtre de niveau, connexion…).
    if (!$("#modal").hidden || LEVEL_QUEUE.length || document.getElementById("gate")) return null;
    const next = FLOW_ORDER.find(k => !T.flows[k] && FLOWS[k].when());
    if (!next) return null;
    T.flow = next; T.step = 0; T.entered = ""; save();
  }
  for (let guard = 0; guard < 20; guard++) {
    if (!T.flow || !FLOWS[T.flow]) return null; // terminé entre-temps (render → tutoUpdate imbriqué)
    const st = FLOWS[T.flow].steps[T.step];
    if (!st) { T.flows[T.flow] = true; T.flow = null; T.mark = null; save(); render(true); return null; }
    const key = T.flow + ":" + T.step;
    if (T.entered !== key) { T.entered = key; st.enter?.(); save(); render(true); }
    if (st.done && st.done()) { T.step++; continue; }
    return st;
  }
  return null;
}
// Éléments à toucher : un sélecteur, une liste ou une fonction. Une fenêtre ouverte qui ne contient
// pas l'élément (fenêtre de niveau, fiche…) reste utilisable normalement.
function tutoTargets(st) {
  const sels = st && st.hl ? [].concat(typeof st.hl === "function" ? st.hl() : st.hl).filter(Boolean) : [];
  let els = sels.flatMap(q => [...document.querySelectorAll(q)]);
  if (document.getElementById("game")) return { els: [], free: true }; // une partie des Balades : le jeu reste jouable
  const modalOpen = !$("#modal").hidden;
  if (modalOpen) { const inM = els.filter(e => e.closest("#modal")); return { els: inM, free: !inM.length }; }
  // Étape d'un scénario dont l'élément n'est pas sur cet onglet (on est allé ailleurs) : on allume l'onglet
  // qui y ramène (le Jardin, sauf si l'étape dit autre chose avec « home » ; home: null = rien).
  const home = st && !st.id && st.hl && !els.length ? (st.home === undefined ? "garden" : st.home) : null;
  if (home && tab !== home) els = [...document.querySelectorAll(`.tab[data-arg="${home === "kitchen" || home === "lab" ? "atelier" : home}"]`)];
  return { els, free: false };
}
let TUTO_NOW = { st: null, els: [], free: false, float: false };

/* ---------- Affichage ---------- */
let tutoKey = "";
function bubbleHTML(t, locked) {
  return `<div class="tuto-bubble${locked ? " locked" : ""}" role="note">
      <img class="tuto-face" src="assets/img/voisins/villager-6.webp" alt="">
      <div class="tuto-body"><b>Mamie Lapine</b><p>${typeof t.text === "function" ? t.text() : t.text}</p>
        ${t.ok ? `<div class="tuto-acts"><button class="btn sm" data-act="tutoOk" data-arg="${locked ? "flow" : t.id}">${t.ok}</button></div>` : ""}
      </div></div>`;
}
function tutoUpdate() {
  const box = document.getElementById("tuto"); if (!box) return;
  const st = flowStep();
  let t = null, show = false, key = "";
  if (st) { t = st; show = true; key = "flow:" + tutoState().flow + ":" + tutoState().step; st.tick?.(); }
  else { t = tutoCurrent(); show = !!t && [].concat(t.tab).includes(tab); key = show ? t.id : ""; }
  if (show && typeof t.text === "function") key += ":" + tab; // texte qui dépend de l'onglet : redessiné en changeant d'onglet
  const float = !!st || (show && !$("#modal").hidden); // conseil dans une fenêtre (visite d'un ami) : bulle par-dessus
  document.body.classList.toggle("tuto-lock", !!st);
  box.classList.toggle("locked", float);
  if (key !== tutoKey) {
    tutoKey = key;
    box.hidden = !show;
    box.innerHTML = show ? bubbleHTML(t, !!st) : "";
    if (show) SFX.play("click");
    if (st) setTimeout(() => { const e = TUTO_NOW.els[0]; if (e && !e.closest(".nav, nav, .tabs") && e.scrollIntoView) e.scrollIntoView({ block: "center", behavior: "smooth" }); }, 120);
  }
  const { els, free } = show ? tutoTargets(t) : { els: [], free: false };
  TUTO_NOW = { st, els, free, float };
  document.querySelectorAll(".tuto-hl").forEach(el => { if (!els.includes(el)) el.classList.remove("tuto-hl"); });
  els.forEach(el => el.classList.add("tuto-hl"));
  tutoDim();
}
// Plus de voile sombre : on peut toucher tout l'écran. La bulle se place seulement en haut ou en bas,
// loin de l'élément mis en avant (en haut quand une fenêtre est ouverte, pour ne pas en cacher les boutons).
function tutoDim() {
  document.getElementById("tuto-dim")?.remove();
  const { els, free, float } = TUTO_NOW, box = document.getElementById("tuto");
  if (!float || !box) return;
  // La bulle ne doit pas cacher ce qu'il faut toucher, surtout le dernier élément (l'action suivante,
  // ex. « Ajouter » sous la recherche) : on regarde ce qu'elle couvrirait en haut et en bas.
  const rs = free ? [] : els.map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
  if (!rs.length) { box.classList.remove("at-bottom"); return; }
  const bh = box.firstElementChild?.offsetHeight || 160, H = innerHeight, nav = document.querySelector(".nav, nav, .tabs")?.offsetHeight || 80;
  const topEnd = 74 + bh + 8, botStart = H - nav - 14 - bh - 8;
  const hitTop = r => r.top < topEnd && r.bottom > 74, hitBot = r => r.bottom > botStart && r.top < H - nav;
  const last = rs[rs.length - 1];
  let bottom = rs.every(r => r.top + r.height / 2 < H * .5);
  if (bottom && hitBot(last) && !hitTop(last)) bottom = false;
  else if (!bottom && hitTop(last) && !hitBot(last)) bottom = true;
  box.classList.toggle("at-bottom", bottom);
}
addEventListener("scroll", () => { if (TUTO_NOW.float) tutoDim(); }, { passive: true });
addEventListener("resize", () => { if (TUTO_NOW.float) tutoDim(); });
setInterval(() => { if (TUTO_NOW.st) { tutoUpdate(); } }, 250); // suit les bacs redessinés et le papillon qui bouge
// Pendant un scénario, rien n'est bloqué : si on va ailleurs, la bulle reste sur la même étape
// et l'élément à toucher (ou l'onglet qui y mène) reste mis en avant.

/* ---------- Conseils ponctuels ---------- */
function tutoCurrent() {
  const T = tutoState(); if (T.off || T.flow || !T.flows.start) return null;
  if (FLOW_ORDER.some(k => !T.flows[k] && FLOWS[k].when())) return null; // un scénario attend (fenêtre ouverte…) : pas de bulle en plus
  for (const t of TUTO) {
    if (T.seen[t.id]) continue;
    if (t.done && t.done()) { T.seen[t.id] = true; continue; }
    if (t.free && ![].concat(t.tab).includes(tab)) continue;
    if (!t.when || t.when()) return t;
  }
  return null;
}
const TUTO_ACTS = {
  tutoOk(id) {
    const T = tutoState();
    if (id === "flow") { if (T.flow) { T.step++; save(); } }
    else T.seen[id] = true;
    save(); tutoUpdate();
  },
  // Passer le tutoriel (Paramètres) : scénarios et conseils actuels terminés.
  tutoSkip() { const T = tutoState(); for (const x of TUTO) T.seen[x.id] = true; for (const k of FLOW_ORDER) T.flows[k] = true; T.flow = null; T.off = false; save(); closeModal(); tutoUpdate(); render(true); toast("Mamie Lapine te laisse faire. Tu peux revoir ses conseils dans les Paramètres."); },
  tutoOff() { TUTO_ACTS.tutoSkip(); },
  // Revoir depuis les Paramètres : tout reprend du début.
  tutoReset() { S.tuto = { seen: {}, f: { v3fix: true }, off: false, flows: {} }; closeModal(); tab = "garden"; commit(); toast("Mamie Lapine repasse te voir !"); },
};
// Le cadeau du jour attend la fin des premiers pas.
function tutoBasicsPending() { const T = tutoState(); return !!T.flow || !T.flows.start; }
