-- Jardin commun (Potager idle, v4) : un petit jardin partagé par 4 jardiniers au plus (celui qui le crée et 3 amis).
-- À lancer une fois dans Supabase › SQL Editor, après docs/balades.sql, puis lancer docs/jardin-commun-plantes.sql.
-- Peut être relancé sans risque.
--
-- Règles :
--   · on ne fait partie que d'un seul jardin commun ; seul celui qui l'a créé invite (ses amis) et peut retirer un membre ;
--     chacun peut partir ; si le créateur part, le plus ancien membre prend sa place ; le dernier qui part efface le jardin ;
--   · 6 bacs ; graines gratuites, mais 8 graines plantées par jour et par joueur au plus ;
--   · on ne plante que des plantes de base (jamais d'hybride), débloquées au niveau du membre le moins avancé,
--     et les plantes de saison seulement pendant leur saison ;
--   · pousse comme dans son jardin : 4 fois moins vite quand la terre est sèche (l'eau tient 10 min),
--     25 % plus vite pour une plante de saison ; aucune amélioration personnelle ;
--   · les récoltes vont dans le panier commun (60 objets au plus), qui ne sert qu'aux commandes ;
--   · 2 commandes par jour (jour de Paris), et c'est tout ;
--   · à chaque commande livrée, chaque membre qui a planté au moins 3 graines depuis la commande précédente
--     reçoit une récompense (pièces, XP, parfois un ingrédient de balade), et la déco « Banc de l'amitié »
--     une fois que le jardin a livré 10 commandes. Le jeu la récupère avec sg_claim().
-- Tout se fait avec l'heure du serveur. Rien ne se lit directement : tout passe par les fonctions ci-dessous.

create or replace function public.paris_today() returns date language sql stable as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;
-- Saison de la semaine, comme dans le jeu (js/seasons.js) : le lundi 16 novembre 2026 commence une semaine d'automne.
create or replace function public.paris_season() returns text language sql stable as $$
  select (array['printemps', 'ete', 'automne', 'hiver'])[((((floor((paris_today() - date '2026-11-16') / 7.0))::int + 2) % 4 + 4) % 4) + 1];
$$;
create or replace function public.now_ms() returns bigint language sql stable as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

-- Plantes que l'on peut cultiver au jardin commun (rempli par docs/jardin-commun-plantes.sql).
create table if not exists public.sg_plants (
  key text primary key,
  lvl int not null,
  time int not null,        -- secondes de pousse
  sell int not null,
  xp int not null,
  season text,              -- saison de la plante (bonus de 25 %)
  only_season boolean not null default false
);
alter table public.sg_plants enable row level security;

create table if not exists public.shared_gardens (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 24),
  owner uuid not null,
  is_test boolean not null default false,
  plots jsonb not null default '[{},{},{},{},{},{}]'::jsonb, -- { seed, by, grown (ms), last (ms), water (ms) }
  basket jsonb not null default '{}'::jsonb,
  orders jsonb not null default '[]'::jsonb,               -- [{ items, coins, xp, wild, done }]
  orders_day date,
  delivered int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.shared_garden_members (
  garden_id bigint not null references public.shared_gardens on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  plant_day date,
  planted_today int not null default 0,
  contrib int not null default 0, -- graines plantées depuis la commande précédente
  primary key (garden_id, user_id),
  unique (user_id)
);
create table if not exists public.shared_garden_invites (
  garden_id bigint not null references public.shared_gardens on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);
create table if not exists public.shared_garden_rewards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  garden_name text,
  coins int not null default 0,
  xp int not null default 0,
  wild text,
  deco text,
  created_at timestamptz not null default now()
);
alter table public.shared_gardens enable row level security;
alter table public.shared_garden_members enable row level security;
alter table public.shared_garden_invites enable row level security;
alter table public.shared_garden_rewards enable row level security;

-- Mon jardin commun (ou null).
create or replace function public.sg_mine() returns bigint language sql stable security definer set search_path = public as $$
  select garden_id from shared_garden_members where user_id = auth.uid();
$$;

-- Avancement d'un bac jusqu'à maintenant (même calcul que dans le jeu).
create or replace function public.sg_grow(p jsonb, saison text) returns jsonb language plpgsql stable set search_path = public as $$
declare t bigint := now_ms(); last bigint; w bigint; wet bigint; dry bigint; s numeric := 1; pl sg_plants;
begin
  if p ->> 'seed' is null then return p; end if;
  select * into pl from sg_plants where key = p ->> 'seed';
  if pl.season = saison then s := 1.25; end if;
  last := coalesce((p ->> 'last')::bigint, t); w := coalesce((p ->> 'water')::bigint, 0);
  wet := greatest(0, least(t, w) - last);
  dry := greatest(0, t - greatest(last, w));
  return p || jsonb_build_object('grown', coalesce((p ->> 'grown')::numeric, 0) + (wet + dry * 0.25) * s, 'last', t);
end $$;

-- Plantes autorisées : plantes de base débloquées au niveau du membre le moins avancé, de saison seulement à leur saison.
create or replace function public.sg_allowed(gid bigint) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(key order by lvl, key), '{}') from sg_plants
  where lvl <= (select coalesce(min(p.level), 1) from shared_garden_members m left join profiles p on p.user_id = m.user_id where m.garden_id = gid)
    and (not only_season or season = paris_season());
$$;

-- Une commande : 2 ou 3 plantes du jardin commun (jamais d'ingrédient de balade ni d'hybride, puisque rien ne vient
-- de l'inventaire des joueurs). L'ingrédient de balade éventuel est une récompense, pas une demande.
create or replace function public.sg_make_order(allowed text[], m int) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare n int; items jsonb := '{}'::jsonb; k text; q int; v_val int := 0; v_xp int := 0;
  wilds text[] := array['algue', 'cresson', 'menthe', 'ail', 'mure', 'chataigne', 'noisette', 'miel'];
begin
  n := least(array_length(allowed, 1), 2 + floor(random() * 2)::int);
  for k in select a from unnest(allowed) a order by random() limit n loop
    q := 1 + floor(random() * (1 + m))::int; -- de 1 à (1 + nombre de membres)
    items := items || jsonb_build_object(k, q);
    select v_val + q * p.sell, v_xp + q * p.xp into v_val, v_xp from sg_plants p where p.key = k;
  end loop;
  return jsonb_build_object('items', items, 'coins', round(v_val * 1.6 + 10), 'xp', round(v_xp * 1.3 + 5),
    'wild', case when random() < .35 then wilds[1 + floor(random() * array_length(wilds, 1))::int] end, 'done', false);
end $$;

-- Les 2 commandes du jour (créées à la première ouverture de la journée). Une commande pas encore livrée
-- qui demande une plante qu'on ne peut plus planter (un jardinier de plus petit niveau est arrivé) est refaite.
create or replace function public.sg_daily_orders(gid bigint) returns void language plpgsql security definer set search_path = public as $$
declare g shared_gardens; allowed text[]; m int; o jsonb; res jsonb := '[]'::jsonb; changed boolean := false;
begin
  select * into g from shared_gardens where id = gid for update;
  allowed := sg_allowed(gid);
  if coalesce(array_length(allowed, 1), 0) = 0 then allowed := array['radis', 'laitue']; end if;
  select count(*) into m from shared_garden_members where garden_id = gid;
  if g.orders_day is distinct from paris_today() then
    update shared_gardens set orders = jsonb_build_array(sg_make_order(allowed, m), sg_make_order(allowed, m)), orders_day = paris_today() where id = gid;
    return;
  end if;
  for o in select * from jsonb_array_elements(g.orders) loop
    if not (o ->> 'done')::boolean and exists (select 1 from jsonb_object_keys(o -> 'items') k where not (k = any (allowed))) then
      o := sg_make_order(allowed, m); changed := true;
    end if;
    res := res || jsonb_build_array(o);
  end loop;
  if changed then update shared_gardens set orders = res where id = gid; end if;
end $$;

-- 1. Tout ce qu'il faut pour afficher le jardin commun (ou les invitations reçues si je n'en ai pas).
create or replace function public.sg_state() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid bigint; g shared_gardens; saison text := paris_season(); plots jsonb := '[]'::jsonb; p jsonb; invites jsonb; members jsonb; pending jsonb;
begin
  if me is null then raise exception 'non connecté'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('garden_id', i.garden_id, 'name', sg.name, 'by', coalesce(pr.name, 'Un ami'), 'avatar', pr.avatar,
           'members', (select count(*) from shared_garden_members where garden_id = i.garden_id)) order by i.created_at), '[]'::jsonb)
    into invites from shared_garden_invites i join shared_gardens sg on sg.id = i.garden_id left join profiles pr on pr.user_id = i.invited_by
    where i.user_id = me;
  gid := sg_mine();
  if gid is null then return jsonb_build_object('garden', null, 'invites', invites, 'now', now_ms(), 'season', saison); end if;
  perform sg_daily_orders(gid);
  select * into g from shared_gardens where id = gid;
  -- Le créateur a supprimé son compte : le plus ancien membre prend sa place.
  if not exists (select 1 from shared_garden_members where garden_id = gid and user_id = g.owner) then
    update shared_gardens set owner = (select user_id from shared_garden_members where garden_id = gid order by joined_at limit 1) where id = gid returning * into g;
  end if;
  for p in select * from jsonb_array_elements(g.plots) loop plots := plots || jsonb_build_array(sg_grow(p, saison)); end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', coalesce(pr.name, 'Jardinier'), 'avatar', pr.avatar, 'level', coalesce(pr.level, 1),
           'me', m.user_id = me, 'owner', m.user_id = g.owner,
           'planted', case when m.plant_day = paris_today() then m.planted_today else 0 end, 'contrib', m.contrib) order by m.joined_at), '[]'::jsonb)
    into members from shared_garden_members m left join profiles pr on pr.user_id = m.user_id where m.garden_id = gid;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.user_id, 'name', coalesce(pr.name, 'Jardinier'), 'avatar', pr.avatar)), '[]'::jsonb)
    into pending from shared_garden_invites i left join profiles pr on pr.user_id = i.user_id where i.garden_id = gid;
  return jsonb_build_object('garden', jsonb_build_object('id', g.id, 'name', g.name, 'plots', plots, 'basket', g.basket, 'orders', g.orders, 'delivered', g.delivered),
    'members', members, 'pending', pending, 'allowed', to_jsonb(sg_allowed(gid)), 'invites', invites, 'now', now_ms(), 'season', saison);
end $$;

-- 2. Créer un jardin commun (je n'en ai pas encore).
create or replace function public.sg_create(p_name text) returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid bigint; t boolean;
begin
  if me is null then raise exception 'non connecté'; end if;
  if sg_mine() is not null then raise exception 'deja_jardin'; end if;
  select coalesce(is_test, false) into t from profiles where user_id = me;
  insert into shared_gardens (name, owner, is_test) values (left(coalesce(nullif(trim(p_name), ''), 'Jardin commun'), 24), me, coalesce(t, false)) returning id into gid;
  insert into shared_garden_members (garden_id, user_id) values (gid, me);
  delete from shared_garden_invites where user_id = me;
  return gid;
end $$;

-- 3. Inviter un ami (créateur seulement, 4 jardiniers au plus en comptant les invitations en attente).
create or replace function public.sg_invite(target uuid) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid bigint := sg_mine();
begin
  if gid is null or (select owner from shared_gardens where id = gid) <> me then raise exception 'pas_createur'; end if;
  if target is null or not are_friends(me, target) or is_blocked(me, target) then raise exception 'pas ami'; end if;
  if exists (select 1 from shared_garden_members where user_id = target) then raise exception 'deja_jardin'; end if;
  if (select count(*) from shared_garden_members where garden_id = gid) + (select count(*) from shared_garden_invites where garden_id = gid) >= 4 then raise exception 'jardin_plein'; end if;
  insert into shared_garden_invites (garden_id, user_id, invited_by) values (gid, target, me) on conflict do nothing;
end $$;

-- 4. Annuler une invitation envoyée (créateur).
create or replace function public.sg_uninvite(target uuid) returns void language plpgsql security definer set search_path = public as $$
declare gid bigint := sg_mine();
begin
  if gid is null or (select owner from shared_gardens where id = gid) <> auth.uid() then raise exception 'pas_createur'; end if;
  delete from shared_garden_invites where garden_id = gid and user_id = target;
end $$;

-- 5. Répondre à une invitation.
create or replace function public.sg_answer(p_garden bigint, accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from shared_garden_invites where garden_id = p_garden and user_id = me) then raise exception 'invitation_introuvable'; end if;
  delete from shared_garden_invites where garden_id = p_garden and user_id = me;
  if not accept then return; end if;
  if sg_mine() is not null then raise exception 'deja_jardin'; end if;
  if (select count(*) from shared_garden_members where garden_id = p_garden) >= 4 then raise exception 'jardin_plein'; end if;
  insert into shared_garden_members (garden_id, user_id) values (p_garden, me);
  delete from shared_garden_invites where user_id = me; -- les autres invitations tombent
end $$;

-- 6. Quitter le jardin (ou retirer un membre, pour le créateur).
create or replace function public.sg_leave(target uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid bigint := sg_mine(); who uuid := coalesce(target, me); g shared_gardens;
begin
  if gid is null then return; end if;
  select * into g from shared_gardens where id = gid;
  if who <> me and g.owner <> me then raise exception 'pas_createur'; end if;
  delete from shared_garden_members where garden_id = gid and user_id = who;
  if not exists (select 1 from shared_garden_members where garden_id = gid) then delete from shared_gardens where id = gid; return; end if;
  if who = g.owner then
    update shared_gardens set owner = (select user_id from shared_garden_members where garden_id = gid order by joined_at limit 1) where id = gid;
  end if;
end $$;

-- 7. Planter (graines gratuites, 8 par jour et par joueur).
create or replace function public.sg_plant(slot int, p_seed text) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid bigint := sg_mine(); g shared_gardens; m shared_garden_members; t bigint := now_ms();
begin
  if gid is null then raise exception 'pas_jardin'; end if;
  if slot < 0 or slot > 5 then raise exception 'bac_invalide'; end if;
  if not (p_seed = any (sg_allowed(gid))) then raise exception 'graine_interdite'; end if;
  select * into m from shared_garden_members where garden_id = gid and user_id = me for update;
  if m.plant_day = paris_today() and m.planted_today >= 8 then raise exception 'trop_plante'; end if;
  select * into g from shared_gardens where id = gid for update;
  if g.plots -> slot ->> 'seed' is not null then raise exception 'bac_occupe'; end if;
  update shared_gardens set plots = jsonb_set(plots, array[slot::text], jsonb_build_object('seed', p_seed, 'by', me, 'grown', 0, 'last', t, 'water', t + 600000)) where id = gid;
  update shared_garden_members set planted_today = case when plant_day = paris_today() then planted_today + 1 else 1 end,
    plant_day = paris_today(), contrib = contrib + 1 where garden_id = gid and user_id = me;
end $$;

-- 8. Arroser un bac (l'eau tient 10 min).
create or replace function public.sg_water(slot int) returns void language plpgsql security definer set search_path = public as $$
declare gid bigint := sg_mine(); g shared_gardens; p jsonb;
begin
  if gid is null then raise exception 'pas_jardin'; end if;
  select * into g from shared_gardens where id = gid for update;
  p := g.plots -> slot; if p ->> 'seed' is null then return; end if;
  p := sg_grow(p, paris_season()) || jsonb_build_object('water', now_ms() + 600000);
  update shared_gardens set plots = jsonb_set(plots, array[slot::text], p) where id = gid;
end $$;

-- 9. Récolter un bac mûr : la récolte va dans le panier commun (60 objets au plus).
create or replace function public.sg_harvest(slot int) returns text language plpgsql security definer set search_path = public as $$
declare gid bigint := sg_mine(); g shared_gardens; p jsonb; k text; total int;
begin
  if gid is null then raise exception 'pas_jardin'; end if;
  select * into g from shared_gardens where id = gid for update;
  p := sg_grow(g.plots -> slot, paris_season()); k := p ->> 'seed';
  if k is null then raise exception 'bac_vide'; end if;
  if (p ->> 'grown')::numeric < (select time from sg_plants where key = k) * 1000 then raise exception 'pas_mur'; end if;
  select coalesce(sum(value::int), 0) into total from jsonb_each_text(g.basket);
  if total >= 60 then raise exception 'panier_plein'; end if;
  update shared_gardens set plots = jsonb_set(plots, array[slot::text], '{}'::jsonb),
    basket = basket || jsonb_build_object(k, coalesce((basket ->> k)::int, 0) + 1) where id = gid;
  return k;
end $$;

-- 10. Livrer une commande du jour avec le panier : récompense pour chaque membre qui a planté 3 graines ou plus.
create or replace function public.sg_deliver(idx int) returns int language plpgsql security definer set search_path = public as $$
declare gid bigint := sg_mine(); g shared_gardens; o jsonb; it record; b jsonb; n int := 0;
begin
  if gid is null then raise exception 'pas_jardin'; end if;
  select * into g from shared_gardens where id = gid for update;
  if g.orders_day is distinct from paris_today() then raise exception 'commande_expiree'; end if;
  o := g.orders -> idx;
  if o is null or (o ->> 'done')::boolean then raise exception 'commande_introuvable'; end if;
  b := g.basket;
  for it in select key, value::int as q from jsonb_each_text(o -> 'items') loop
    if coalesce((b ->> it.key)::int, 0) < it.q then raise exception 'panier_incomplet'; end if;
    b := case when (b ->> it.key)::int = it.q then b - it.key else b || jsonb_build_object(it.key, (b ->> it.key)::int - it.q) end;
  end loop;
  update shared_gardens set basket = b, orders = jsonb_set(orders, array[idx::text, 'done'], 'true'::jsonb), delivered = delivered + 1 where id = gid
    returning * into g;
  insert into shared_garden_rewards (user_id, garden_name, coins, xp, wild, deco)
    select m.user_id, g.name, (o ->> 'coins')::int, (o ->> 'xp')::int, o ->> 'wild', case when g.delivered >= 10 then 'friend_bench' end
    from shared_garden_members m where m.garden_id = gid and m.contrib >= 3;
  get diagnostics n = row_count;
  update shared_garden_members set contrib = 0 where garden_id = gid;
  return n; -- nombre de jardiniers récompensés
end $$;

-- 11. Récupérer ses récompenses (une seule fois chacune).
create or replace function public.sg_claim() returns jsonb language sql security definer set search_path = public as $$
  with r as (delete from shared_garden_rewards where user_id = auth.uid() returning *)
  select coalesce(jsonb_agg(jsonb_build_object('garden', garden_name, 'coins', coins, 'xp', xp, 'wild', wild, 'deco', deco) order by created_at), '[]'::jsonb) from r;
$$;

revoke all on function public.sg_mine(), public.sg_grow(jsonb, text), public.sg_allowed(bigint), public.sg_make_order(text[], int), public.sg_daily_orders(bigint) from public, anon, authenticated;
revoke all on function public.sg_state(), public.sg_create(text), public.sg_invite(uuid), public.sg_uninvite(uuid), public.sg_answer(bigint, boolean),
  public.sg_leave(uuid), public.sg_plant(int, text), public.sg_water(int), public.sg_harvest(int), public.sg_deliver(int), public.sg_claim() from public, anon;
grant execute on function public.sg_state(), public.sg_create(text), public.sg_invite(uuid), public.sg_uninvite(uuid), public.sg_answer(bigint, boolean),
  public.sg_leave(uuid), public.sg_plant(int, text), public.sg_water(int), public.sg_harvest(int), public.sg_deliver(int), public.sg_claim() to authenticated;
