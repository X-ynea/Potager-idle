-- Balades (Potager idle, v4) : tableau des scores entre amis, un par mini-jeu.
-- À lancer une fois dans Supabase › SQL Editor, après docs/objectifs.sql. Peut être relancé sans risque.
-- On garde le meilleur score de la semaine de chaque joueur pour chaque jeu (semaine du lundi au dimanche, heure de Paris).
-- Chacun ne voit que ses amis (sans les comptes bloqués). La version de test a ses propres scores.

create or replace function public.paris_week() returns date language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris')::date;
$$;

create table if not exists public.game_scores (
  user_id uuid not null references auth.users on delete cascade,
  week date not null,
  game text not null check (game in ('ruche', 'peche', 'foret', 'memory', 'cueillette')),
  score int not null check (score between 0 and 200),
  is_test boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, week, game)
);
alter table public.game_scores enable row level security;
-- Aucune lecture directe : tout passe par les fonctions ci-dessous.

-- 1. Envoyer son meilleur score de la semaine pour un jeu (il ne peut que monter).
create or replace function public.report_score(p_game text, p_score int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t boolean;
begin
  if me is null or p_game not in ('ruche', 'peche', 'foret', 'memory', 'cueillette') then return; end if;
  select coalesce(is_test, false) into t from profiles where user_id = me;
  insert into game_scores (user_id, week, game, score, is_test)
    values (me, paris_week(), p_game, least(greatest(coalesce(p_score, 0), 0), 200), coalesce(t, false))
  on conflict (user_id, week, game) do update set
    score = greatest(game_scores.score, excluded.score), is_test = excluded.is_test, updated_at = now();
  delete from game_scores where week < paris_week() - 28; -- ménage
end $$;

-- 2. Les scores de la semaine : moi et mes amis, pour chaque jeu (seulement ceux qui ont joué).
--    Renvoie { "ruche": [ { name, avatar, score, me }, … ], … }, trié du meilleur au moins bon.
create or replace function public.week_scores() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); res jsonb;
begin
  if me is null then raise exception 'non connecté'; end if;
  with circle as (
    select me as uid
    union
    select case when f.a = me then f.b else f.a end from friendships f
      where f.status = 'accepted' and me in (f.a, f.b) and not is_blocked(f.a, f.b)
  ), rows as (
    select s.game, jsonb_build_object('name', coalesce(p.name, 'Un ami'), 'avatar', p.avatar, 'score', s.score, 'me', s.user_id = me) as r, s.score, s.updated_at
    from circle c join game_scores s on s.user_id = c.uid and s.week = paris_week()
    left join profiles p on p.user_id = c.uid
  )
  select coalesce(jsonb_object_agg(game, list), '{}'::jsonb) into res
  from (select game, jsonb_agg(r order by score desc, updated_at) as list from rows group by game) g;
  return res;
end $$;

revoke all on function public.report_score(text, int), public.week_scores() from public, anon;
grant execute on function public.report_score(text, int), public.week_scores() to authenticated;
