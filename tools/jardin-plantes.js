/* Génère docs/jardin-commun-plantes.sql : les plantes cultivables au jardin commun (plantes de base, pas d'hybride),
   avec leur niveau, leur temps de pousse, leur prix, leur XP et leur saison.
   Usage : node tools/jardin-plantes.js
   À relancer (puis à lancer dans Supabase) après chaque changement de plante. */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = {};
eval(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8") + "\n;Object.assign(global,{PLANTS});");
const q = s => s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`;
const rows = Object.entries(PLANTS).filter(([, d]) => !d.hybrid && !d.tuto)
  .map(([k, d]) => `  (${q(k)}, ${d.lvl}, ${d.time}, ${d.sell}, ${d.xp}, ${q(d.season)}, ${!!d.only})`);
const sql = `-- Plantes du jardin commun (généré par tools/jardin-plantes.js : ne pas modifier à la main).
-- À lancer dans Supabase › SQL Editor après docs/jardin-commun.sql, et de nouveau après chaque changement de plante.
begin;
delete from public.sg_plants;
insert into public.sg_plants (key, lvl, time, sell, xp, season, only_season) values
${rows.join(",\n")};
commit;
`;
fs.writeFileSync(path.join(ROOT, "docs/jardin-commun-plantes.sql"), sql);
console.log(`docs/jardin-commun-plantes.sql : ${rows.length} plantes`);
