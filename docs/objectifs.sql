-- Objectifs de la semaine (Potager idle) : un objectif entre amis et un objectif de tous les joueurs.
-- À lancer une fois dans Supabase › SQL Editor, après docs/jaime.sql. Peut être relancé sans risque.
-- Le jeu compte ses propres progrès de la semaine (f = objectif entre amis, g = objectif de tous) et les envoie ici.
-- Le type d'objectif et les cibles sont choisis par le jeu (js/goals.js) ; la part d'un même joueur est plafonnée
-- dans les totaux (cap_f, cap_g). Semaine = du lundi au dimanche, heure de Paris.

create or replace function public.paris_week() returns date language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris')::date;
$$;

create table if not exists public.week_progress (
  user_id uuid not null references auth.users on delete cascade,
  week date not null,
  f int not null default 0 check (f >= 0),
  g int not null default 0 check (g >= 0),
  is_test boolean not null default false, -- la version de test a ses propres objectifs
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);
create index if not exists week_progress_week on public.week_progress (week, is_test);
alter table public.week_progress enable row level security;
-- Aucune lecture directe : tout passe par les fonctions ci-dessous.

-- 1. Envoyer ses progrès de la semaine en cours (ils ne peuvent que monter).
create or replace function public.report_progress(p_week date, p_f int, p_g int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t boolean;
begin
  if me is null or p_week is distinct from paris_week() then return; end if;
  select coalesce(is_test, false) into t from profiles where user_id = me;
  insert into week_progress (user_id, week, f, g, is_test)
    values (me, p_week, least(greatest(coalesce(p_f, 0), 0), 100000), least(greatest(coalesce(p_g, 0), 0), 100000), coalesce(t, false))
  on conflict (user_id, week) do update set
    f = greatest(week_progress.f, excluded.f), g = greatest(week_progress.g, excluded.g), is_test = excluded.is_test, updated_at = now();
  delete from week_progress where week < paris_week() - 28; -- ménage
end $$;

-- 2. Où en sont les objectifs : mon cercle (moi et mes amis, avec la part de chacun), et tous les joueurs.
create or replace function public.week_goals(p_week date, cap_f int, cap_g int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); t boolean; members jsonb; ftotal int; gtotal int; plast int; pnow int;
begin
  if me is null then raise exception 'non connecté'; end if;
  select coalesce(is_test, false) into t from profiles where user_id = me;
  t := coalesce(t, false);
  with circle as (
    select me as uid
    union
    select case when f.a = me then f.b else f.a end from friendships f
      where f.status = 'accepted' and me in (f.a, f.b) and not is_blocked(f.a, f.b)
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.name, 'Moi'), 'avatar', p.avatar, 'n', coalesce(w.f, 0), 'me', c.uid = me)
           order by coalesce(w.f, 0) desc), '[]'::jsonb),
         coalesce(sum(least(coalesce(w.f, 0), cap_f)), 0)
    into members, ftotal
    from circle c left join profiles p on p.user_id = c.uid left join week_progress w on w.user_id = c.uid and w.week = p_week;
  select coalesce(sum(least(g, cap_g)), 0), count(*) filter (where g > 0) into gtotal, pnow from week_progress where week = p_week and is_test = t;
  select count(*) into plast from week_progress where week = p_week - 7 and g > 0 and is_test = t;
  return jsonb_build_object('members', members, 'ftotal', ftotal, 'gtotal', gtotal, 'players_last', plast, 'players_now', pnow);
end $$;

revoke all on function public.report_progress(date, int, int), public.week_goals(date, int, int) from public, anon;
grant execute on function public.report_progress(date, int, int), public.week_goals(date, int, int) to authenticated;
