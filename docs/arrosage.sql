-- Arrosage entre amis (Potager idle).
-- À lancer une fois dans Supabase › SQL Editor, après docs/visites.sql. Peut être relancé sans risque.
-- Règles (jour = date de Paris, comptée par le serveur) :
--   · un joueur arrose au plus 2 jardins d'amis par jour ;
--   · un jardin reçoit au plus 2 arrosages d'amis par jour ;
--   · une même personne arrose un même jardin une fois par jour au plus.

-- 1. Arrosages : qui a arrosé qui, et quand.
create table if not exists public.garden_waterings (
  id bigint generated always as identity primary key,
  giver uuid not null references auth.users on delete cascade,
  receiver uuid not null references auth.users on delete cascade,
  day date not null default (now() at time zone 'Europe/Paris')::date,
  created_at timestamptz not null default now(),
  check (giver <> receiver),
  unique (giver, receiver, day)
);
create index if not exists garden_waterings_receiver on public.garden_waterings (receiver, created_at desc);
create index if not exists garden_waterings_giver_day on public.garden_waterings (giver, day);
alter table public.garden_waterings enable row level security;
-- Aucune lecture directe : tout passe par les fonctions ci-dessous.

create or replace function public.paris_today() returns date language sql stable as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

-- 2. Arroser le jardin d'un ami. Renvoie 'ok', ou une erreur : 'deja_arrose', 'jardin_plein', 'trop_arrose'.
create or replace function public.water_friend(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d date := paris_today();
begin
  if me is null or target is null or target = me or not are_friends(me, target) or is_blocked(me, target) then raise exception 'pas ami'; end if;
  -- Un verrou par jardin et par joueur : deux arrosages simultanés ne dépassent jamais les limites.
  perform pg_advisory_xact_lock(hashtext('water-r-' || target::text));
  perform pg_advisory_xact_lock(hashtext('water-g-' || me::text));
  if exists (select 1 from garden_waterings where giver = me and receiver = target and day = d) then raise exception 'deja_arrose'; end if;
  if (select count(*) from garden_waterings where receiver = target and day = d) >= 2 then raise exception 'jardin_plein'; end if;
  if (select count(*) from garden_waterings where giver = me and day = d) >= 2 then raise exception 'trop_arrose'; end if;
  insert into garden_waterings (giver, receiver, day) values (me, target, d);
  delete from garden_waterings where created_at < now() - interval '7 days'; -- ménage
  return 'ok';
end $$;

-- 3. Arrosages reçus ces dernières 24 h (avec le profil public de l'ami), pour appliquer le bonus.
create or replace function public.my_waterings()
returns table (id bigint, giver uuid, name text, avatar text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select w.id, w.giver, coalesce(p.name, 'Un ami'), p.avatar, w.created_at
  from garden_waterings w left join profiles p on p.user_id = w.giver
  where w.receiver = auth.uid() and w.created_at > now() - interval '1 day'
  order by w.created_at;
$$;

-- 4. Jardin d'un ami (remplace la version de docs/visites.sql) : on y ajoute ses arrosages
--    et l'état du bouton Arroser (déjà arrosé, jardin plein, trop arrosé aujourd'hui).
create or replace function public.friend_garden(target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d jsonb; u timestamptz; me uuid := auth.uid(); today date := paris_today();
begin
  if me is null or target is null or not are_friends(me, target) or is_blocked(me, target) then
    raise exception 'pas ami';
  end if;
  select s.data, s.updated_at into d, u from saves s where s.user_id = target;
  if d is null then return null; end if;
  return jsonb_build_object(
    'plots', coalesce((select jsonb_agg(jsonb_build_object(
        'seed', p.v->'seed', 'grown', p.v->'grown', 'last', p.v->'last', 'waterUntil', p.v->'waterUntil', 'weed', p.v->'weed') order by p.i)
      from jsonb_array_elements(case when jsonb_typeof(d->'plots') = 'array' then d->'plots' else '[]'::jsonb end) with ordinality as p(v, i)), '[]'::jsonb),
    'decoSlots', d->'decoSlots', 'decoOff', d->'decoOff', 'decoFlip', d->'decoFlip',
    'upg', jsonb_build_object('water', coalesce(d#>'{upg,water}', '0'), 'fert', coalesce(d#>'{upg,fert}', '0'), 'auto', coalesce(d#>'{upg,auto}', '0')),
    'discovered', coalesce(d->'discovered', '[]'::jsonb), 'hybrids', coalesce(d->'hybrids', '[]'::jsonb), 'goldenFound', coalesce(d->'goldenFound', '[]'::jsonb),
    'level', d->'level', 'last', d->'last', 'updated_at', u,
    'waterings', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'at', w.created_at, 'name', coalesce(p.name, 'Un ami'), 'avatar', p.avatar, 'mine', w.giver = me) order by w.created_at)
      from garden_waterings w left join profiles p on p.user_id = w.giver
      where w.receiver = target and w.created_at > now() - interval '1 day'), '[]'::jsonb),
    'water', jsonb_build_object(
      'mine_today', exists (select 1 from garden_waterings where giver = me and receiver = target and day = today),
      'received_today', (select count(*) from garden_waterings where receiver = target and day = today),
      'given_today', (select count(*) from garden_waterings where giver = me and day = today)));
end $$;

revoke all on function public.water_friend(uuid), public.my_waterings(), public.friend_garden(uuid) from public, anon;
grant execute on function public.water_friend(uuid), public.my_waterings(), public.friend_garden(uuid) to authenticated;
