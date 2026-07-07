-- ============================================================
-- SF MATCH — Schéma Supabase (à coller dans SQL Editor)
-- ============================================================

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  marque text, modele text, annee text, ch text, couleur text,
  finition text, km text, prix text, "desc" text,
  nom text, contact text, photos int default 0
);

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  marque text, modele text, budget text, annee text,
  similaire boolean default true, "desc" text,
  nom text, contact text
);

create index if not exists idx_listings_marque on public.listings (lower(marque));
create index if not exists idx_searches_marque on public.searches (lower(marque));

-- Sécurité : on autorise SEULEMENT l'insertion publique (dépôt d'annonce /
-- création d'alerte). Aucune lecture publique -> les coordonnées restent privées.
alter table public.listings enable row level security;
alter table public.searches enable row level security;

drop policy if exists "insert_listings_anon" on public.listings;
drop policy if exists "insert_searches_anon" on public.searches;

create policy "insert_listings_anon" on public.listings
  for insert to anon with check (true);
create policy "insert_searches_anon" on public.searches
  for insert to anon with check (true);

-- La lecture/le matching/les e-mails sont faits côté serveur par l'Edge Function
-- avec la clé service_role (qui ignore la RLS). Rien n'est exposé au public.
