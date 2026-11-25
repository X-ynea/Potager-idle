# Version 3 : jouer avec ses amis

Plan validé le 24 novembre 2026. Tout se prépare sur la branche `test` (version publiée dans `/test/`).

## Principe

Seul le propriétaire écrit dans sa sauvegarde. Les amis :
- **lisent** une partie de la sauvegarde grâce à une fonction serveur (amis uniquement, sans blocage) ;
- **agissent** en déposant quelque chose dans une **boîte de réception** sur le serveur. Le jeu du propriétaire l'applique à sa prochaine synchronisation et le marque comme reçu (chaque envoi a un numéro, jamais appliqué deux fois).

Les jours changent à minuit, heure de Paris, et sont comptés par le serveur.

## Étape 1 : visite et herbier

- Bouton **« Visiter »** sur la ligne d'un ami.
- On voit son **jardin** (bacs, plantes et leur avancement, décos, saison) et son **herbier** (plantes découvertes, dorées).
- Aucune quantité d'inventaire, pas de pièces.
- Lecture seule : rien n'est modifiable.
- Le jardin continue de pousser pendant la visite, calculé à partir de sa dernière sauvegarde. Rien n'est enregistré.
- **Anti-spoil** : un hybride que tu n'as pas découvert reste « ??? » chez lui aussi, avec seulement la mention qu'il le connaît.
- Fonction serveur : `docs/visites.sql` (`friend_garden`).
- ✅ Fait (v2.16), en plein écran.

## Étape 2 : arrosage et boîte aux lettres

- Bouton **Arroser** dans la visite.
- Effet : tous ses bacs sont arrosés et ses plantes poussent **+20 % pendant 2 h**. Le bonus ne s'additionne pas ; un 2ᵉ arrosage remet le compteur à 2 h.
- Le bonus s'additionne aux autres (+25 % de saison, compost).
- Limites par jour :
  - un jardin reçoit **2 arrosages d'amis** au plus. Au-delà : arrosoir grisé, « Des amis sont déjà passés par là ! » ;
  - un joueur arrose **2 jardins d'amis** au plus. Au-delà : arrosoir grisé, « Tu as déjà bien arrosé chez tes amis aujourd'hui, reviens demain ! » ;
  - une même personne arrose un même jardin une fois par jour au plus.
- Affichage : rien sur les bacs. Sous « L'eau tient x min » (ou « Arroseur automatique actif »), une ligne `[pp] a arrosé · +20 % · 1 h 42` avec le temps qui diminue. Une 2ᵉ pp se place à côté de la première, en la chevauchant un peu.
- Récompense de celui qui arrose : un peu d'XP.
- **Boîte aux lettres** : élément fixe de l'écran d'accueil, hors des emplacements de déco, avec drapeau et pastille. Courrier en trois parties : Reçus, Envoyés, Nouvelles.
- Nouvelles images (boîte aux lettres, arrosoir) faites à part, pour ne pas les confondre avec les décos.
- ✅ Arrosage fait (v2.17) : `docs/arrosage.sql` (à lancer après `visites.sql`). Celui qui arrose gagne 5 + 2 × niveau XP. Un arrosage appris en retard (jeu fermé) est rattrapé : eau et bonus comptés depuis l'heure de l'arrosage. En attendant la boîte aux lettres, l'arrivée d'un arrosage est annoncée par un message à l'ouverture du jeu.

## Étape 3 : échanges

- Bouton **Échanger** dans la visite (à côté de l'arrosoir) et dans la conversation. La proposition arrive dans la boîte aux lettres, avec une ligne dans la conversation.
- Dans la fenêtre d'échange, on voit l'inventaire de l'autre (plantes et plats, avec quantités) pour choisir ce qu'on demande.
- Deux types : **objets contre objets** (plantes et plats mélangés) ou **objets contre pièces**. Pas de cadeau, pas de pièces contre pièces.
- **Équivalence** : valeur = prix de vente au marché. Écart de **20 %** au plus entre les deux côtés. Balance affichée, et vérification par le serveur avec sa propre liste des prix.
- Plafond fixe pour tout le monde : **3 000 pièces de valeur** par côté. **3 échanges par jour.**
- Exclus : graines et dorées.
- **Anti-spoil**, dans les deux sens :
  - on ne peut pas proposer un objet que l'autre n'a pas découvert ;
  - dans son inventaire, ce que tu n'as pas découvert est masqué ;
  - un plat est découvert quand il est **débloqué au niveau** du joueur (recette apprise ou non), et seulement si ses hybrides sont découverts.
- Tout ce qu'on propose (objets ou pièces) quitte le compte dès l'envoi. C'est rendu si l'autre refuse, si on **annule** (depuis la boîte aux lettres, où l'on voit tous ses échanges proposés) ou au bout de **48 h**.
- À l'acceptation, le jeu de l'autre vérifie qu'il a encore assez. Sinon : « Tu n'en as plus assez ».
- ✅ Fait (v2.19) : `docs/echanges.sql` (après `arrosage.sql`), puis `docs/echanges-valeurs.sql` (prix des objets). Après chaque changement de prix, de plante ou de recette : `node tools/trade-values.js`, puis relancer `echanges-valeurs.sql` dans Supabase.
- Boîte aux lettres provisoire (dessin rouge) en bas à droite du jardin : Reçus, Envoyés (avec Annuler), Nouvelles (arrosages et échanges). Une proposition envoie aussi un message dans la conversation.
- Au plus 8 objets différents de chaque côté. Si le compte de l'ami est supprimé, la proposition expire et les objets reviennent.
- ✅ v2.20 :
  - chaque côté peut mêler objets et pièces (jamais de pièces des deux côtés) ; objets rangés en deux onglets, Récoltes et Plats ;
  - petite balance : le plateau le plus lourd descend, verte quand l'échange est équilibré ;
  - **contre-proposition** depuis un échange reçu (pré-remplie à l'envers) : l'échange reçu est remplacé, son auteur récupère ses objets, la nouvelle proposition repart pour 48 h et ne compte pas dans les 3 échanges du jour ;
  - boîte aux lettres : bouton « Nouvel échange » dans Envoyés ; nouvelles gardées 24 h (arrosages) et 7 jours (échanges) ;
  - le message « 📬 » de la conversation montre l'échange, avec « Annuler l'échange » (ou son état) ;
  - liste d'amis : visiter, échanger, messages (même style) ; retirer et bloquer dans le menu ⋯ de la conversation, avec une fenêtre de confirmation.
- ✅ v2.20.1 : balance en deux jauges rondes autour d'une petite balance ; « Nouvel échange » mène à l'onglet Amis ; croix au lieu des boutons « Fermer », plus de barre de glissement sur les fenêtres ; moins de messages en bas de l'écran ; nouvelles gardées dans la partie (une non lue reste, une lue s'efface après 24 h ou 7 jours).
- ✅ v2.20.2 : toucher un ami ouvre la conversation ; recherche dans la liste d'amis ; code ami compact ; « Nouvel échange » ouvre l'onglet Amis avec les boutons ⇄ en couleur ; la conversation reste en bas après une action ; choix de la saison dans les Paramètres de la version de test.
- ✅ v2.22 : images définitives de la boîte aux lettres (`ui-mail-empty`, `ui-mail-full`, drapeau levé quand il y a du courrier) et de l'arrosoir d'ami (`ui-friend-water`). La boîte est en bas à droite du jardin, plus grande, avec une marge sous le jardin.
- ✅ v2.23 : boîte aux lettres rouge en haut à droite du jardin (dépasse un peu au-dessus) ; bouton Arroser avec trois gouttes. Décos remplacées : Arrosoir fleuri → **Bain d'oiseaux** (`birdbath`, succès « Toujours humide »), Boîte aux lettres → **Panneau du village** (`signpost`, succès « Ami de tous »). Les joueurs qui les avaient placées gardent la nouvelle au même endroit.

## Conseils de Mamie Lapine pour la v3

✅ Fait (v2.21, `js/tuto.js`). Conseils « selon la situation », une seule fois chacun, pour les nouveaux comme pour les anciens joueurs, à partir du niveau 3 et une fois les premiers pas faits :
1. **Onglet Amis** (jardin et autres onglets, la lueur montre l'onglet) : ce qu'on peut faire avec ses amis. Terminé en ouvrant l'onglet.
2. **Code ami** (onglet Amis, tant qu'on n'a pas d'ami) : partager son code ou entrer celui d'un ami.
3. **Visite** (premier ami) : la petite pousse, et l'arrosage une fois par jour (+20 % pendant 2 h, un peu d'XP). Terminé à la première visite.
4. **Échange** (après la première visite) : le bouton ⇄, objets contre objets ou contre des pièces, valeur à peu près égale.
5. **Arrosage reçu** (jardin, quand un ami vient d'arroser) : la ligne sous « L'eau tient… ».
6. **Courrier** (jardin, quand la boîte aux lettres a une pastille) : ce qu'on y trouve. Terminé en ouvrant la boîte.

Ces conseils n'attendent pas leur onglet : ils ne bloquent pas les autres conseils. Ils n'apparaissent que là où les amis sont ouverts (`FRIENDS_ON`) et une fois connecté.

## Étape 4 : plus de choses à faire entre amis

### « J'aime ton jardin » ✅ (v2.24, `docs/jaime.sql`)
- Bouton ❤️ dans la visite, une fois par semaine par ami (semaine du lundi au dimanche, heure de Paris). Aucun bonus.
- Celui qui le reçoit voit quelques cœurs monter sur l'écran (environ 4 s) avec « Léa aime ton jardin », et une ligne dans les Nouvelles (gardée 7 jours une fois lue).

### Succès « Entre amis » ✅ (v2.24)
- **Coup d'arrosoir** : arroser 5 / 20 / 50 fois le jardin d'un ami. Titre au dernier palier : « Jardinier solidaire ».
- **Troc** : conclure 3 / 10 / 30 échanges. Titre au dernier palier : « As du troc ».
- **Esprit d'équipe** (à venir avec les objectifs) : réussir 1 / 4 / 12 objectifs de la semaine.
- Pas de succès sur le nombre d'amis (il pousserait à accepter des inconnus). Pas de coup de main contre les nuisibles (il gâcherait le succès de l'escargot gardé une heure).

### Objectifs de la semaine ✅ (v2.25, `docs/objectifs.sql`, `js/goals.js`)
Deux objectifs par semaine, collaboratifs (jamais compétitifs), qui changent selon la saison (récolter des plantes de saison, livrer des commandes, cuisiner, attraper des visiteurs…). La part d'un même joueur est plafonnée.
- **Objectif entre amis** : toi et tes amis (chacun voit le total de son propre cercle). Taille selon le nombre d'amis.
  - 1re réussite dans une saison : **déco exclusive de la saison + XP** (pas de graines).
  - Réussites suivantes : **graines + un peu d'XP**.
- **Objectif de tous les joueurs** : même compteur pour tout le monde, récompenses meilleures, **3 paliers** (par ex. 25 %, 60 %, 100 %).
  - 1re réussite dans une saison : **déco exclusive de la saison, différente de celle des amis, + XP** (pas de graines).
  - Ensuite : **graines d'hybrides + XP**. Hybride pas encore découvert : graines mises de côté (« graines mystère »), données le jour de la découverte.
- **Affichage** : sur l'écran d'accueil, section « Objectifs de la semaine » séparée des objectifs du jour, entre le jardin et l'inventaire. Quand rien n'est fini, elle est sous les objectifs du jour ; quand les objectifs du jour sont finis (ils descendent en bas), elle reste à sa place. Un objectif fini est grisé et passe en deuxième. Jauges de progression comme les objectifs du jour. Toucher un objectif montre ses récompenses. Rien dans l'onglet Amis, pas de rappel dans le jardin.
- ✅ **Images des 8 décos** ajoutées (v2.27) :
  - entre amis : Arche fleurie (printemps), Table de pique-nique (été), Hérisson et feuilles (automne), Bonhomme de neige (hiver) — `deco-f_<saison>.webp` ;
  - tous les joueurs : Fontaine fleurie (printemps), Moulin à vent (été), Montgolfière (automne), Sapin illuminé (hiver) — `deco-g_<saison>.webp`.
- Réglages (js/goals.js) : types en rotation chaque semaine (récoltes de saison, commandes, plats, visiteurs ; l'objectif de tous a un type décalé de 2 semaines) ; base par joueur 40 / 12 / 15 / 20 ; entre amis : cible = base × taille du cercle (8 au plus), part d'un joueur ≤ 1,5 × base ; tous : cible = base × joueurs actifs de la semaine passée (5 au moins) × 0,6, part d'un joueur ≤ 2 × base ; paliers 25 / 60 / 100 %.

## Sortie de la v3
- ✅ Fenêtre « Du nouveau au potager ! » de la v3 (v2.28, `js/news.js`) : une seule fois par appareil, pour les joueurs qui avaient déjà une partie (les nouveaux découvrent tout avec Mamie Lapine). Version de test : Paramètres › Version de test › « Revoir ».
- ✅ Deux conseils de Mamie Lapine en plus : les objectifs de la semaine (jardin) et les 4 nouveaux hybrides (Serre, pour ceux qui ont déjà découvert un hybride).
- À faire au moment de la sortie : ouvrir les amis aux joueurs (`FRIENDS_ON`), notes de version (`CHANGELOG.md`), fusion de `test` dans `main`.
