"use strict";
/* Version de test (publiée dans le dossier /test/) : sauvegarde séparée, pas de synchronisation en ligne,
   et un petit bandeau pour ne pas la confondre avec la version des joueurs. */
const IS_TEST = /\/test\//.test(location.pathname) || new URLSearchParams(location.search).has("test");
// Amis et messages : seulement sur la version de test pour l'instant (fin de la v3).
const FRIENDS_ON = IS_TEST;
if (IS_TEST) addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("is-test");
  const b = document.createElement("div"); b.className = "test-ribbon"; b.textContent = "Version de test";
  document.body.appendChild(b);
});
