-- Visites (Potager idle) : voir le jardin et l'herbier d'un ami, en lecture seule.
-- À lancer une fois dans Supabase › SQL Editor, après docs/amis.sql et docs/messages.sql. Peut être relancé sans risque.

-- Jardin d'un ami : seulement ce qui sert à la visite (bacs, décos, herbier, niveau).
-- Jamais les pièces, l'inventaire ni le reste de la sauvegarde.
create or replace function public.friend_garden(target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d jsonb; u timestamptz;
begin
  if auth.uid() is null or target is null or not are_friends(auth.uid(), target) or is_blocked(auth.uid(), target) then
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
    'level', d->'level', 'last', d->'last', 'updated_at', u);
end $$;

revoke all on function public.friend_garden(uuid) from public, anon;
grant execute on function public.friend_garden(uuid) to authenticated;
