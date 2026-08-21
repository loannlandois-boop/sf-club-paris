-- ============================================================
-- SF CLUB PARIS — RECRÉATION COMPLÈTE DES TABLES
-- À coller en une seule fois dans Supabase → SQL Editor → Run
-- (SF Match : listings/searches · Inventaire agrégé · SF Agenda)
-- ============================================================

-- ---------- SF MATCH : annonces & recherches ----------
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

alter table public.listings enable row level security;
alter table public.searches enable row level security;

drop policy if exists "insert_listings_anon" on public.listings;
drop policy if exists "insert_searches_anon" on public.searches;
create policy "insert_listings_anon" on public.listings for insert to anon with check (true);
create policy "insert_searches_anon" on public.searches for insert to anon with check (true);

-- ---------- Inventaire agrégé (marché) ----------
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  source text, ext_id text,
  marque text, modele text, annee text, prix text, couleur text, km text,
  segment text, url text, image text, ville text,
  updated_at timestamptz default now(),
  unique (source, ext_id)
);

create index if not exists idx_inventory_segment on public.inventory (segment);
create index if not exists idx_inventory_marque on public.inventory (lower(marque));

alter table public.inventory enable row level security;
drop policy if exists "read_inventory_anon" on public.inventory;
create policy "read_inventory_anon" on public.inventory for select to anon using (true);

-- ---------- SF Agenda : agences, véhicules, réservations ----------
create table if not exists public.agences (
  id bigint generated always as identity primary key,
  nom text not null, contact text, email text, telephone text,
  actif boolean default true, created_at timestamptz default now()
);

create table if not exists public.agenda_vehicules (
  id bigint generated always as identity primary key,
  agence_id bigint references public.agences(id) on delete set null,
  agence_nom text, marque text not null, modele text not null,
  annee int, couleur text, segment text, image text,
  prix_jour_1_3 numeric, prix_jour_4_6 numeric, prix_jour_7_13 numeric, prix_jour_14plus numeric,
  caution numeric,
  actif boolean default true, created_at timestamptz default now()
);

create table if not exists public.agenda_reservations (
  id bigint generated always as identity primary key,
  vehicule_id bigint references public.agenda_vehicules(id) on delete cascade,
  date_debut date not null, date_fin date not null,
  heure_debut text, heure_fin text, adresse_livraison text,
  client_nom text, client_contact text, prix_total numeric,
  lien_paiement text, lien_caution text,
  statut text default 'confirmee', source text default 'site', notes text,
  created_at timestamptz default now()
);

alter table public.agences enable row level security;
alter table public.agenda_vehicules enable row level security;
alter table public.agenda_reservations enable row level security;

create policy "agences lecture publique" on public.agences for select to anon using (true);
create policy "vehicules lecture publique" on public.agenda_vehicules for select to anon using (true);

create policy "agences creation equipe" on public.agences for insert to authenticated with check (true);
create policy "agences maj equipe" on public.agences for update to authenticated using (true);
create policy "vehicules creation equipe" on public.agenda_vehicules for insert to authenticated with check (true);
create policy "vehicules maj equipe" on public.agenda_vehicules for update to authenticated using (true);

create policy "reservations lecture equipe" on public.agenda_reservations for select to authenticated using (true);
create policy "reservations creation equipe" on public.agenda_reservations for insert to authenticated with check (true);
create policy "reservations maj equipe" on public.agenda_reservations for update to authenticated using (true);
create policy "reservations suppression equipe" on public.agenda_reservations for delete to authenticated using (true);
