# Version 4 : plan (proposition, à valider)

Tout se prépare sur la branche `test` (version publiée dans `/test/`). Comme pour la v3, seul le propriétaire écrit dans sa sauvegarde ; ce qui est commun (jardin partagé, tableaux des scores) vit sur le serveur, dans des fichiers SQL à lancer dans Supabase › SQL Editor.

## 1. Le jardin commun

### Qui et comment
- **4 jardiniers au plus** : celui qui le crée et **3 amis**. On ne fait partie que d'**un seul** jardin commun à la fois.
- **Création** depuis l'onglet Amis, avec une carte « Jardin commun » en haut de la liste. On choisit un nom, puis on invite des amis. L'invitation arrive dans la boîte aux lettres et l'ami peut accepter ou refuser.
- **Accès** : la carte de l'onglet Amis, et un **petit portail** au bord de son propre jardin (hors des emplacements de déco) qui y mène directement.
- **Gestion** : celui qui l'a créé invite et peut retirer un membre. Chacun peut **quitter** le jardin, avec une fenêtre de confirmation. S'il part, le plus ancien membre devient le gérant. Quand le dernier membre part, le jardin disparaît.
- Jardin à partir du niveau 5, pour qu'on ait déjà découvert quelques plantes.

### Les bacs
- **6 bacs**, avec le décor de la saison.
- **Graines** : on n'y trouve que les **plantes de base (pas d'hybride)** que **tous les membres** ont déjà découvertes. Rien n'est dévoilé : quand un nouveau membre arrive, la liste peut se réduire.
- Les graines y sont **gratuites**, parce que rien de ce jardin ne revient chez soi. On ne peut **pas apporter** de récolte ni de graine de son propre jardin.
- **Tout le monde** peut planter, arroser et récolter. La plante pousse comme chez soi, avec le bonus de saison, mais sans le compost ni les améliorations personnelles. Le serveur tient l'heure de plantation et d'arrosage.
- Sur chaque bac, une petite photo de celui qui a planté.

### Le panier commun
- Les récoltes vont dans le **panier commun**, qui ne sert qu'aux commandes partagées. On ne peut **jamais** le vider vers son inventaire ni le vendre.
- Il contient 60 objets au plus. Quand il est plein, on ne peut plus récolter avant d'avoir livré une commande.

### Les commandes partagées
- **2 commandes à la fois**, faites seulement avec les plantes proposées dans ce jardin, donc découvertes par tous. Quand l'une est livrée, une nouvelle arrive au bout de quelques heures.
- **Récompense pour chaque membre qui a aidé** (planté, arrosé ou récolté depuis la commande précédente) : des pièces et de l'XP, et parfois un **ingrédient de balade** ou une graine de saison. Elle arrive dans la boîte aux lettres.
- Une **déco du jardin commun** (exclusive) pour la 10ᵉ commande livrée ensemble, une fois par membre.

## 2. L'onglet « Balades » : les mini-jeux

### Les onglets
Il y aurait 7 onglets, c'est trop sur un téléphone. Je propose de réunir **Cuisine et Serre dans un onglet « Atelier »**, avec deux sous-onglets en haut, chacun avec son badge et sa jauge. On garde ainsi 6 onglets : Jardin, Atelier, Balades (icône du panneau en bois aux flèches), Marché, Village, Amis.

### Les jeux
Les jeux se jouent au doigt et durent de 30 s à 1 min. On peut faire **3 parties par jeu et par jour**. Le jour change à minuit, heure de Paris.

| Jeu | Esprit | Comment on joue | Ce qu'il rapporte |
| --- | --- | --- | --- |
| **Pêche à l'étang** | détente | lancer la ligne, attendre que le bouchon plonge, toucher au bon moment | algues, cresson, menthe d'eau |
| **Balade en forêt** | détente | avancer sur un sentier et toucher ce qu'on trouve dans les buissons | châtaignes, mûres, noisettes |
| **Memory des graines** | mémoire | retrouver les paires de cartes | pièces et XP, rarement une graine |
| **Cueillette express** | réflexes | attraper les légumes qui tombent dans le panier, en évitant les cailloux | pièces et XP |
| **La ruche** | rythme | toucher les fleurs qui s'ouvrent pour que les abeilles butinent | miel |

- Les récompenses restent **petites**. Pour les jeux à pièces, au plus l'équivalent d'environ 10 min de récoltes au niveau du joueur par partie.
- Ce que l'on trouve varie selon la saison : par exemple des mûres en été et des châtaignes en automne.

### Le tableau entre amis
- Chaque jeu a un petit tableau : **ton meilleur score de la semaine et celui de tes amis**. Il repart à zéro le lundi.
- Pas de classement de tous les joueurs ni de récompense au classement, seulement une petite couronne pour le premier.

## 3. Nouveaux ingrédients et recettes
- **7 ingrédients de balade**, qu'on ne peut pas cultiver : algues, cresson, menthe d'eau, châtaignes, mûres, noisettes et miel.
- Ils vont dans l'inventaire, se vendent au marché et s'échangent avec ses amis.
- **8 nouvelles recettes environ**, par exemple : tartine au miel, soupe de cresson, confiture de mûres, crème de châtaigne, salade de la mer (algues), thé à la menthe, gâteau aux noisettes, et un grand plat qui réunit plusieurs ingrédients de balade.

## 4. Et aussi
- **2 nouveaux voisins**, qui demandent aussi des ingrédients de balade.
- **2 nouveaux hybrides** dans la Serre, à partir de plantes existantes. Ils ne vont pas dans le jardin commun.
- **De nouvelles décos** : une pour le jardin commun et quelques-unes à gagner dans les balades (par exemple une barque, un panier de champignons, une ruche en paille).
- **Des succès** : « Bon pêcheur », « Promeneur », « Butineur », « Mains unies » (commandes partagées)…
- **Mamie Lapine** présente chaque nouveauté, et une fenêtre « Du nouveau au potager ! » s'affiche à la sortie.

## Images à fournir (320 × 320, fond transparent)
Les 7 ingrédients, les recettes, les 2 hybrides (plante et jeunes plants), les décos, les 2 voisins, l'icône du panneau, le portail et le décor de chaque jeu (étang, forêt, ruche…). Je mets des dessins provisoires en attendant.

## Ordre de travail
1. Onglet Atelier (Cuisine + Serre réunies).
2. Onglet Balades, ingrédients de balade, puis les jeux un par un : ruche, pêche, forêt, memory, cueillette.
3. Tableau des scores entre amis (`docs/balades.sql`).
4. Nouvelles recettes, voisins, hybrides et décos.
5. Jardin commun : base de données (`docs/jardin-commun.sql`), création et invitations, bacs, panier, commandes partagées.
6. Succès, conseils de Mamie Lapine, fenêtre « Du nouveau », CHANGELOG, puis sortie (fusion de `test` dans `main` quand tu le décides).
