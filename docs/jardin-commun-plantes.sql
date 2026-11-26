-- Plantes du jardin commun (généré par tools/jardin-plantes.js : ne pas modifier à la main).
-- À lancer dans Supabase › SQL Editor après docs/jardin-commun.sql, et de nouveau après chaque changement de plante.
begin;
delete from public.sg_plants;
insert into public.sg_plants (key, lvl, time, sell, xp, season, only_season) values
  ('radis', 1, 180, 5, 2, 'printemps', false),
  ('laitue', 1, 360, 9, 3, 'printemps', false),
  ('patate', 2, 480, 11, 3, 'automne', false),
  ('carotte', 4, 540, 14, 4, 'hiver', false),
  ('ble', 5, 720, 17, 5, 'hiver', false),
  ('fraise', 7, 900, 24, 6, 'printemps', false),
  ('basilic', 9, 1080, 28, 7, 'ete', false),
  ('tomate', 11, 1350, 36, 8, 'ete', false),
  ('tournesol', 18, 2700, 80, 16, 'ete', false),
  ('myrtille', 13, 1800, 48, 10, 'automne', false),
  ('lavande', 15, 2160, 58, 12, 'ete', false),
  ('potiron', 19, 3600, 110, 20, 'automne', false),
  ('petitpois', 3, 600, 15, 4, 'printemps', true),
  ('courgette', 6, 780, 19, 5, 'ete', true),
  ('betterave', 8, 900, 23, 6, 'automne', true),
  ('poireau', 10, 1140, 30, 7, 'hiver', true),
  ('asperge', 14, 1980, 52, 11, 'printemps', true),
  ('melon', 16, 2520, 72, 14, 'ete', true),
  ('champignon', 20, 2880, 90, 17, 'automne', true),
  ('chou', 22, 3300, 100, 19, 'hiver', true);
commit;
