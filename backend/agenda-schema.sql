-- ============================================================
-- SF AGENDA — Réservations multi-agences (véhicules loués sous la marque SF Club Paris)
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

create table if not exists public.agences (
  id bigint generated always as identity primary key,
  nom text not null,
  contact text,
  email text,
  telephone text,
  actif boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.agenda_vehicules (
  id bigint generated always as identity primary key,
  agence_id bigint references public.agences(id) on delete set null,
  agence_nom text,
  marque text not null,
  modele text not null,
  annee int,
  couleur text,
  segment text,
  image text,
  prix_jour_1_3 numeric,
  prix_jour_4_6 numeric,
  prix_jour_7_13 numeric,
  prix_jour_14plus numeric,
  caution numeric,
  actif boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.staff_users (
  id uuid primary key references auth.users(id) on delete cascade
);
alter table public.staff_users enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select exists (select 1 from public.staff_users where id = auth.uid());
$$;

create table if not exists public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  civilite text, prenom text, nom text, email text, telephone text,
  points integer not null default 0,
  bienvenue_envoye boolean not null default false,
  created_at timestamptz default now()
);
alter table public.clients enable row level security;
create policy "clients lecture soi" on public.clients for select to authenticated using (auth.uid() = id);
create policy "clients creation soi" on public.clients for insert to authenticated with check (auth.uid() = id);
create policy "clients maj soi" on public.clients for update to authenticated using (auth.uid() = id);
create policy "clients lecture equipe" on public.clients for select to authenticated using (is_staff());
create policy "clients maj equipe" on public.clients for update to authenticated using (is_staff());

create table if not exists public.agenda_reservations (
  id bigint generated always as identity primary key,
  vehicule_id bigint references public.agenda_vehicules(id) on delete cascade,
  client_id uuid references public.clients(id),
  date_debut date not null,
  date_fin date not null,
  heure_debut text,
  heure_fin text,
  adresse_livraison text,
  civilite text,
  client_nom text,
  client_contact text,
  prix_total numeric,
  lien_paiement text,
  lien_caution text,
  reference text,
  paye boolean default false,
  caution_recue boolean default false,
  merci_envoye boolean default false,
  numero_vol text,
  heure_arrivee_vol text,
  heure_depart_vol text,
  statut text default 'confirmee',
  source text default 'site',
  notes text,
  created_at timestamptz default now()
);

create unique index if not exists agenda_reservations_reference_key
  on public.agenda_reservations (reference) where reference is not null;

alter table public.agences enable row level security;
alter table public.agenda_vehicules enable row level security;
alter table public.agenda_reservations enable row level security;

-- Catalogue véhicules/agences : lecture publique nécessaire pour le widget de recherche du site
create policy "agences lecture publique" on public.agences for select to anon using (true);
create policy "vehicules lecture publique" on public.agenda_vehicules for select to anon using (true);

-- Gestion du catalogue réservée à l'équipe (is_staff() : voir staff_users ci-dessus)
create policy "agences creation equipe" on public.agences for insert to authenticated with check (is_staff());
create policy "agences maj equipe" on public.agences for update to authenticated using (is_staff());
create policy "vehicules creation equipe" on public.agenda_vehicules for insert to authenticated with check (is_staff());
create policy "vehicules maj equipe" on public.agenda_vehicules for update to authenticated using (is_staff());

-- Réservations : données clients sensibles → AUCUN accès anonyme, équipe (is_staff()) ou client concerné
create policy "reservations lecture equipe" on public.agenda_reservations for select to authenticated using (is_staff());
create policy "reservations creation equipe" on public.agenda_reservations for insert to authenticated with check (is_staff());
create policy "reservations maj equipe" on public.agenda_reservations for update to authenticated using (is_staff());
create policy "reservations suppression equipe" on public.agenda_reservations for delete to authenticated using (is_staff());
create policy "reservations lecture client" on public.agenda_reservations for select to authenticated using (client_id = auth.uid());
