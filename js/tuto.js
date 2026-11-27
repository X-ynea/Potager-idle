/* ---------------- Conseils de Mamie Lapine (tutoriel intégré) ----------------
   Règles : couper Mamie (« Je me débrouille ») = tous les conseils actuels sont terminés ;
   une mise à jour qui ajoute des conseils les présente à tout le monde (ceux qui l'avaient coupée compris) ;
   « Revoir » dans les Paramètres reprend tout depuis le début.
   Mamie Lapine, la voisine, passe au potager et donne ses conseils dans une bulle,
   au fil de ce que fait le joueur. Pas de surcouche : chaque conseil disparaît
   dès que l'action est faite, et le suivant arrive tout seul.
   - Les premiers pas (basic) se suivent dans l'ordre.
   - Les autres conseils arrivent quand la situation se présente (escargot, Serre…). */
const TUTO = [
  // Premiers pas
  { id: "harvest", basic: true, tab: "garden", hl: ".plot.ripe",
    text: "Bonjour ! Moi, c’est Mamie Lapine, j’habite juste à côté. Regarde, tes radis sont mûrs : touche le bac où brille l’étoile pour les cueillir.",
    done: () => S.stats.harvest > 0 },
  { id: "plant", basic: true, tab: "garden", hl: ".plot.empty",
    enter: () => { S.seeds.radis_eclair = cnt(S.seeds, "radis_eclair") + 1; },
    text: "Joli panier ! Tiens, je te donne une graine de radis éclair : il pousse en un clin d’œil. Touche un bac vide pour la semer.",
    done: () => tutoF("eclair") || S.plots.some(p => p.seed === "radis_eclair") },
  { id: "water", basic: true, tab: "garden", hl: ".plot.dry",
    text: "Oh, la terre est toute sèche : regarde la goutte au-dessus du bac. Sans eau, une plante pousse quatre fois moins vite. Touche le bac pour l’arroser !",
    done: () => tutoF("eclair") || S.plots.some(p => p.seed === "radis_eclair" && plotState(p, now()) !== "dry") },
  { id: "grow", basic: true, tab: "garden", hl: ".plot.ripe",
    text: () => `Tu vois ? Une fois arrosé, ça pousse à toute vitesse : l’anneau vert se remplit, l’anneau bleu montre l’eau qui reste. Un arrosage tient ${UPG.water.values[S.upg.water]} minutes, ensuite la goutte revient. Dès que l’étoile brille, cueille ton radis !`,
    done: () => tutoF("eclair") },
  { id: "away", basic: true, tab: "garden",
    text: "Et ne t’en fais pas : ton potager continue de pousser quand tu n’es pas là. Reviens quand tu veux, il t’attendra !",
    ok: "Bon à savoir" },
  { id: "market", basic: true, tab: "garden", hl: '.tab[data-arg="market"]',
    text: "Quand ton panier se remplit, fais un tour au Marché, en bas. On y vend ses récoltes et on y achète des graines.",
    done: () => tutoF("tab_market") },
  { id: "market2", basic: true, tab: "market",
    text: "Voilà le marché ! Les graines sont ici, et tu peux vendre tes récoltes. Mais garde toujours quelques légumes de côté : les voisins passent souvent commander.",
    ok: "Merci, Mamie" },
  // Selon la situation
  { id: "snail", tab: "garden", hl: ".plot.weed",
    when: () => S.plots.some(p => p.weed),
    text: () => PEST().tip,
    done: () => S.stats.weeds > 0 },
  { id: "order", tab: "garden", hl: '.tab[data-arg="village"]',
    when: () => S.orders.length > 0,
    text: "Tiens, quelqu’un frappe à ta porte ! Un voisin attend une commande au Village. Les commandes rapportent bien plus que le marché.",
    done: () => tutoF("tab_village") || S.stats.orders > 0 },
  { id: "order2", tab: "village",
    when: () => S.orders.length > 0,
    text: "Chaque voisin demande quelques récoltes ou un plat. Livre-le quand tu as tout, ou laisse passer s’il en demande trop : un autre viendra.",
    done: () => S.stats.orders > 0, ok: "D’accord" },
  { id: "recipe", tab: ["garden", "market"], hl: '.tab[data-arg="market"]',
    when: () => RORDER.some(r => RECIPES[r].lvl <= S.level) && !S.recipes.length,
    text: "Avec tes légumes, on peut cuisiner de bons petits plats ! Achète ta première recette au Marché, rayon Recettes.",
    done: () => S.recipes.length > 0 },
  { id: "cook", tab: ["garden", "market", "lab"], hl: () => tab === "lab" ? '.atelier-sw [data-arg="kitchen"]' : '.tab[data-arg="atelier"]',
    when: () => S.recipes.length > 0 && !S.stats.cooked,
    text: "Ta recette n’attend plus que toi : file à l’Atelier, côté Cuisine !",
    done: () => tutoF("tab_kitchen") || S.stats.cooked > 0 },
  { id: "cook2", tab: "kitchen",
    when: () => S.recipes.length > 0 && !S.stats.cooked,
    text: "Choisis ta recette, vérifie que tu as les ingrédients, et lance la cuisson. Un plat se vend bien plus cher que les légumes qui le composent.",
    done: () => S.stats.cooked > 0, ok: "Allons-y" },
  { id: "lab", tab: ["garden", "market", "village", "kitchen"], hl: () => tab === "kitchen" ? '.atelier-sw [data-arg="lab"]' : '.tab[data-arg="atelier"]',
    when: () => S.level >= 3,
    text: "La Serre est ouverte, à l’Atelier ! On raconte qu’en croisant deux récoltes, on obtient parfois des graines que personne n’a jamais vues…",
    done: () => tutoF("tab_lab") || (S.discovered || []).length > 0 },
  { id: "lab2", tab: "lab",
    when: () => S.level >= 3 && !(S.discovered || []).length,
    text: "Choisis deux récoltes et laisse-les mûrir ensemble. Certains mélanges donnent une variété hybride : ton herbier se remplira petit à petit.",
    done: () => (S.discovered || []).length > 0, ok: "J’essaie" },
  { id: "deco", tab: "garden", hl: ".deco-edit",
    when: () => typeof decoUnlocked === "function" && DECO_ORDER.some(decoUnlocked),
    text: "Quelle jolie récompense ! Touche « Décorer », juste au-dessus du jardin, pour installer ta décoration.",
    done: () => S.decoSlots.some(Boolean) || !!UI.editDeco },
  // v3 : jouer avec ses amis (à partir du niveau 3, une fois les premiers pas faits ; aussi pour les anciens joueurs)
  { id: "friends", free: true, tab: ["garden", "market", "kitchen", "lab", "village"], hl: '.tab[data-arg="friends"]',
    when: () => tutoFriends() && S.level >= 3,
    text: "Tu as vu le nouvel onglet « Amis », en bas ? Avec tes amis, vous pourrez visiter vos jardins, vous donner un coup d’arrosoir et échanger vos récoltes.",
    done: () => tutoF("tab_friends") },
  { id: "friends2", free: true, tab: "friends", hl: ".fr-code",
    when: () => tutoFriends() && FR.loaded && !tutoFriendCount(),
    text: "Voici ton code ami. Envoie-le à quelqu’un pour qu’il t’ajoute, ou entre le sien dans l’onglet « Ajouter ».",
    done: () => tutoFriendCount() > 0, ok: "Compris" },
  { id: "visit", free: true, tab: "friends", hl: '.fr-act[data-act="frVisit"]',
    when: () => tutoFriends() && tutoFriendCount() > 0,
    text: "Touche la petite pousse pour visiter le jardin de ton ami. Une fois par jour, tu peux l’arroser : ses plantes poussent 20 % plus vite pendant 2 h, et toi tu gagnes un peu d’XP.",
    done: () => tutoF("visited") },
  { id: "trade", free: true, tab: "friends", hl: '.fr-act[data-act="trOpen"]',
    when: () => tutoFriends() && tutoFriendCount() > 0 && tutoF("visited"),
    text: "Une plante qui n’est pas de saison chez toi ? Touche ⇄ pour proposer un échange : des récoltes ou des plats, contre d’autres ou contre des pièces, pour une valeur à peu près égale.",
    done: () => tutoF("trade_opened"), ok: "Bon à savoir" },
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
  // v4 : les Balades, les nouveautés de la Serre et le jardin commun
  { id: "balades", tab: ["garden", "market", "kitchen", "lab", "village", "friends"], hl: '.tab[data-arg="balades"]',
    when: () => S.level >= BALADES_LVL,
    text: "Et si on allait se promener ? Touche le panneau en bois, en bas : ce sont les Balades, de petits jeux pour pêcher, fouiller les buissons ou aider les abeilles.",
    done: () => tutoF("tab_balades") || (S.stats.gamesSet || []).length > 0 },
  { id: "balades2", tab: "balades",
    when: () => S.level >= BALADES_LVL && !(S.stats.gamesSet || []).length,
    text: "Chaque jeu se joue trois fois par jour, et d’autres s’ouvrent quand tu montes de niveau. Tu y trouveras des trouvailles qu’on ne peut pas cultiver : algues, mûres, miel… Ton meilleur score de la semaine s’affiche à côté de celui de tes amis.",
    done: () => (S.stats.gamesSet || []).length > 0, ok: "J’y vais" },
  { id: "wild", tab: ["balades", "garden", "market"],
    when: () => Object.keys(WILD).some(k => cnt(S.wild, k) > 0),
    text: "Quelle belle trouvaille ! Avec ce que tu rapportes de balade, de nouvelles recettes t’attendent au Marché. Et deux nouveaux voisins, Margot la Cane et Firmin le Renard, passeront sûrement t’en commander.",
    ok: "Miam" },
  { id: "hybrids4", tab: "lab", hl: ".herbier",
    when: () => S.level >= 3 && (S.hybrids || []).length > 0 && ["cerise", "poireau_soleil", "pois_sucre"].some(k => !S.hybrids.includes(k)),
    text: "Trois nouvelles variétés poussent en secret dans la Serre : une Courgette cerise, un Poireau soleil et un Pois sucré. Regarde leurs indices dans l’herbier !",
    ok: "Je cherche" },
  { id: "sg", free: true, tab: "friends", hl: ".sg-card",
    when: () => tutoFriends() && tutoFriendCount() > 0 && typeof SG !== "undefined" && !!SG.data && !sgG(),
    text: "Nouveau : le jardin commun ! Crée-le ici et invite jusqu’à trois amis. Les graines y sont gratuites, et vous livrez ensemble deux commandes par jour. Plante au moins trois graines pour recevoir ta part de la récompense.",
    done: () => typeof sgG === "function" && !!sgG(), ok: "Bonne idée" },
  { id: "sg2", free: true, tab: "garden", hl: ".sg-portal",
    when: () => tutoFriends() && typeof sgG === "function" && !!sgG() && !!document.querySelector(".sg-portal"),
    text: "Tu vois le petit portail au-dessus de ton jardin ? Il mène tout droit à votre jardin commun. Là-bas, la bulle en bas de l’écran te permet de dire un mot à ton équipe.",
    done: () => tutoF("sg_opened"), ok: "Compris" },
];
// Conseils des amis : seulement là où les amis sont ouverts, une fois connecté.
const tutoFriends = () => typeof FRIENDS_ON !== "undefined" && FRIENDS_ON && CLOUD.signedIn && !CLOUD.blocked;
const tutoFriendCount = () => FR.list.filter(f => f.direction === "friend").length;
const TUTO_BY = Object.fromEntries(TUTO.map(t => [t.id, t]));

function tutoState() {
  if (!S.tuto) {
    S.tuto = { seen: {}, f: { v3fix: true }, off: false }; // v3fix : partie déjà à jour (pas de réparation 3.0.2)
    // Partie déjà commencée avant le tutoriel : on saute les premiers pas.
    if (S.stats.harvest > 0) TUTO.filter(t => t.basic).forEach(t => { S.tuto.seen[t.id] = true; });
  }
  return S.tuto;
}
const tutoF = k => !!tutoState().f[k];
function tutoFlag(k) { const T = tutoState(); if (!T.f[k]) { T.f[k] = true; } }

// Conseil à montrer maintenant (ou null). Marque au passage ceux déjà accomplis.
function tutoCurrent() {
  const T = tutoState(); if (T.off) return null;
  for (const t of TUTO) {
    if (T.seen[t.id]) continue;
    if (t.done && t.done()) { T.seen[t.id] = true; continue; }
    if (t.basic) return t;                       // premiers pas : dans l'ordre
    if (TUTO.some(b => b.basic && !T.seen[b.id])) return null;
    if (t.free && ![].concat(t.tab).includes(tab)) continue; // conseils des amis : n'attendent pas leur onglet
    if (!t.when || t.when()) return t;
  }
  return null;
}
let tutoKey = "";
function tutoUpdate() {
  const box = document.getElementById("tuto"); if (!box) return;
  const t = tutoCurrent(), show = t && [].concat(t.tab).includes(tab);
  const key = show ? t.id : "";
  if (t && t.enter && !tutoF("enter_" + t.id)) { tutoFlag("enter_" + t.id); t.enter(); save(); render(true); }
  if (key !== tutoKey) {
    tutoKey = key;
    box.hidden = !show;
    box.innerHTML = show ? `<div class="tuto-bubble" role="note">
      <img class="tuto-face" src="assets/img/voisins/villager-6.webp" alt="">
      <div class="tuto-body"><b>Mamie Lapine</b><p>${typeof t.text === "function" ? t.text() : t.text}</p>
        <div class="tuto-acts">${t.ok ? `<button class="btn sm" data-act="tutoOk" data-arg="${t.id}">${t.ok}</button>` : ""}<button class="tuto-skip" data-act="tutoOff">Je me débrouille, merci</button></div>
      </div></div>` : "";
    if (show) SFX.play("click");
  }
  // Petite lueur sur l'élément concerné (réappliquée : les bacs sont redessinés).
  const hl = show && t.hl ? document.querySelector(typeof t.hl === "function" ? t.hl() : t.hl) : null;
  document.querySelectorAll(".tuto-hl").forEach(el => { if (el !== hl) el.classList.remove("tuto-hl"); });
  if (hl) hl.classList.add("tuto-hl");
}
const TUTO_ACTS = {
  tutoOk(id) { tutoState().seen[id] = true; save(); tutoUpdate(); },
  // Couper Mamie Lapine = considérer tous ses conseils actuels comme terminés.
  // Les conseils d'une future mise à jour (nouveaux) s'afficheront quand même.
  tutoOff() { const T = tutoState(); for (const x of TUTO) T.seen[x.id] = true; T.off = false; save(); tutoUpdate(); toast("Mamie Lapine te laisse faire. Tu peux revoir tous ses conseils dans les Paramètres."); },
  // Revoir depuis les Paramètres : tout reprend du début, premiers pas et nouveautés compris.
  tutoReset() { S.tuto = { seen: {}, f: { v3fix: true }, off: false }; closeModal(); tab = "garden"; commit(); toast("Mamie Lapine repasse te voir !"); },
};
// Premiers pas pas encore terminés (le cadeau du jour attend la fin).
function tutoBasicsPending() { const T = tutoState(); return !T.off && TUTO.some(t => t.basic && !T.seen[t.id]); }
