"use strict";
/* Typographie française : espace insécable avant « : ; ! ? » et à l'intérieur des guillemets « ».
   Appliqué à tous les textes affichés, au fur et à mesure qu'ils apparaissent. */
(() => {
  const NBSP = " ", NNBSP = " ";
  const fix = s => s
    .replace(/[  ]+([;!?])/g, NNBSP + "$1")       // fine insécable avant ; ! ?
    .replace(/[  ]+(:)/g, NBSP + "$1")             // insécable avant :
    .replace(/(\d)[ \u00a0]+%/g, "$1" + NNBSP + "%")  // « 25 % » ne se coupe pas
    .replace(/«[  ]*/g, "«" + NBSP)                 // après «
    .replace(/[  ]*»/g, NBSP + "»");                // avant »
  const needs = /[ ][;:!?»]|«[ ]|\d[ \u00a0]%/;
  const walk = root => {
    if (root.nodeType === 3) { if (needs.test(root.nodeValue)) root.nodeValue = fix(root.nodeValue); return; }
    if (root.nodeType !== 1 || root.closest?.("script,style,textarea,input")) return;
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()) {
      if (needs.test(n.nodeValue) && !n.parentElement.closest("script,style,textarea")) n.nodeValue = fix(n.nodeValue);
    }
  };
  const start = () => {
    walk(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "characterData") walk(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start(); else addEventListener("DOMContentLoaded", start);
  // Titres d'attribut (bulles, libellés) : aussi corrigés.
  window.frTypo = fix;
})();
