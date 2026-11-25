/* Génère docs/echanges-valeurs.sql : la liste des prix que le serveur utilise pour vérifier les échanges
   (valeur = prix de vente au marché), avec ce qu'il faut avoir découvert pour recevoir chaque objet.
   Usage : node tools/trade-values.js
   À relancer (puis à lancer dans Supabase) après chaque changement de prix, de plante ou de recette. */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = {};
eval(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8") + "\n;Object.assign(global,{PLANTS,RECIPES});");

// Hybrides nécessaires pour « connaître » un objet (anti-spoil).
const hybNeeds = k => PLANTS[k] ? (PLANTS[k].hybrid ? [k] : []) : [...new Set(Object.keys(RECIPES[k].need).flatMap(hybNeeds))];
const rows = [];
for (const [k, d] of Object.entries(PLANTS)) if (!d.tuto) rows.push([k, d.sell, 0, hybNeeds(k)]);
for (const [k, d] of Object.entries(RECIPES)) rows.push([k, d.sell, d.lvl, hybNeeds(k)]);

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const sql = `-- Prix des objets échangeables (généré par tools/trade-values.js : ne pas modifier à la main).
-- À lancer dans Supabase › SQL Editor après docs/echanges.sql, et de nouveau après chaque changement de prix.
-- key = plante ou recette, value = prix de vente au marché, lvl = niveau où un plat se débloque,
-- needs = hybrides à avoir découverts pour recevoir l'objet.
begin;
delete from public.item_values;
insert into public.item_values (key, value, lvl, needs) values
${rows.map(([k, v, l, n]) => `  (${q(k)}, ${v}, ${l}, array[${n.map(q).join(", ")}]::text[])`).join(",\n")};
commit;
`;
fs.writeFileSync(path.join(ROOT, "docs/echanges-valeurs.sql"), sql);
console.log(`docs/echanges-valeurs.sql : ${rows.length} objets`);
