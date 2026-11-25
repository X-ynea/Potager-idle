-- « J'aime ton jardin » (Potager idle) : un cœur par ami et par semaine, sans bonus.
-- À lancer une fois dans Supabase › SQL Editor, après docs/arrosage.sql. Peut être relancé sans risque.
-- Semaine = du lundi au dimanche, heure de Paris (comme les saisons).

create or replace function public.paris_week() returns date language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris')::date;
$$;

create table if not exists public.garden_likes (
  id bigint generated always as identity primary key,
  giver uuid not null references auth.users on delete cascade,
  receiver uuid not null references auth.users on delete cascade,
  week date not null default paris_week(),
  created_at timestamptz not null default now(),
  check (giver <> receiver),
  unique (giver, receiver, week)
);
create index if not exists garden_likes_receiver on public.garden_likes (receiver, created_at desc);
alter table public.garden_likes enable row level security;
-- Aucune lecture directe : tout passe par les fonctions ci-dessous.

-- 1. Aimer le jardin d'un ami (une fois par semaine). Renvoie 'ok' ; erreur 'deja_aime' sinon.
create or replace function public.like_garden(target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or target is null or target = me or not are_friends(me, target) or is_blocked(me, target) then raise exception 'pas ami'; end if;
  insert into garden_likes (giver, receiver) values (me, target) on conflict (giver, receiver, week) do nothing;
  if not found then raise exception 'deja_aime'; end if;
  delete from garden_likes where created_at < now() - interval '30 days'; -- ménage
  return 'ok';
end $$;

-- 2. Ai-je déjà aimé ce jardin cette semaine ?
create or replace function public.liked_this_week(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from garden_likes where giver = auth.uid() and receiver = target and week = paris_week());
$$;

-- 3. Cœurs reçus ces 8 derniers jours (avec le profil public de l'ami).
create or replace function public.my_likes()
returns table (id bigint, giver uuid, name text, avatar text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.giver, coalesce(p.name, 'Un ami'), p.avatar, l.created_at
  from garden_likes l left join profiles p on p.user_id = l.giver
  where l.receiver = auth.uid() and l.created_at > now() - interval '8 days'
  order by l.created_at;
$$;

revoke all on function public.like_garden(uuid), public.liked_this_week(uuid), public.my_likes() from public, anon;
grant execute on function public.like_garden(uuid), public.liked_this_week(uuid), public.my_likes() to authenticated;
