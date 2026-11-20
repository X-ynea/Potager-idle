# Pack de prompts : images de potager-idle

Les prompts sont en anglais, parce que les générateurs d'images le comprennent mieux.
Chaque prompt = **le bloc de style commun** + **le sujet**. Tout est déjà assemblé : il suffit de copier un bloc.

## Comment procéder

1. **Outil conseillé** : ChatGPT (génération d'images). Il sait faire des fonds transparents. Midjourney, Leonardo ou Ideogram marchent aussi : demande alors un fond blanc uni, je détourerai.
2. **Commence par le test de style** (3 images ci-dessous) et envoie-les-moi. On valide le style avant de tout générer.
3. **Garde la cohérence** :
   - génère tout dans **la même conversation** ;
   - une fois une image validée, renvoie-la avec « same style as this image » si le style dérive ;
   - si une image a un visage, du texte ou plusieurs objets, régénère-la.
4. **Format** : carré, 1024 × 1024, PNG.
5. **Dépose les fichiers** dans `assets/raw/`, avec **exactement les noms indiqués** (ex. `plant-radis.png`). Je m'occupe du recadrage, de la compression et de l'intégration.

Inutile de tout faire d'un coup : la **priorité 1** suffit pour un premier rendu. Les dessins actuels restent en secours tant qu'une image manque.

---

## Format recommandé pour les plantes : une planche par plante

**Validé avec le radis.** Une seule image par plante, avec ses 6 vignettes. Nom du fichier : `sheet-<plante>.png` (ex. `sheet-tomate.png`).
Elle remplace, pour cette plante, les fichiers `stage-…`, `plant-…` et `crop-…` listés plus bas.

Grille obligatoire, 3 colonnes × 2 lignes, format 3:2 (1536 × 1024) :
- ligne 1 : graine, pousse, jeune plant ;
- ligne 2 : plante mûre dans la terre, récolte, sac de graines.

Remplace `[PLANTE]` par le nom anglais, `[MÛRE]` par le sujet de la table « Plantes dans la terre » et `[RÉCOLTE]` par celui de la table « Récoltes ».

```
A sprite sheet of 6 separate game assets for a cozy farming game, showing the growth of a [PLANTE], arranged in a strict grid of 3 columns and 2 rows with generous empty space between items. Row 1: a small mound of sandy soil with two seeds; a tiny seedling with two round leaves in a soil mound; a young [PLANTE] plant with leaves but no fruit yet, in a soil mound. Row 2: [MÛRE]; [RÉCOLTE]; a small cream cloth seed bag tied with an orange rope, with a [PLANTE] drawn on it and a few seeds next to it. Stylized 3D render, soft rounded shapes, slightly cartoonish with realistic proportions and textures, soft warm light from the top-left, saturated but natural colors, no outlines, no face, no text. Transparent background, only a small soft contact shadow under each object.
```

Noms anglais : radish, lettuce, carrot, wheat, strawberry, basil, tomato, blueberry, lavender, pumpkin, sunflower.
Pour les hybrides, mets le nom de l'hybride décrit (ex. « fantasy ruby radish »).

---

## Test de style (à faire en premier)

`plant-radis.png`
```
Stylized 3D game asset for a cozy farming game. A radish plant: a round glossy pink-red radish half buried in a small mound of light sandy soil, with fresh bright green leaves on top. Soft rounded shapes, slightly cartoonish but with realistic proportions and textures, soft warm sunlight from the top-left, gentle ambient occlusion, subtle glow through the leaves, saturated but natural colors, clean edges, no outlines. No face, no text, no logo. Single object centered, three-quarter view from slightly above (about 30 degrees), isolated on a transparent background, square image, high detail, polished game icon render.
```

`crop-tomate.png`
```
Stylized 3D game asset for a cozy farming game. A cluster of three ripe glossy red tomatoes still on a short green vine with a few leaves. Soft rounded shapes, slightly cartoonish but with realistic proportions and textures, soft warm sunlight from the top-left, gentle ambient occlusion, saturated but natural colors, clean edges, no outlines. No face, no text, no logo. Single object centered, three-quarter view from slightly above (about 30 degrees), isolated on a transparent background, square image, high detail, polished game icon render.
```

`dish-soupe.png`
```
Stylized 3D game asset for a cozy farming game. A pastel blue ceramic soup pot with two small handles, filled with creamy orange carrot soup with a white swirl of cream on top. Soft rounded shapes, slightly cartoonish but with realistic proportions and textures, soft warm sunlight from the top-left, gentle ambient occlusion, saturated but natural colors, clean edges, no outlines. No face, no text, no logo. Single object centered, three-quarter view from slightly above (about 30 degrees), isolated on a transparent background, square image, high detail, polished game icon render.
```

---

## Le bloc de style seul (pour écrire tes propres prompts)

Remplace `[SUJET]` par la description de l'objet.

```
Stylized 3D game asset for a cozy farming game. [SUJET]. Soft rounded shapes, slightly cartoonish but with realistic proportions and textures, soft warm sunlight from the top-left, gentle ambient occlusion, saturated but natural colors, clean edges, no outlines. No face, no text, no logo. Single object centered, three-quarter view from slightly above (about 30 degrees), isolated on a transparent background, square image, high detail, polished game icon render.
```

Les prompts ci-dessous ne donnent que le **sujet**, à insérer dans ce bloc.
Astuce dans ChatGPT : envoie d'abord le bloc de style en disant « garde ce style pour toutes les images suivantes », puis envoie seulement les sujets un par un.

---

## Priorité 1 : le début du jeu (17 images)

### Stades de pousse (communs à toutes les plantes)

| Fichier | Sujet |
| --- | --- |
| `stage-seed.png` | A small mound of freshly tilled light sandy soil with a tiny planting hole and two pale seeds next to it |
| `stage-sprout.png` | A tiny green seedling with two round baby leaves sprouting from a small mound of light sandy soil |
| `stage-young.png` | A young leafy green plant without any fruit or flower yet, about ten leaves, growing from a small mound of light sandy soil |

### Plantes dans la terre (affichées dans les bacs du jardin)

| Fichier | Sujet |
| --- | --- |
| `plant-radis.png` | A radish plant: a round glossy pink-red radish half buried in a small mound of light sandy soil, with fresh bright green leaves on top |
| `plant-laitue.png` | A butterhead lettuce growing in a small mound of light sandy soil, light green tender ruffled leaves forming a round head |
| `plant-carotte.png` | A carrot growing in a small mound of light sandy soil: only the orange top of the carrot visible above ground, with tall feathery green leaves |
| `plant-ble.png` | A small clump of wheat growing from a small mound of light sandy soil, three golden ripe ears on slender stems with thin leaves |
| `plant-fraise.png` | A strawberry plant growing from a small mound of light sandy soil, trifoliate serrated leaves, one small white flower and three ripe red strawberries hanging |

### Récoltes (inventaire et marché)

| Fichier | Sujet |
| --- | --- |
| `crop-radis.png` | Two freshly harvested radishes with short green leaf tops |
| `crop-laitue.png` | One freshly harvested butterhead lettuce head |
| `crop-carotte.png` | Two freshly harvested orange carrots with feathery green tops |
| `crop-ble.png` | A small bundle of golden wheat ears tied with twine |
| `crop-fraise.png` | Three ripe glossy red strawberries with green caps |

### Premiers plats

| Fichier | Sujet |
| --- | --- |
| `dish-salade.png` | A white ceramic bowl of crunchy green salad with lettuce leaves and thin slices of pink radish |
| `dish-soupe.png` | A pastel blue ceramic soup pot with two small handles, filled with creamy orange carrot soup with a white swirl of cream |
| `dish-pain.png` | A rustic round country bread loaf with a scored golden-brown crust, dusted with flour |
| `dish-tarte.png` | A strawberry tart on a small cream plate, rows of glossy halved strawberries on a golden shortcrust |

---

## Priorité 2 : la suite des plantes (12 images)

### Plantes dans la terre

| Fichier | Sujet |
| --- | --- |
| `plant-basilic.png` | A bushy basil plant with glossy bright green oval leaves, growing from a small mound of light sandy soil |
| `plant-tomate.png` | A small tomato plant with three ripe glossy red tomatoes on the vine, growing from a small mound of light sandy soil |
| `plant-myrtille.png` | A small blueberry bush with clusters of dusty blue berries, growing from a small mound of light sandy soil |
| `plant-lavande.png` | A lavender plant with many slender purple flower spikes and silvery green leaves, growing from a small mound of light sandy soil |
| `plant-potiron.png` | A big ribbed orange pumpkin sitting on a small mound of light sandy soil, with two large green leaves and a curly vine |
| `plant-tournesol.png` | A sunflower plant with one large bright yellow flower head and broad green leaves, growing from a small mound of light sandy soil |

### Récoltes

| Fichier | Sujet |
| --- | --- |
| `crop-basilic.png` | A small fresh bunch of basil with glossy green leaves |
| `crop-tomate.png` | A cluster of three ripe glossy red tomatoes still on a short green vine |
| `crop-myrtille.png` | A small handful of dusty blue blueberries |
| `crop-lavande.png` | A small bouquet of lavender stems tied with twine |
| `crop-potiron.png` | A ribbed orange pumpkin with a short curly stem |
| `crop-tournesol.png` | A single cut sunflower head with a short stem |

---

## Priorité 3 : les hybrides (16 images)

Des variétés imaginaires, découvertes dans la Serre. Elles peuvent être un peu plus « magiques ».

### Plantes dans la terre

| Fichier | Sujet |
| --- | --- |
| `plant-rubis.png` | A fantasy radish variety: a deep ruby-red gem-like glossy radish with faint pink speckles, half buried in a small mound of light sandy soil, bright green leaves |
| `plant-poivree.png` | A fantasy lettuce variety with a light green heart and purple-red ruffled outer leaves, growing from a small mound of light sandy soil |
| `plant-lune.png` | A fantasy radish variety: a pale blue radish with a soft moonlight glow and tiny white speckles, half buried in a small mound of light sandy soil |
| `plant-basilomate.png` | A fantasy tomato plant with basil-like glossy leaves and orange-red tomatoes whose caps look like basil leaves, growing from a small mound of light sandy soil |
| `plant-fraisille.png` | A fantasy berry plant with strawberry-shaped berries in a purple-pink blueberry color, growing from a small mound of light sandy soil |
| `plant-bledor.png` | A fantasy wheat variety with shiny bright gold ears that sparkle softly, growing from a small mound of light sandy soil |
| `plant-citrouillotte.png` | A fantasy elongated orange pumpkin shaped like a giant carrot, with ribs and feathery carrot-like leaves, lying on a small mound of light sandy soil |
| `plant-lilas.png` | A fantasy sunflower with lilac-purple petals and a golden center, broad green leaves, growing from a small mound of light sandy soil |

### Récoltes

| Fichier | Sujet |
| --- | --- |
| `crop-rubis.png` | Two fantasy ruby-red gem-like glossy radishes with faint pink speckles and short green tops |
| `crop-poivree.png` | A fantasy lettuce head with a light green heart and purple-red ruffled outer leaves |
| `crop-lune.png` | Two fantasy pale blue radishes with a soft moonlight glow and tiny white speckles |
| `crop-basilomate.png` | Two fantasy orange-red tomatoes with caps shaped like basil leaves |
| `crop-fraisille.png` | Three fantasy strawberry-shaped berries in a purple-pink blueberry color |
| `crop-bledor.png` | A small bundle of fantasy shiny gold wheat ears tied with twine, softly sparkling |
| `crop-citrouillotte.png` | A fantasy elongated orange pumpkin shaped like a giant carrot, with a feathery green top |
| `crop-lilas.png` | A single cut fantasy sunflower head with lilac-purple petals and a golden center |

---

## Priorité 4 : les autres plats (8 images)

| Fichier | Sujet |
| --- | --- |
| `dish-sauce.png` | A glass jar of rich red tomato sauce with a fresh basil leaf on the lid |
| `dish-muffins.png` | Two blueberry muffins in pastel paper cups, golden tops with visible blueberries |
| `dish-smoothie.png` | A tall glass of pink-purple berry smoothie with a striped straw and a berry on the rim |
| `dish-tisane.png` | A cream ceramic cup of lavender herbal tea with a small lavender sprig on the saucer |
| `dish-pesto.png` | A small ceramic bowl of orange-green pesto with a wooden spoon |
| `dish-veloute.png` | A pastel lilac ceramic soup pot with two small handles, filled with creamy pumpkin soup topped with pumpkin seeds |
| `dish-confiture.png` | A jar of ruby-red jam with a gingham cloth lid tied with string |
| `dish-gateau.png` | A festive layered harvest cake with golden cream, blueberries and a strawberry on top |

---

## Priorité 5 : décor et interface (6 images)

| Fichier | Sujet |
| --- | --- |
| `ui-packet.png` | A blank kraft paper seed packet with a folded top, slightly worn, front left completely empty |
| `ui-coin.png` | A shiny gold coin with a small embossed leaf emblem |
| `ui-watering-can.png` | A cute pastel blue metal watering can |
| `ui-snail.png` | A small garden snail with a brown spiral shell, natural look |
| `ui-weed.png` | A small tuft of wild weeds and grass |
| `ui-butterfly.png` | A small butterfly with soft pastel pink and orange wings, seen from above, wings open |

---

**Total : 17 + 12 + 16 + 8 + 6 = 59 images** (les 3 images du test de style en font partie).
