/* ---------------- Conseils de Mamie Lapine (tutoriel intégré) ----------------
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
    text: "Joli panier ! Un bac vide ne doit jamais le rester bien longtemps : touche-le et sème quelque chose. Les radis poussent vite.",
    done: () => tutoF("planted") },
  { id: "water", basic: true, tab: "garden", hl: ".plot.dry, .plot.growing",
    text: "De temps en temps, la terre a soif. Quand une goutte apparaît au-dessus d’un bac, touche-le pour l’arroser : sans eau, rien ne pousse. Tu peux même arroser d’avance.",
    done: () => tutoF("watered"), ok: "C’est noté" },
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
    text: "Oh non, un escargot grignote une de tes plantes ! Touche le bac pour le déloger, sinon elle arrête de pousser.",
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
  { id: "cook", tab: ["garden", "market"], hl: '.tab[data-arg="kitchen"]',
    when: () => S.recipes.length > 0 && !S.stats.cooked,
    text: "Ta recette n’attend plus que toi : file en Cuisine !",
    done: () => tutoF("tab_kitchen") || S.stats.cooked > 0 },
  { id: "cook2", tab: "kitchen",
    when: () => S.recipes.length > 0 && !S.stats.cooked,
    text: "Choisis ta recette, vérifie que tu as les ingrédients, et lance la cuisson. Un plat se vend bien plus cher que les légumes qui le composent.",
    done: () => S.stats.cooked > 0, ok: "Allons-y" },
  { id: "lab", tab: ["garden", "market", "village", "kitchen"], hl: '.tab[data-arg="lab"]',
    when: () => S.level >= 3,
    text: "La Serre est ouverte ! On raconte qu’en croisant deux récoltes, on obtient parfois des graines que personne n’a jamais vues…",
    done: () => tutoF("tab_lab") || (S.discovered || []).length > 0 },
  { id: "lab2", tab: "lab",
    when: () => S.level >= 3 && !(S.discovered || []).length,
    text: "Choisis deux récoltes et laisse-les mûrir ensemble. Certains mélanges donnent une variété hybride : ton herbier se remplira petit à petit.",
    done: () => (S.discovered || []).length > 0, ok: "J’essaie" },
  { id: "deco", tab: "garden", hl: ".deco-edit",
    when: () => typeof decoUnlocked === "function" && DECO_ORDER.some(decoUnlocked),
    text: "Quelle jolie récompense ! Touche « Décorer », juste au-dessus du jardin, pour installer ta décoration.",
    done: () => S.decoSlots.some(Boolean) || !!UI.editDeco },
];
const TUTO_BY = Object.fromEntries(TUTO.map(t => [t.id, t]));

function tutoState() {
  if (!S.tuto) {
    S.tuto = { seen: {}, f: {}, off: false };
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
    if (!t.when || t.when()) return t;
  }
  return null;
}
let tutoKey = "";
function tutoUpdate() {
  const box = document.getElementById("tuto"); if (!box) return;
  const t = tutoCurrent(), show = t && [].concat(t.tab).includes(tab);
  const key = show ? t.id : "";
  if (key !== tutoKey) {
    tutoKey = key;
    box.hidden = !show;
    box.innerHTML = show ? `<div class="tuto-bubble" role="note">
      <img class="tuto-face" src="assets/img/villager-6.webp" alt="">
      <div class="tuto-body"><b>Mamie Lapine</b><p>${t.text}</p>
        <div class="tuto-acts">${t.ok ? `<button class="btn sm" data-act="tutoOk" data-arg="${t.id}">${t.ok}</button>` : ""}<button class="tuto-skip" data-act="tutoOff">Je me débrouille, merci</button></div>
      </div></div>` : "";
    if (show) SFX.play("click");
  }
  // Petite lueur sur l'élément concerné (réappliquée : les bacs sont redessinés).
  const hl = show && t.hl ? document.querySelector(t.hl) : null;
  document.querySelectorAll(".tuto-hl").forEach(el => { if (el !== hl) el.classList.remove("tuto-hl"); });
  if (hl) hl.classList.add("tuto-hl");
}
const TUTO_ACTS = {
  tutoOk(id) { tutoState().seen[id] = true; save(); tutoUpdate(); },
  tutoOff() { tutoState().off = true; save(); tutoUpdate(); toast("Mamie Lapine te laisse faire. Tu peux la rappeler dans les réglages."); },
  tutoReset() { S.tuto = { seen: {}, f: {}, off: false }; closeModal(); tab = "garden"; commit(); toast("Mamie Lapine repasse te voir !"); },
};
// Premiers pas pas encore terminés (le cadeau du jour attend la fin).
function tutoBasicsPending() { const T = tutoState(); return !T.off && TUTO.some(t => t.basic && !T.seen[t.id]); }
