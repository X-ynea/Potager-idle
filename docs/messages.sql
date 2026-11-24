-- Messages entre amis et blocage (Potager idle). À lancer après docs/amis.sql, dans Supabase › SQL Editor.
-- Peut être relancé sans risque.

-- 1. Messages : seulement entre amis, 500 caractères au plus, gardés 30 jours.
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users on delete cascade,
  receiver uuid not null references auth.users on delete cascade,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_pair on public.messages (least(sender, receiver), greatest(sender, receiver), id);
create index if not exists messages_unread on public.messages (receiver) where read_at is null;
alter table public.messages enable row level security;
drop policy if exists "voir ses messages" on public.messages;
create policy "voir ses messages" on public.messages for select using (auth.uid() in (sender, receiver));
grant select on public.messages to authenticated;

-- 2. Blocages : un joueur bloqué ne peut plus envoyer de demande ni de message, ni te trouver.
create table if not exists public.blocks (
  blocker uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "voir ses blocages" on public.blocks;
create policy "voir ses blocages" on public.blocks for select using (auth.uid() = blocker);
grant select on public.blocks to authenticated;

create or replace function public.is_blocked(x uuid, y uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker = x and blocked = y) or (blocker = y and blocked = x));
$$;
create or replace function public.are_friends(x uuid, y uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where status = 'accepted' and least(a, b) = least(x, y) and greatest(a, b) = greatest(x, y));
$$;

-- 3. Envoyer un message (à un ami uniquement). Renvoie le message créé.
create or replace function public.send_message(target uuid, body text)
returns setof public.messages language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t text := left(trim(body), 500);
begin
  if me is null or t = '' then raise exception 'message vide'; end if;
  if not are_friends(me, target) or is_blocked(me, target) then raise exception 'pas ami'; end if;
  delete from messages where created_at < now() - interval '30 days'; -- ménage
  return query insert into messages (sender, receiver, body) values (me, target, t) returning *;
end $$;

-- 4. Lire une conversation (les messages après « after ») ; marque comme lus ceux reçus.
create or replace function public.list_messages(other uuid, after bigint default 0)
returns setof public.messages language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  update messages set read_at = now() where receiver = me and sender = other and read_at is null;
  return query select * from messages
    where least(sender, receiver) = least(me, other) and greatest(sender, receiver) = greatest(me, other) and id > after
    order by id desc limit 200;
end $$;

-- 5. Nombre de messages non lus, par ami.
create or replace function public.unread_counts()
returns table (user_id uuid, n int) language sql security definer set search_path = public as $$
  select sender, count(*)::int from messages where receiver = auth.uid() and read_at is null group by sender;
$$;

-- 6. Supprimer un de ses messages.
create or replace function public.delete_message(mid bigint)
returns void language sql security definer set search_path = public as $$
  delete from messages where id = mid and sender = auth.uid();
$$;

-- 7. Bloquer un joueur : retire l'amitié, efface la conversation, empêche tout contact.
create or replace function public.block_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or target = me then return; end if;
  delete from friendships where least(a, b) = least(me, target) and greatest(a, b) = greatest(me, target);
  delete from messages where least(sender, receiver) = least(me, target) and greatest(sender, receiver) = greatest(me, target);
  insert into blocks (blocker, blocked) values (me, target) on conflict do nothing;
end $$;

-- 8. Mises à jour des fonctions amis : blocages pris en compte, conversation effacée quand on retire un ami.
create or replace function public.remove_friendship(fid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare f friendships;
begin
  delete from friendships where id = fid and auth.uid() in (a, b) returning * into f;
  if found then delete from messages where least(sender, receiver) = least(f.a, f.b) and greatest(sender, receiver) = greatest(f.a, f.b); end if;
end $$;

create or replace function public.search_players(q text)
returns table (user_id uuid, code text, name text, avatar text, level int)
language sql security definer set search_path = public as $$
  select p.user_id, p.code, p.name, p.avatar, p.level from profiles p
  where p.user_id <> auth.uid()
    and not is_blocked(auth.uid(), p.user_id)
    and p.is_test = (select is_test from profiles where user_id = auth.uid())
    and length(trim(q)) >= 2
    and (upper(p.code) = upper(trim(q)) or p.name ilike replace(replace(trim(q), '%', ''), '_', '') || '%')
  order by (upper(p.code) = upper(trim(q))) desc, p.last_seen desc
  limit 10;
$$;

create or replace function public.send_friend_request(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f friendships;
begin
  if me is null or target is null or target = me or is_blocked(me, target) then raise exception 'demande impossible'; end if;
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

revoke all on function public.send_message(uuid, text), public.list_messages(uuid, bigint), public.unread_counts(),
  public.delete_message(bigint), public.block_user(uuid), public.is_blocked(uuid, uuid), public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.send_message(uuid, text), public.list_messages(uuid, bigint), public.unread_counts(),
  public.delete_message(bigint), public.block_user(uuid) to authenticated;
