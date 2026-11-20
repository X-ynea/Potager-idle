#!/usr/bin/env python3
"""Prépare les images du jeu à partir des fichiers déposés dans assets/raw/.

- sheet-<plante>.png : planche 3 colonnes x 2 lignes
    ligne 1 : graine, pousse, jeune plant
    ligne 2 : plante mûre dans la terre, récolte, sac de graines
  -> assets/img/<plante>-0..3.webp (stades), <plante>-crop.webp, <plante>-seeds.webp
- dish-<recette>.png, ui-<nom>.png : une image par fichier
  -> assets/img/dish-<recette>.webp, ui-<nom>.webp
- Écrit assets/img/manifest.js pour que le jeu sache quelles images existent.

Usage : python3 tools/process_images.py
"""
import json
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / "assets" / "raw", ROOT / "assets" / "img"
SIZE = 320          # taille de sortie (px), suffisant pour un téléphone
GROUND = 0.97       # ligne de sol commune aux stades (part de la hauteur)


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


def process_sheet(path, key):
    sheet = clean(Image.open(path))
    W, H = sheet.size
    cw, ch = W / 3, H / 2
    cells = [sheet.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))) for r in range(2) for c in range(3)]
    stages = [cells[0], cells[1], cells[2], cells[3]]
    objs = [s.crop(bbox(s)) for s in stages]
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
            save(icon(clean(Image.open(path))), f"{name}.webp")
            found["dishes"].append(name[5:])
        elif name.startswith("ui-"):
            save(icon(clean(Image.open(path))), f"{name}.webp")
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
