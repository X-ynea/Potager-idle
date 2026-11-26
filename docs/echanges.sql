-- Échanges entre amis (Potager idle).
-- À lancer une fois dans Supabase › SQL Editor, après docs/arrosage.sql, puis lancer docs/echanges-valeurs.sql.
-- Peut être relancé sans risque.
-- Règles :
--   · chaque côté : des objets (plantes, ingrédients de balade et plats), des pièces, ou les deux ; jamais de pièces des deux côtés ;
--   · valeur = prix de vente au marché (table item_values) ; écart de 20 % au plus entre les deux côtés ;
--   · 3 000 pièces de valeur au plus de chaque côté ; 3 échanges proposés par jour (date de Paris, sans compter les annulés ;
--     pas de limite pour les comptes de la version de test),
--     les contre-propositions ne comptent pas (autant d'allers-retours qu'on veut) ;
--   · pas de graines, pas de récoltes dorées, pas de radis éclair (absents d'item_values) ;
--   · anti-spoil : on ne propose que ce que l'autre a découvert, on ne demande que ce qu'on a découvert ;
--   · une proposition expire au bout de 48 h ; une contre-proposition repart pour 48 h.
-- Les objets et les pièces proposés quittent la partie du joueur dès l'envoi (dans le jeu) ;
-- ils lui reviennent si l'échange est refusé, annulé ou expiré (claim_trade).

create or replace function public.paris_today() returns date language sql stable as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

-- 1. Prix des objets (rempli par docs/echanges-valeurs.sql).
create table if not exists public.item_values (
  key text primary key,
  value int not null check (value > 0),
  lvl int not null default 0,
  needs text[] not null default '{}'
);
alter table public.item_values enable row level security;

-- 2. Échanges. a = qui propose, b = qui reçoit la proposition.
--    give / give_coins : ce que a donne ; want / want_coins : ce que a demande à b.
create table if not exists public.trades (
  id bigint generated always as identity primary key,
  a uuid not null references auth.users on delete cascade,
  b uuid references auth.users on delete set null, -- compte supprimé : l'échange expire et a récupère ses objets
  give jsonb not null default '{}'::jsonb,
  give_coins int not null default 0 check (give_coins >= 0),
  want jsonb not null default '{}'::jsonb,
  want_coins int not null default 0 check (want_coins >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'cancelled', 'expired')),
  day date not null default paris_today(),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  a_claimed boolean not null default false
);
alter table public.trades add column if not exists counter_of bigint; -- contre-proposition : l'échange auquel elle répond
alter table public.trades drop constraint if exists trades_status_check;
alter table public.trades add constraint trades_status_check check (status in ('pending', 'accepted', 'refused', 'cancelled', 'expired', 'countered'));
-- Message « 📬 » envoyé avec une proposition : relié à l'échange (pour l'annuler depuis la conversation).
alter table public.messages add column if not exists trade_id bigint;
create index if not exists trades_a on public.trades (a, created_at desc);
create index if not exists trades_b on public.trades (b, created_at desc);
alter table public.trades enable row level security;
-- Aucune lecture directe : tout passe par les fonctions ci-dessous.

-- Valeur d'un côté de l'échange ({"radis": 3, "salade": 1}). Refuse un objet inconnu ou une quantité bizarre.
create or replace function public.trade_value(items jsonb) returns int
language plpgsql stable security definer set search_path = public as $$
declare k text; q jsonb; v int; n int := 0; total int := 0;
begin
  if items is null or jsonb_typeof(items) <> 'object' then raise exception 'echange_invalide'; end if;
  for k, q in select * from jsonb_each(items) loop
    if jsonb_typeof(q) <> 'number' or (q #>> '{}')::numeric <> floor((q #>> '{}')::numeric)
       or (q #>> '{}')::numeric < 1 or (q #>> '{}')::numeric > 999 then raise exception 'echange_invalide'; end if;
    select iv.value into v from item_values iv where iv.key = k;
    if v is null then raise exception 'objet_interdit'; end if;
    total := total + v * (q #>> '{}')::int; n := n + 1;
  end loop;
  if n > 8 then raise exception 'echange_invalide'; end if;
  return total;
end $$;

-- Le joueur « connaît »-il tous ces objets ? (niveau pour les plats, hybrides découverts)
create or replace function public.knows_items(who uuid, items jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from jsonb_object_keys(items) k
    join item_values iv on iv.key = k
    left join saves s on s.user_id = who
    where iv.lvl > coalesce(case when jsonb_typeof(s.data->'level') = 'number' then (s.data->>'level')::int end, 1)
       or exists (select 1 from unnest(iv.needs) h where not (coalesce(s.data->'hybrids', '[]'::jsonb) ? h)));
$$;

-- 3. Inventaire d'un ami (plantes et plats, pour choisir ce qu'on demande) et échanges déjà proposés aujourd'hui.
create or replace function public.friend_inventory(target uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb; me uuid := auth.uid();
begin
  if me is null or target is null or not are_friends(me, target) or is_blocked(me, target) then raise exception 'pas ami'; end if;
  select s.data into d from saves s where s.user_id = target;
  return jsonb_build_object(
    'crops', coalesce(d->'crops', '{}'::jsonb), 'wild', coalesce(d->'wild', '{}'::jsonb), 'dishes', coalesce(d->'dishes', '{}'::jsonb),
    'level', coalesce(d->'level', '1'::jsonb), 'hybrids', coalesce(d->'hybrids', '[]'::jsonb),
    'trades_today', (select count(*) from trades where a = me and day = paris_today() and counter_of is null and status <> 'cancelled'));
end $$;

-- 4. Proposer un échange, ou faire une contre-proposition à un échange reçu (counter = son numéro).
--    Renvoie le numéro du nouvel échange.
drop function if exists public.propose_trade(uuid, jsonb, int, jsonb, int);
create or replace function public.propose_trade(target uuid, give jsonb, give_coins int, want jsonb, want_coins int, counter bigint default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); va int; vb int; tid bigint;
begin
  if me is null or target is null or target = me or not are_friends(me, target) or is_blocked(me, target) then raise exception 'pas ami'; end if;
  perform pg_advisory_xact_lock(hashtext('trade-' || me::text));
  give := coalesce(give, '{}'::jsonb); want := coalesce(want, '{}'::jsonb);
  give_coins := coalesce(give_coins, 0); want_coins := coalesce(want_coins, 0);
  if give_coins < 0 or want_coins < 0 or give_coins > 3000 or want_coins > 3000 then raise exception 'echange_invalide'; end if;
  if give_coins > 0 and want_coins > 0 then raise exception 'pieces_contre_pieces'; end if;
  va := trade_value(give) + give_coins;
  vb := trade_value(want) + want_coins;
  if va <= 0 or vb <= 0 then raise exception 'echange_vide'; end if;
  if va > 3000 or vb > 3000 then raise exception 'plafond'; end if;
  if greatest(va, vb) > 1.2 * least(va, vb) then raise exception 'desequilibre'; end if;
  if not knows_items(target, give) or not knows_items(me, want) then raise exception 'spoil'; end if;
  if counter is null then
    -- Les échanges annulés ne comptent pas ; pas de limite pour les comptes de la version de test.
    if not coalesce((select is_test from profiles where user_id = me), false)
       and (select count(*) from trades where a = me and day = paris_today() and counter_of is null and status <> 'cancelled') >= 3 then raise exception 'trop_echanges'; end if;
  else
    -- La proposition reçue est remplacée : celui qui l'avait faite récupère ce qu'il proposait (claim_trade).
    update trades set status = 'countered', decided_at = now()
      where id = counter and a = target and b = me and status = 'pending' and created_at > now() - interval '48 hours';
    if not found then raise exception 'plus_disponible'; end if;
  end if;
  insert into trades (a, b, give, give_coins, want, want_coins, counter_of) values (me, target, give, give_coins, want, want_coins, counter) returning id into tid;
  insert into messages (sender, receiver, body, trade_id) values (me, target,
    case when counter is null then '📬 Je t’ai proposé un échange.' else '🔁 Je t’ai fait une contre-proposition.' end, tid);
  delete from trades where created_at < now() - interval '30 days' and status <> 'pending' and a_claimed; -- ménage
  return tid;
end $$;

-- 5. Mes échanges : propositions en cours (envoyées et reçues), et ceux terminés ces 7 derniers jours
--    ou pas encore récupérés. Les propositions de plus de 48 h passent d'abord en « expiré ».
drop function if exists public.my_trades();
create or replace function public.my_trades()
returns table (id bigint, mine boolean, other uuid, name text, avatar text, give jsonb, give_coins int, want jsonb, want_coins int,
  status text, created_at timestamptz, decided_at timestamptz, a_claimed boolean, counter_of bigint)
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non connecté'; end if;
  update trades t set status = 'expired', decided_at = now()
    where t.status = 'pending' and (t.a = me or t.b = me or t.b is null) and t.created_at < now() - interval '48 hours';
  update trades t set status = 'expired', decided_at = now() where t.status = 'pending' and t.a = me and t.b is null;
  return query
    select t.id, t.a = me, case when t.a = me then t.b else t.a end, coalesce(p.name, 'Un ancien ami'), p.avatar,
      t.give, t.give_coins, t.want, t.want_coins, t.status, t.created_at, t.decided_at, t.a_claimed, t.counter_of
    from trades t left join profiles p on p.user_id = case when t.a = me then t.b else t.a end
    where (t.a = me or t.b = me)
      and (t.status = 'pending' or t.created_at > now() - interval '7 days' or (t.a = me and not t.a_claimed))
    order by t.created_at desc;
end $$;

-- 6. Répondre à une proposition reçue. Accepter : le jeu de b échange aussitôt les objets.
create or replace function public.respond_trade(tid bigint, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t trades;
begin
  select * into t from trades where id = tid and b = me for update;
  if not found or t.status <> 'pending' or t.created_at < now() - interval '48 hours' then raise exception 'plus_disponible'; end if;
  if accept and (not are_friends(t.a, me) or is_blocked(t.a, me)) then raise exception 'pas ami'; end if;
  update trades set status = case when accept then 'accepted' else 'refused' end, decided_at = now() where id = tid;
  return case when accept then 'accepted' else 'refused' end;
end $$;

-- 7. Annuler sa proposition (depuis la boîte aux lettres). Le jeu rend aussitôt les objets mis de côté.
create or replace function public.cancel_trade(tid bigint) returns text
language plpgsql security definer set search_path = public as $$
begin
  update trades set status = 'cancelled', decided_at = now(), a_claimed = true
    where id = tid and a = auth.uid() and status = 'pending';
  if not found then raise exception 'plus_disponible'; end if;
  return 'cancelled';
end $$;

-- 8. Récupérer le résultat d'une proposition terminée (une seule fois, même avec plusieurs appareils) :
--    accepté → on reçoit ce qu'on avait demandé ; refusé, expiré ou contre-proposé → on récupère ce qu'on avait proposé.
create or replace function public.claim_trade(tid bigint) returns text
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  update trades set a_claimed = true
    where id = tid and a = auth.uid() and not a_claimed and status in ('accepted', 'refused', 'expired', 'countered')
    returning status into st;
  return st; -- null : déjà récupéré
end $$;

revoke all on function public.trade_value(jsonb), public.knows_items(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.friend_inventory(uuid), public.propose_trade(uuid, jsonb, int, jsonb, int, bigint), public.my_trades(),
  public.respond_trade(bigint, boolean), public.cancel_trade(bigint), public.claim_trade(bigint) from public, anon;
grant execute on function public.friend_inventory(uuid), public.propose_trade(uuid, jsonb, int, jsonb, int, bigint), public.my_trades(),
  public.respond_trade(bigint, boolean), public.cancel_trade(bigint), public.claim_trade(bigint) to authenticated;
