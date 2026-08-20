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
  actif boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.agenda_reservations (
  id bigint generated always as identity primary key,
  vehicule_id bigint references public.agenda_vehicules(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  client_nom text,
  client_contact text,
  prix_total numeric,
  statut text default 'confirmee',
  source text default 'site',
  notes text,
  created_at timestamptz default now()
);

alter table public.agences enable row level security;
alter table public.agenda_vehicules enable row level security;
alter table public.agenda_reservations enable row level security;

-- Catalogue véhicules/agences : lecture publique nécessaire pour le widget de recherche du site
create policy "agences lecture publique" on public.agences for select to anon using (true);
create policy "vehicules lecture publique" on public.agenda_vehicules for select to anon using (true);

-- Gestion du catalogue réservée à l'équipe connectée (authenticated)
create policy "agences creation equipe" on public.agences for insert to authenticated with check (true);
create policy "agences maj equipe" on public.agences for update to authenticated using (true);
create policy "vehicules creation equipe" on public.agenda_vehicules for insert to authenticated with check (true);
create policy "vehicules maj equipe" on public.agenda_vehicules for update to authenticated using (true);

-- Réservations : données clients sensibles → AUCUN accès anonyme, uniquement l'équipe connectée
create policy "reservations lecture equipe" on public.agenda_reservations for select to authenticated using (true);
create policy "reservations creation equipe" on public.agenda_reservations for insert to authenticated with check (true);
create policy "reservations maj equipe" on public.agenda_reservations for update to authenticated using (true);
create policy "reservations suppression equipe" on public.agenda_reservations for delete to authenticated using (true);
