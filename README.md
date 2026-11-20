# Petit Potager

Un petit jeu idle de potager, pensé pour le téléphone (Android) et installable comme une appli (PWA).

Plante, arrose, récolte, cuisine des plats, croise tes récoltes dans la Serre pour découvrir des variétés hybrides et livre les commandes des voisins du village. Les plantes poussent en temps réel (de 1 à 20 minutes), même quand le jeu est fermé.

## Jouer

- **En ligne** : la page GitHub Pages du dépôt.
- **Installer sur Android** : ouvre la page dans Chrome, puis touche « Installer » dans le jeu (ou menu ⋮ → « Installer l'application »). Le jeu marche ensuite hors-ligne.
- La partie est sauvegardée sur l'appareil. « Sauvegarde et options », en bas du Jardin, permet de copier sa sauvegarde vers un autre appareil.

## Lancer en local

Le service worker a besoin d'un vrai serveur (pas de `file://`) :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Organisation

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `css/style.css` | Styles (mobile d'abord, thème clair/sombre automatique) |
| `js/data.js` | Plantes, hybrides, recettes, améliorations, voisins : **l'équilibrage se fait ici** |
| `js/art.js` | Dessins SVG des plantes, plats et voisins |
| `js/game.js` | Logique du jeu, écrans, sauvegarde, installation |
| `sw.js` | Mode hors-ligne (réseau d'abord, cache si pas de connexion). À chaque mise à jour, augmenter `VERSION` ici **et** le `?v=` des fichiers dans `index.html` |
| `manifest.webmanifest`, `icons/` | Nom, icône et couleurs de l'appli installée |
| `fonts/` | Polices Fredoka et Nunito (licence SIL OFL), embarquées pour le hors-ligne |

## Ajouter des images

1. Déposer les images générées dans `assets/raw/` (noms dans `docs/prompts-images.md`) :
   `sheet-<plante>.png` (planche 3×2), `dish-<recette>.png`, `ui-<nom>.png`.
2. Lancer `python3 tools/process_images.py` (nécessite Pillow, numpy et scipy) : il découpe, nettoie la transparence,
   compresse en WebP dans `assets/img/` et met à jour `assets/img/manifest.js`.
3. Le jeu utilise automatiquement les images présentes ; les dessins vectoriels servent de secours.

## Mettre en ligne avec GitHub Pages

Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, choisir la branche et le dossier `/ (root)`, puis enregistrer. Le site est publié au bout d'une minute environ.

## Pistes pour la suite

- Appli Android native avec [Capacitor](https://capacitorjs.com/) (même code), pour les notifications « tes plantes ont soif ».
- Compte (Discord) pour synchroniser la partie entre appareils.
