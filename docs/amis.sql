-- Amis (Potager idle) : profils publics, liens d'amitié et fonctions serveur.
-- À lancer une fois dans Supabase › SQL Editor. Peut être relancé sans risque.

-- 1. Profil public : uniquement ce que les autres joueurs peuvent voir (jamais la sauvegarde).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  code text unique not null,
  name text not null default 'Jardinier',
  avatar text,
  title text,
  level int not null default 1,
  is_test boolean not null default false,
  last_seen timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 2. Liens d'amitié : a = qui demande, b = qui reçoit.
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  a uuid not null references auth.users on delete cascade,
  b uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (a <> b)
);
create unique index if not exists friendships_pair on public.friendships (least(a, b), greatest(a, b));
alter table public.friendships enable row level security;

-- Lecture directe : chacun ne voit que ses propres liens. Tout le reste passe par les fonctions ci-dessous.
drop policy if exists "voir ses liens" on public.friendships;
create policy "voir ses liens" on public.friendships for select using (auth.uid() in (a, b));
grant select on public.friendships to authenticated;

-- 3. Mettre à jour son profil public (crée le code ami à la première fois). Renvoie le code.
create or replace function public.upsert_profile(p_name text, p_avatar text, p_title text, p_level int, p_test boolean)
returns text language plpgsql security definer set search_path = public as $$
declare c text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select code into c from profiles where user_id = auth.uid();
  if c is null then
    loop
      c := '';
      for i in 1..5 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
      exit when not exists (select 1 from profiles where code = c);
    end loop;
  end if;
  insert into profiles (user_id, code, name, avatar, title, level, is_test, last_seen)
  values (auth.uid(), c, left(coalesce(nullif(trim(p_name), ''), 'Jardinier'), 20), left(p_avatar, 12000), left(p_title, 40), greatest(1, p_level), coalesce(p_test, false), now())
  on conflict (user_id) do update set name = excluded.name, avatar = excluded.avatar, title = excluded.title,
    level = excluded.level, is_test = excluded.is_test, last_seen = now();
  return c;
end $$;

-- 4. Chercher un joueur par code (exact) ou par pseudo (début du pseudo). 10 résultats au plus.
create or replace function public.search_players(q text)
returns table (user_id uuid, code text, name text, avatar text, level int)
language sql security definer set search_path = public as $$
  select p.user_id, p.code, p.name, p.avatar, p.level from profiles p
  where p.user_id <> auth.uid()
    and p.is_test = (select is_test from profiles where user_id = auth.uid())
    and length(trim(q)) >= 2
    and (upper(p.code) = upper(trim(q)) or p.name ilike replace(replace(trim(q), '%', ''), '_', '') || '%')
  order by (upper(p.code) = upper(trim(q))) desc, p.last_seen desc
  limit 10;
$$;

-- 5. Envoyer une demande d'ami (si l'autre avait déjà demandé : amitié acceptée directement).
create or replace function public.send_friend_request(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f friendships;
begin
  if me is null or target is null or target = me then raise exception 'demande impossible'; end if;
  if (select is_test from profiles where user_id = me) is distinct from (select is_test from profiles where user_id = target) then raise exception 'joueur introuvable'; end if;
  select * into f from friendships where least(a, b) = least(me, target) and greatest(a, b) = greatest(me, target);
  if found then
    if f.status = 'accepted' then return 'deja_amis'; end if;
    if f.b = me then update friendships set status = 'accepted' where id = f.id; return 'acceptee'; end if;
    return 'deja_envoyee';
  end if;
  if (select count(*) from friendships where a = me and status = 'pending') >= 20 then raise exception 'trop de demandes en attente'; end if;
  insert into friendships (a, b) values (me, target);
  return 'envoyee';
end $$;

-- 6. Accepter ou refuser une demande reçue.
create or replace function public.respond_friend_request(fid bigint, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if accept then update friendships set status = 'accepted' where id = fid and b = auth.uid() and status = 'pending';
  else delete from friendships where id = fid and b = auth.uid() and status = 'pending'; end if;
end $$;

-- 7. Annuler une demande envoyée ou retirer un ami.
create or replace function public.remove_friendship(fid bigint)
returns void language sql security definer set search_path = public as $$
  delete from friendships where id = fid and auth.uid() in (a, b);
$$;

-- 8. Liste : amis, demandes reçues (in) et envoyées (out), avec le profil public de l'autre joueur.
create or replace function public.list_friends()
returns table (id bigint, status text, direction text, user_id uuid, code text, name text, avatar text, title text, level int, last_seen timestamptz)
language sql security definer set search_path = public as $$
  select f.id, f.status,
    case when f.status = 'accepted' then 'friend' when f.a = auth.uid() then 'out' else 'in' end,
    p.user_id, p.code, p.name, p.avatar, p.title, p.level, p.last_seen
  from friendships f
  join profiles p on p.user_id = case when f.a = auth.uid() then f.b else f.a end
  where auth.uid() in (f.a, f.b)
  order by f.status, p.last_seen desc;
$$;

revoke all on function public.upsert_profile(text, text, text, int, boolean), public.search_players(text), public.send_friend_request(uuid),
  public.respond_friend_request(bigint, boolean), public.remove_friendship(bigint), public.list_friends() from public, anon;
grant execute on function public.upsert_profile(text, text, text, int, boolean), public.search_players(text), public.send_friend_request(uuid),
  public.respond_friend_request(bigint, boolean), public.remove_friendship(bigint), public.list_friends() to authenticated;
