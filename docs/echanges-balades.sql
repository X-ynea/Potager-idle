-- Échanges (v4) : les ingrédients de balade (algues, miel, mûres…) s'échangent aussi entre amis.
-- À lancer une fois dans Supabase › SQL Editor (après docs/echanges.sql), puis relancer docs/echanges-valeurs.sql
-- qui contient leurs prix. Peut être relancé sans risque.
-- Seul changement : l'inventaire d'un ami renvoie aussi ses ingrédients de balade ('wild').

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
