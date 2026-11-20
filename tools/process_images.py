#!/usr/bin/env python3
"""Prépare les images du jeu à partir des fichiers déposés dans assets/raw/.

- sheet-<plante>.png : planche 3 colonnes x 2 lignes
    ligne 1 : graine, pousse, jeune plant
    ligne 2 : plante mûre dans la terre, récolte, sac de graines
  -> assets/img/<plante>-0..3.webp (stades), <plante>-crop.webp, <plante>-seeds.webp
- dish-<recette>.png, ui-<nom>.png : une image par fichier
  -> assets/img/dish-<recette>.webp, ui-<nom>.webp
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


def remove_white_bg(im):
    """Pour les images sur fond blanc uni : retire le blanc relié aux bords
    (pas le blanc à l'intérieur des objets, comme des fleurs) et adoucit les contours."""
    arr = np.array(im.convert("RGB")).astype(np.float32)
    lo = arr.min(axis=2)
    near_white = lo >= 236
    labels, _ = ndimage.label(near_white)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border > 0])
    # Bande de contour : transparence progressive selon la « blancheur », couleur décontaminée.
    band = ndimage.binary_dilation(bg, iterations=2) & ~bg
    alpha = np.where(bg, 0.0, 1.0)
    a_band = np.clip((255 - lo) / 45.0, 0, 1)
    alpha = np.where(band, np.minimum(alpha, a_band), alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(band[..., None], np.clip((arr - (1 - alpha[..., None]) * 255) / safe, 0, 255), arr)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def load(path):
    im = Image.open(path).convert("RGBA")
    if im.getchannel("A").getextrema()[0] == 255:  # aucun pixel transparent : fond blanc à retirer
        im = remove_white_bg(im)
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


def split_sheet(sheet, cols=3, rows=2):
    """Repère chaque objet (zone opaque d'un seul tenant) et le range dans la case
    où se trouve son centre. Un objet qui déborde sur la case voisine reste entier,
    et les morceaux qui dépassent ne polluent pas la case d'à côté."""
    arr = np.array(sheet)
    labels, n = ndimage.label(arr[:, :, 3] > 0, structure=np.ones((3, 3)))
    H, W = labels.shape
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    centers = ndimage.center_of_mass(np.ones_like(labels), labels, range(1, n + 1))
    groups = [[] for _ in range(cols * rows)]
    for i, (size, (cy, cx)) in enumerate(zip(sizes, centers), start=1):
        if size < 40:  # poussières
            continue
        c = min(cols - 1, int(cx // (W / cols))) + cols * min(rows - 1, int(cy // (H / rows)))
        groups[c].append(i)
    cells = []
    for ids in groups:
        keep = np.isin(labels, ids)
        out = arr.copy()
        out[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
        im = Image.fromarray(out, "RGBA")
        cells.append(im.crop(bbox(im)))
    return cells


def process_sheet(path, key):
    cells = split_sheet(clean(load(path)))
    objs = cells[:4]
    # Même échelle pour les 4 stades : le tas de terre garde la même taille en grandissant.
    scale = min(SIZE * 0.94 / max(o.size) for o in objs)
    for i, o in enumerate(objs):
        save(place(o, scale, anchor_bottom=True), f"{key}-{i}.webp")
    save(icon(cells[4]), f"{key}-crop.webp")
    save(icon(cells[5]), f"{key}-seeds.webp")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    found = {"plants": [], "dishes": [], "ui": []}
    for path in sorted(RAW.glob("*.png")):
        name = path.stem
        if name.startswith("sheet-"):
            key = name[6:]
            process_sheet(path, key)
            found["plants"].append(key)
        elif name.startswith("dish-"):
            save(icon(clean(load(path))), f"{name}.webp")
            found["dishes"].append(name[5:])
        elif name.startswith("ui-"):
            save(icon(clean(load(path))), f"{name}.webp")
            found["ui"].append(name[3:])
        else:
            print(f"Ignoré (nom non reconnu) : {path.name}")
    (OUT / "manifest.js").write_text(
        "/* Généré par tools/process_images.py : liste des images disponibles. */\n"
        f"window.IMG = {json.dumps(found, ensure_ascii=False)};\n", encoding="utf-8")
    for k, v in found.items():
        print(f"{k}: {', '.join(v) or '(aucune)'}")


if __name__ == "__main__":
    main()
