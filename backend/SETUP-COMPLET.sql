-- ============================================================
-- SF CLUB PARIS — SCRIPT COMPLET (tout-en-un, à jour au 2026-08-24)
-- Réunit TOUT ce qui a été construit : SF Match, Inventaire, SF Agenda,
-- comptes équipe + clients, CRM (tâches/visites), demandes (formulaires
-- du site), gestion d'équipe depuis le CRM, notifications automatiques.
--
-- SANS DANGER À RE-COLLER : chaque instruction vérifie d'abord si la
-- chose existe déjà (tables, colonnes, policies, tâche planifiée) avant
-- de la créer, donc vous pouvez lancer ce script même si une partie a
-- déjà été appliquée avant — rien ne sera dupliqué ni cassé.
--
-- À coller EN UNE SEULE FOIS dans Supabase → SQL Editor → New query → Run.
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

-- ---------- Déclencheur SF Match : e-mail auto à chaque nouvelle annonce/recherche ----------
create extension if not exists pg_net;

create or replace function public.sfmatch_notify()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://cuohpntjpkpwvhspzads.supabase.co/functions/v1/notify-buyers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2hwbnRqcGtwd3Zoc3B6YWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzMxMzgsImV4cCI6MjEwMjgwOTEzOH0.gAEYzBI0FMi63PjC3TRLvseirT-piMdwzriAYnt9PJQ'
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', row_to_json(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists sfmatch_listings_notify on public.listings;
create trigger sfmatch_listings_notify
after insert on public.listings
for each row execute function public.sfmatch_notify();

drop trigger if exists sfmatch_searches_notify on public.searches;
create trigger sfmatch_searches_notify
after insert on public.searches
for each row execute function public.sfmatch_notify();

-- ---------- SF Agenda : agences, véhicules ----------
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

-- ---------- Équipe / clients : qui a le droit de voir quoi ----------
create table if not exists public.staff_users (
  id uuid primary key references auth.users(id) on delete cascade
);
alter table public.staff_users enable row level security;
alter table public.staff_users add column if not exists email text;
alter table public.staff_users add column if not exists nom text;
alter table public.staff_users add column if not exists prenom text;
alter table public.staff_users add column if not exists civilite text;
alter table public.staff_users add column if not exists telephone text;
alter table public.staff_users add column if not exists is_admin boolean not null default false;
alter table public.staff_users add column if not exists doit_changer_mdp boolean not null default false;
alter table public.staff_users add column if not exists created_at timestamptz not null default now();
drop policy if exists "staff lecture equipe" on public.staff_users;
create policy "staff lecture equipe" on public.staff_users for select to authenticated using (is_staff());

create or replace function public.marquer_mdp_change()
returns void
language sql
security definer
set search_path = public
as $$
  update public.staff_users set doit_changer_mdp = false where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff_users where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff_users where id = auth.uid() and is_admin = true);
$$;

-- Le tout premier compte équipe créé (avant l'existence du système d'invitation)
-- devient automatiquement administrateur, s'il n'y a pas encore d'admin.
update public.staff_users set is_admin = true
where id = (select id from public.staff_users order by created_at asc limit 1)
and not exists (select 1 from public.staff_users where is_admin = true);

create table if not exists public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  civilite text, prenom text, nom text, email text, telephone text,
  points integer not null default 0,
  bienvenue_envoye boolean not null default false,
  created_at timestamptz default now()
);
alter table public.clients enable row level security;
drop policy if exists "clients lecture soi" on public.clients;
drop policy if exists "clients creation soi" on public.clients;
drop policy if exists "clients maj soi" on public.clients;
drop policy if exists "clients lecture equipe" on public.clients;
drop policy if exists "clients maj equipe" on public.clients;
create policy "clients lecture soi" on public.clients for select to authenticated using (auth.uid() = id);
create policy "clients creation soi" on public.clients for insert to authenticated with check (auth.uid() = id);
create policy "clients maj soi" on public.clients for update to authenticated using (auth.uid() = id);
create policy "clients lecture equipe" on public.clients for select to authenticated using (is_staff());
create policy "clients maj equipe" on public.clients for update to authenticated using (is_staff());

-- ---------- SF Agenda : réservations ----------
create table if not exists public.agenda_reservations (
  id bigint generated always as identity primary key,
  vehicule_id bigint references public.agenda_vehicules(id) on delete cascade,
  client_id uuid references public.clients(id),
  date_debut date not null, date_fin date not null,
  heure_debut text, heure_fin text, adresse_livraison text,
  civilite text, client_nom text, client_contact text, prix_total numeric,
  lien_paiement text, lien_caution text,
  reference text, paye boolean default false, caution_recue boolean default false,
  paye_at timestamptz, merci_envoye boolean default false,
  facture_pdf text, facture_url text,
  numero_vol text, heure_arrivee_vol text, heure_depart_vol text,
  statut text default 'confirmee', source text default 'site', notes text,
  created_at timestamptz default now()
);
alter table public.agenda_reservations add column if not exists facture_pdf text;
alter table public.agenda_reservations add column if not exists facture_url text;

create unique index if not exists agenda_reservations_reference_key
  on public.agenda_reservations (reference) where reference is not null;

alter table public.agences enable row level security;
alter table public.agenda_vehicules enable row level security;
alter table public.agenda_reservations enable row level security;

drop policy if exists "agences lecture publique" on public.agences;
drop policy if exists "vehicules lecture publique" on public.agenda_vehicules;
create policy "agences lecture publique" on public.agences for select to anon using (true);
create policy "vehicules lecture publique" on public.agenda_vehicules for select to anon using (true);

drop policy if exists "agences creation equipe" on public.agences;
drop policy if exists "agences maj equipe" on public.agences;
drop policy if exists "vehicules creation equipe" on public.agenda_vehicules;
drop policy if exists "vehicules maj equipe" on public.agenda_vehicules;
create policy "agences creation equipe" on public.agences for insert to authenticated with check (is_staff());
create policy "agences maj equipe" on public.agences for update to authenticated using (is_staff());
create policy "vehicules creation equipe" on public.agenda_vehicules for insert to authenticated with check (is_staff());
create policy "vehicules maj equipe" on public.agenda_vehicules for update to authenticated using (is_staff());

drop policy if exists "reservations lecture equipe" on public.agenda_reservations;
drop policy if exists "reservations creation equipe" on public.agenda_reservations;
drop policy if exists "reservations maj equipe" on public.agenda_reservations;
drop policy if exists "reservations suppression equipe" on public.agenda_reservations;
drop policy if exists "reservations lecture client" on public.agenda_reservations;
create policy "reservations lecture equipe" on public.agenda_reservations for select to authenticated using (is_staff());
create policy "reservations creation equipe" on public.agenda_reservations for insert to authenticated with check (is_staff());
create policy "reservations maj equipe" on public.agenda_reservations for update to authenticated using (is_staff());
create policy "reservations suppression equipe" on public.agenda_reservations for delete to authenticated using (is_staff());
create policy "reservations lecture client" on public.agenda_reservations for select to authenticated using (client_id = auth.uid());

-- ---------- CRM interne : tâches + visites du site ----------
create table if not exists public.taches (
  id bigint generated always as identity primary key,
  titre text not null,
  description text,
  statut text not null default 'a_faire',      -- a_faire | fait
  priorite text not null default 'normale',    -- normale | urgente
  origine text not null default 'manuelle',    -- manuelle | auto
  reservation_id bigint references public.agenda_reservations(id) on delete set null,
  assigne_a uuid references public.staff_users(id) on delete set null,
  echeance date,
  created_at timestamptz default now(),
  termine_at timestamptz
);
alter table public.taches add column if not exists assigne_a uuid references public.staff_users(id) on delete set null;
alter table public.taches enable row level security;
drop policy if exists "taches lecture equipe" on public.taches;
drop policy if exists "taches creation equipe" on public.taches;
drop policy if exists "taches maj equipe" on public.taches;
-- Chacun voit les tâches non assignées (tout le monde) + les siennes ;
-- l'administrateur voit tout, pour garder une vue d'ensemble.
create policy "taches lecture equipe" on public.taches for select to authenticated using (
  is_admin() or assigne_a is null or assigne_a = auth.uid()
);
create policy "taches creation equipe" on public.taches for insert to authenticated with check (is_staff());
create policy "taches maj equipe" on public.taches for update to authenticated using (
  is_admin() or assigne_a is null or assigne_a = auth.uid()
);

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  path text,
  created_at timestamptz default now()
);
alter table public.site_visits enable row level security;
drop policy if exists "site_visits insertion anon" on public.site_visits;
drop policy if exists "site_visits lecture equipe" on public.site_visits;
create policy "site_visits insertion anon" on public.site_visits for insert to anon with check (true);
create policy "site_visits lecture equipe" on public.site_visits for select to authenticated using (is_staff());

create index if not exists idx_site_visits_created on public.site_visits (created_at);
create index if not exists idx_taches_statut on public.taches (statut);

-- ---------- Demandes : formulaires du site (Contact, Événements, Financement, Estimation, Adhésion) ----------
create table if not exists public.demandes (
  id bigint generated always as identity primary key,
  type text not null,       -- 'contact' | 'evenement' | 'financement' | 'estimation' | 'adhesion'
  civilite text,
  nom text,
  email text,
  telephone text,
  sujet text,
  message text,
  details jsonb,             -- champs additionnels propres à chaque type de formulaire
  statut text default 'nouvelle',  -- nouvelle | traitee
  created_at timestamptz default now()
);
alter table public.demandes enable row level security;
drop policy if exists "demandes lecture equipe" on public.demandes;
drop policy if exists "demandes maj equipe" on public.demandes;
create policy "demandes lecture equipe" on public.demandes for select to authenticated using (is_staff());
create policy "demandes maj equipe" on public.demandes for update to authenticated using (is_staff());

-- ---------- E-mail de remerciement automatique en fin de location (cron quotidien) ----------
create extension if not exists pg_cron;

select cron.schedule(
  'agenda-merci-quotidien',
  '0 10 * * *',  -- tous les jours à 10h00 UTC (11h Paris hiver, 12h été)
  $$
  select net.http_post(
    url := 'https://cuohpntjpkpwvhspzads.supabase.co/functions/v1/agenda-merci',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2hwbnRqcGtwd3Zoc3B6YWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzMxMzgsImV4cCI6MjEwMjgwOTEzOH0.gAEYzBI0FMi63PjC3TRLvseirT-piMdwzriAYnt9PJQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- N'oubliez pas d'ajouter votre TOUT PREMIER compte équipe (ensuite,
-- les suivants s'ajoutent depuis le CRM → onglet "Équipe") :
-- 1. Authentication → Users → copiez l'UUID de votre compte équipe
-- 2. Lancez, en remplaçant les valeurs :
--    insert into public.staff_users (id, email) values ('<VOTRE_UUID>', '<votre email>')
--    on conflict (id) do nothing;
-- ============================================================
