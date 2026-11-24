"use strict";
/* Comptes en ligne (Supabase + connexion Discord).
   Tant que ces deux valeurs sont vides, le jeu fonctionne sans compte et la section « Compte » est masquée.
   Voir docs/comptes.md pour la mise en place. La clé « anon » est publique : elle est faite pour être dans le jeu. */
const CLOUD_CONFIG = {
  url: "",      // ex. "https://abcdefgh.supabase.co"
  anonKey: "",  // clé « anon public » du projet
};
