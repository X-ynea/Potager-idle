#!/usr/bin/env python3
"""Prépare les images du jeu à partir des fichiers déposés dans assets/raw/.

- sheet-<plante>.png : planche 3 colonnes x 2 lignes
    ligne 1 : graine, pousse, jeune plant
    ligne 2 : plante mûre dans la terre, récolte, sac de graines
  -> assets/img/<plante>-0..3.webp (stades), <plante>-crop.webp, <plante>-seeds.webp
- dish-<recette>.png, ui-<nom>.png : une image par fichier
  -> assets/img/dish-<recette>.webp, ui-<nom>.webp
- override-<plante>-<0..3|crop|seeds>.png : remplace une image d'une planche
  (ex. override-ble-3.png pour le blé mûr)
- Écrit assets/img/manifest.js pour que le jeu sache quelles images existent.

Usage : python3 tools/process_images.py  (nécessite Pillow, numpy et scipy)
"""
import json
import pathlib

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / "assets" / "raw", ROOT / "assets" / "img"
SIZE = 320          # taille de sortie (px), suffisant pour un téléphone
GROUND = 0.97       # ligne de sol commune aux stades (part de la hauteur)
POCKET_MIN = 20     # taille mini (px) d’une poche de damier enfermée à retirer


def remove_flat_bg(im):
    """Pour les images sur fond uni blanc ou noir : retire la couleur de fond reliée aux bords
    (pas celle à l'intérieur des objets, comme des fleurs blanches) et adoucit les contours."""
    arr = np.array(im.convert("RGB")).astype(np.float32)
    dark = arr[:6, :6].mean() < 128
    # « Distance » au fond : 0 = couleur du fond, 255 = très différent.
    dist = arr.max(axis=2) if dark else 255 - arr.min(axis=2)
    if dark:
        candidate = dist <= 20
    else:
        # Blanc uni ou faux damier blanc/gris : gris clairs et neutres (sans couleur).
        candidate = (arr.min(axis=2) >= 170) & (arr.max(axis=2) - arr.min(axis=2) <= 8)
    labels, _ = ndimage.label(candidate)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border > 0])
    if not dark:
        # Poches de fond enfermées entre deux objets (ex. entre des graines) : on les retire
        # quand elles contiennent le motif du damier (blanc ET gris), pas un simple reflet blanc.
        lo = arr.min(axis=2)
        n = labels.max()
        ids = np.arange(1, n + 1)
        has_white = ndimage.maximum(lo >= 248, labels, ids)
        has_grey = ndimage.maximum((lo >= 170) & (lo <= 236), labels, ids)
        size = ndimage.sum(np.ones_like(lo), labels, ids)
        checker = ids[(has_white > 0) & (has_grey > 0) & (size >= POCKET_MIN)]
        bg |= np.isin(labels, checker)
    # Bande de contour : transparence progressive, couleur débarrassée du fond.
    band = ndimage.binary_dilation(bg, iterations=2) & ~bg
    alpha = np.where(bg, 0.0, 1.0)
    alpha = np.where(band, np.minimum(alpha, np.clip(dist / 45.0, 0, 1)), alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    base = 0.0 if dark else 255.0
    rgb = np.where(band[..., None], np.clip((arr - (1 - alpha[..., None]) * base) / safe, 0, 255), arr)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")


def load(path):
    im = Image.open(path).convert("RGBA")
    if im.getchannel("A").getextrema()[0] == 255:  # aucun pixel transparent : fond uni à retirer
        im = remove_flat_bg(im)
    return im


def clean(im):
    """Supprime les halos presque transparents et rend les objets opaques."""
    im = im.convert("RGBA")
    a = im.getchannel("A").point(lambda v: 0 if v < 40 else 255 if v > 200 else round((v - 40) * 255 / 160))
    im.putalpha(a)
    return im


def bbox(im):
    return im.getchannel("A").getbbox()


def place(obj, scale, anchor_bottom):
    obj = obj.resize((max(1, round(obj.width * scale)), max(1, round(obj.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    x = (SIZE - obj.width) // 2
    y = round(SIZE * GROUND) - obj.height if anchor_bottom else (SIZE - obj.height) // 2
    canvas.alpha_composite(obj, (x, max(0, y)))
    return canvas


def icon(im):
    obj = im.crop(bbox(im))
    return place(obj, SIZE * 0.9 / max(obj.size), anchor_bottom=False)


def save(im, name):
    im.save(OUT / name, "WEBP", quality=86, method=6)


# Planches qui ne suivent pas exactement la grille : quelle vignette sert à quoi.
# Les vignettes sont numérotées dans l'ordre de lecture (ligne par ligne, de gauche à droite).
DEFAULT_LAYOUT = {"stages": [0, 1, 2, 3], "crop": 4, "seeds": 5}
LAYOUT = {
    # ligne 2 : buisson en fleurs, buisson avec baies, baies, sac
    "myrtille": {"stages": [0, 1, 2, 4], "crop": 5, "seeds": 6},
    # ligne 2 : bouton floral, tournesol épanoui (sert aussi de récolte), sac
    "tournesol": {"stages": [0, 1, 3, 4], "crop": 4, "seeds": 5},
    # ligne 2 : plant en fleurs, potiron, sac
    "potiron": {"stages": [0, 1, 3, 4], "crop": 4, "seeds": 5},
    # ligne 2 : un plant en plus avant la plante mûre
    "poivree": {"stages": [0, 1, 2, 4], "crop": 5, "seeds": 6},
    # ligne 2 : plant en fleurs, plant avec fruits, sac (récolte : override)
    "fraisille": {"stages": [0, 1, 3, 4], "crop": 4, "seeds": 5},
    # ligne 2 : plant en fleurs, grosse citrouillotte, sac (récolte : override)
    "citrouillotte": {"stages": [0, 1, 3, 4], "crop": 4, "seeds": 5},
    # ligne 2 : bouton, fleur épanouie, sac collé à une fleur (récolte : override)
    "lilas": {"stages": [0, 1, 2, 4], "crop": 4, "seeds": 5},
}


def split_sheet(sheet, rows=2, merge=0):
    """Repère les objets de la planche et les renvoie dans l'ordre de lecture.
    Chaque gros objet est une vignette ; les petits morceaux détachés (graines,
    feuilles tombées…) sont rattachés au gros objet le plus proche."""
    arr = np.array(sheet)
    mask = arr[:, :, 3] > 0
    # merge > 0 : les morceaux proches de moins de `merge` px forment un seul objet (ex. 3 graines)
    grow = ndimage.binary_dilation(mask, iterations=merge) if merge else mask
    labels, n = ndimage.label(grow, structure=np.ones((3, 3)))
    labels = np.where(mask, labels, 0)
    H, W = labels.shape
    ids = np.arange(1, n + 1)
    sizes = ndimage.sum(np.ones_like(labels), labels, ids)
    centers = ndimage.center_of_mass(np.ones_like(labels), labels, ids)
    boxes = ndimage.find_objects(labels)
    big = [i for i in ids if sizes[i - 1] >= 0.012 * W * H]
    groups = {i: [i] for i in big}
    for i in ids:
        if i in groups or sizes[i - 1] < 40:
            continue
        cy, cx = centers[i - 1]
        def gap(j):
            sl = boxes[j - 1]
            dy = max(sl[0].start - cy, 0, cy - sl[0].stop)
            dx = max(sl[1].start - cx, 0, cx - sl[1].stop)
            return dx * dx + dy * dy
        groups[min(big, key=gap)].append(i)
    order = sorted(big, key=lambda i: (min(rows - 1, int(centers[i - 1][0] // (H / rows))), centers[i - 1][1]))
    cells = []
    for i in order:
        out = arr.copy()
        out[:, :, 3] = np.where(np.isin(labels, groups[i]), arr[:, :, 3], 0)
        im = Image.fromarray(out, "RGBA")
        cells.append(im.crop(bbox(im)))
    return cells


def drop_border_pieces(im):
    """Retire les morceaux coupés qui touchent le bord (bouts d'objets voisins sur une capture)."""
    arr = np.array(im)
    labels, _ = ndimage.label(arr[:, :, 3] > 0, structure=np.ones((3, 3)))
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    arr[:, :, 3] = np.where(np.isin(labels, border[border > 0]), 0, arr[:, :, 3])
    return Image.fromarray(arr, "RGBA")


STAGE3_HEIGHT = {}  # hauteur du stade mûr de chaque planche, pour caler les remplacements


def process_override(path, target):
    """override-<plante>-<0..3|crop|seeds>.png : remplace une seule image d'une planche."""
    im = drop_border_pieces(clean(load(path)))
    obj = im.crop(bbox(im))
    key, part = target.rsplit("-", 1)
    if part.isdigit():
        h = STAGE3_HEIGHT.get(key, SIZE * 0.94)
        scale = min(h / obj.height, SIZE * 0.94 / max(obj.size))
        save(place(obj, scale, anchor_bottom=True), f"{target}.webp")
    else:
        save(icon(obj), f"{target}.webp")
    print(f"Remplacé : {target}")


def process_sheet(path, key):
    cells = split_sheet(clean(load(path)))
    lay = LAYOUT.get(key, DEFAULT_LAYOUT)
    need = max(lay["stages"] + [lay["crop"], lay["seeds"]]) + 1
    if len(cells) < need:
        print(f"Attention : {path.name} contient {len(cells)} objets, {need} attendus. Planche ignorée.")
        return False
    if len(cells) != need:
        print(f"Note : {path.name} contient {len(cells)} objets ({need} attendus), vérifie le résultat.")
    objs = [cells[i] for i in lay["stages"]]
    # Même échelle pour les 4 stades : le tas de terre garde la même taille en grandissant.
    scale = min(SIZE * 0.94 / max(o.size) for o in objs)
    for i, o in enumerate(objs):
        save(place(o, scale, anchor_bottom=True), f"{key}-{i}.webp")
    STAGE3_HEIGHT[key] = objs[3].height * scale
    save(icon(cells[lay["crop"]]), f"{key}-crop.webp")
    save(icon(cells[lay["seeds"]]), f"{key}-seeds.webp")
    return True


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    found = {"plants": [], "dishes": [], "ui": []}
    for path in sorted(RAW.glob("*.png")):
        name = path.stem
        if name.startswith("sheet-"):
            key = name[6:]
            if process_sheet(path, key):
                found["plants"].append(key)
        elif name.startswith("dish-"):
            save(icon(clean(load(path))), f"{name}.webp")
            found["dishes"].append(name[5:])
        elif name.startswith("ui-"):
            save(icon(clean(load(path))), f"{name}.webp")
            found["ui"].append(name[3:])
        elif name.startswith("override-"):
            continue  # traité après les planches
        else:
            print(f"Ignoré (nom non reconnu) : {path.name}")
    for path in sorted(RAW.glob("override-*.png")):
        process_override(path, path.stem[len("override-"):])
    (OUT / "manifest.js").write_text(
        "/* Généré par tools/process_images.py : liste des images disponibles. */\n"
        f"window.IMG = {json.dumps(found, ensure_ascii=False)};\n", encoding="utf-8")
    for k, v in found.items():
        print(f"{k}: {', '.join(v) or '(aucune)'}")


if __name__ == "__main__":
    main()
