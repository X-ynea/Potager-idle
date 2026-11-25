"use strict";
/* Version de test (publiée dans le dossier /test/) : sauvegarde séparée, pas de synchronisation en ligne,
   et un petit bandeau pour ne pas la confondre avec la version des joueurs. */
const IS_TEST = /\/test\//.test(location.pathname) || new URLSearchParams(location.search).has("test");
// Amis, messages, visites, échanges et objectifs de la semaine (v3) : ouverts à tous les joueurs.
// (Mettre IS_TEST pour réserver de nouveau ces fonctions à la version de test.)
const FRIENDS_ON = true;
if (IS_TEST) addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("is-test");
  const b = document.createElement("div"); b.className = "test-ribbon"; b.textContent = "Version de test";
  document.body.appendChild(b);
});
