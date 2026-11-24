# Mettre en place les comptes (Supabase + Discord)

Le code des comptes est déjà dans le jeu. Il reste à créer le projet en ligne et à brancher Discord, en environ 15 minutes. Tant que ce n'est pas fait, la section « Compte » n'apparaît pas et le jeu fonctionne comme avant.

## 1. Créer le projet Supabase

1. Va sur https://supabase.com, crée un compte gratuit (« Start your project »), puis **New project**.
2. Nom : `potager-idle`. Choisis un mot de passe de base de données (garde-le pour toi, il ne sert pas dans le jeu). Région : Europe (Paris ou Francfort).
3. Une fois le projet prêt, va dans **SQL Editor**, colle tout le bloc ci-dessous, puis **Run** :

```sql
-- Une sauvegarde par joueur
create table public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
grant select, insert, update, delete on public.saves to authenticated;

-- Chaque joueur ne voit et ne modifie que sa propre sauvegarde
create policy "lire sa sauvegarde" on public.saves for select using (auth.uid() = user_id);
create policy "créer sa sauvegarde" on public.saves for insert with check (auth.uid() = user_id);
create policy "modifier sa sauvegarde" on public.saves for update using (auth.uid() = user_id);
create policy "supprimer sa sauvegarde" on public.saves for delete using (auth.uid() = user_id);

-- Bouton « Supprimer mon compte en ligne » : efface le compte et sa sauvegarde
create or replace function public.delete_me() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
```

4. Va dans **Project Settings › API** et note :
   - **Project URL** (du genre `https://abcdefgh.supabase.co`) ;
   - la clé **publishable** (`sb_publishable_…`), anciennement appelée « anon public ».

## 2. Créer l'application Discord

1. Va sur https://discord.com/developers/applications, puis **New Application**, nom `Potager idle`.
2. Menu **OAuth2** : note le **Client ID** et clique **Reset Secret** pour obtenir le **Client Secret**.
3. Toujours dans **OAuth2 › Redirects**, ajoute cette adresse (remplace par l'adresse de ton projet Supabase) :
   `https://abcdefgh.supabase.co/auth/v1/callback`

## 3. Relier Discord à Supabase

1. Dans Supabase : **Authentication › Sign In / Providers › Discord** : active-le, colle le Client ID et le Client Secret de Discord, enregistre.
2. **Authentication › URL Configuration** :
   - **Site URL** : l'adresse du jeu, par exemple `https://x-ynea.github.io/Potager-idle/` ;
   - **Redirect URLs** : ajoute la même adresse (et `http://localhost:8000/` si tu testes en local).

## 4. Brancher le jeu

Envoie-moi la **Project URL** et la clé **anon public** (elles sont publiques, ce n'est pas un secret). Je les mets dans `js/cloud-config.js`, je publie, et le bouton « Se connecter avec Discord » apparaît dans les réglages.

**Ne m'envoie jamais** le Client Secret de Discord, le mot de passe de la base, ni la clé `service_role` de Supabase.

## Ce qui est en place

- Projet : `https://gsicckbnwypcpxlokwjl.supabase.co` (configuré dans `js/cloud-config.js`).
- Les sauvegardes sont visibles dans Supabase, **Table Editor › saves** (une ligne par joueur connecté).
