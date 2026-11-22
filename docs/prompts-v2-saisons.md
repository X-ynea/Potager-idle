# Images de la version 2 : « Les quatre saisons »

Même méthode que pour `docs/prompts-images.md` : même bloc de style, même conversation, fichiers déposés dans `assets/raw/` avec **exactement** les noms indiqués.
Tant qu'une image manque, le jeu affiche un dessin de secours : rien ne bloque.

Ordre conseillé : les fonds et les éléments de saison d'abord, car ce sont eux qu'on voit le plus.

---

## 1. Fonds du jardin (4 images)

Le fond actuel (`bg-garden.webp`) est teinté selon la saison en attendant. Pour chaque saison, génère une variante du même fond, **sans aucun objet** : une pelouse vue de dessus, qui sert de tapis sous les bacs. Format carré, 1024 × 1024, fond opaque.

Envoie le fond actuel à ChatGPT et demande : « Same top-down grass texture as this image, same framing and lighting, but [VARIANTE]. No objects, no plants in pots, seamless and calm, only the ground. »

| Fichier | `[VARIANTE]` |
| --- | --- |
| `bg-printemps.png` | fresh spring grass with tiny white daisies and a few pink petals scattered |
| `bg-ete.png` | warm golden summer grass, slightly dry in places, sunny |
| `bg-automne.png` | autumn grass partly covered by orange, red and brown fallen leaves |
| `bg-hiver.png` | grass covered by a soft layer of fresh snow, a few green patches showing, cold blue light |

---

## 2. Ce qui bloque les bacs (3 images)

Même usage que l'escargot : l'objet est posé sur la terre d'un bac. Bloc de style habituel, objet seul, fond transparent.

| Fichier | Sujet |
| --- | --- |
| `ui-weeds.png` | A small tuft of wild summer weeds: long tangled grass blades, a dandelion with a yellow flower and a few clover leaves |
| `ui-leaves.png` | A small pile of crunchy autumn leaves, orange, red and brown, slightly curled |
| `ui-frost.png` | A thin sheet of frost and ice crystals forming a delicate snowflake pattern, pale blue and white, slightly translucent |

---

## 3. Visiteurs ailés (3 images)

À attraper dans le jardin, comme le papillon. Vue de dessus ou de trois quarts, ailes ouvertes, **pas de visage expressif**.

| Fichier | Sujet |
| --- | --- |
| `ui-dragonfly.png` | A dragonfly seen from above, slender turquoise body, four translucent iridescent wings spread open |
| `ui-ladybug.png` | A ladybug seen from above, glossy red shell with black spots, wings slightly opened |
| `ui-robin.png` | A small round European robin bird in flight seen from the side, orange-red breast, brown back, wings spread |

---

## 4. Nouvelles plantes (8 planches)

Une planche par plante, au format validé (`sheet-<plante>.png`, 3 colonnes × 2 lignes : graine, pousse, jeune plant / plante mûre, récolte, sac de graines). Reprends le prompt de planche de `docs/prompts-images.md`.

| Fichier | `[PLANTE]` | `[MÛRE]` | `[RÉCOLTE]` |
| --- | --- | --- | --- |
| `sheet-petitpois.png` | pea | a pea plant with curly tendrils and several plump green pods hanging, in a soil mound | three open green pea pods showing round bright green peas |
| `sheet-asperge.png` | asparagus | a few green asparagus spears with purple tips rising straight out of a soil mound | a small bundle of green asparagus spears tied with twine |
| `sheet-courgette.png` | zucchini | a zucchini plant with large leaves, a yellow flower and two green zucchinis, in a soil mound | two glossy dark green zucchinis, one with its yellow flower |
| `sheet-melon.png` | melon | a melon plant with leaves and one round cantaloupe melon resting on the soil | a whole cantaloupe melon with one slice cut out showing orange flesh |
| `sheet-betterave.png` | beetroot | a beetroot half buried in a soil mound with dark green leaves and red stems | two round deep red beetroots with their leaves |
| `sheet-champignon.png` | wild mushroom | a small mossy tree stump in a soil mound with a cluster of brown cap mushrooms growing on it | a cluster of three brown cap wild mushrooms |
| `sheet-poireau.png` | leek | two tall leeks standing in a soil mound, white base and dark green leaves | two leeks with white roots and green leaves |
| `sheet-chou.png` | winter cabbage | a big curly green savoy cabbage sitting in a soil mound, a little frost on the edges | a whole curly green savoy cabbage |

---

## 5. Nouveaux plats (8 images)

Bloc de style habituel. Fichier `dish-<recette>.png`.

| Fichier | Sujet |
| --- | --- |
| `dish-veloute_pois.png` | A white ceramic bowl of smooth bright green pea soup with a swirl of cream and a few whole peas on top |
| `dish-gratin.png` | A small rectangular baking dish of golden zucchini gratin with slices of zucchini, potato and tomato, bubbling cheese crust |
| `dish-soupe_bette.png` | A rustic bowl of deep ruby red beetroot soup with a dollop of white cream and a sprig of dill |
| `dish-fondue.png` | A slice of toasted country bread topped with soft melted leeks, on a small wooden board |
| `dish-tarte_asperge.png` | A thin golden puff pastry tart with green asparagus spears arranged like sun rays |
| `dish-salade_melon.png` | A glass bowl of melon balls, halved strawberries and small basil leaves |
| `dish-tourte.png` | A round golden pie with a decorated pastry lid shaped like leaves, a slice cut showing mushrooms inside |
| `dish-potee.png` | A cast iron pot of hearty cabbage stew with carrots and potatoes, steam rising |

---

## 6. Voisins de saison (4 portraits)

Même style que les portraits actuels des voisins (envoie-en un en exemple, celui de Mamie Lapine par exemple) : animal anthropomorphe en buste, doux et souriant, fond uni pâle.
Fichiers `villager-8.png` à `villager-11.png`, dans cet ordre :

| Fichier | Voisin |
| --- | --- |
| `villager-8.png` | Mlle Hirondelle : a young swallow with a navy blue back, white chest and red throat, wearing a light travel scarf |
| `villager-9.png` | Léon le Lézard : a relaxed green lizard wearing a straw hat and sunglasses pushed up on his head |
| `villager-10.png` | Noisette la Souris : a small brown mouse with big round ears, wearing a knitted orange scarf and holding a hazelnut |
| `villager-11.png` | Edmond l'Ours : a big sleepy brown bear wrapped in a warm plaid blanket, holding a mug |

---

**Total : 30 images.** Les priorités 1 à 3 (10 images) changent déjà beaucoup l'ambiance.
