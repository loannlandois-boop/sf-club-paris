-- ============================================================
-- Comptes clients + points de fidélité + civilité
-- À coller dans Supabase → SQL Editor → Run
--
-- IMPORTANT — sécurité : jusqu'ici, les policies RLS "réservées à l'équipe"
-- utilisaient `to authenticated using (true)`, ce qui suffisait tant que
-- seule l'équipe avait des comptes. Maintenant que les CLIENTS vont aussi
-- avoir de vrais comptes (authenticated), il faut distinguer équipe / client
-- — sinon un client connecté pourrait lire les réservations de tout le monde.
-- ============================================================

-- ---------- Table équipe : qui a le droit de voir/gérer les réservations ----------
create table if not exists public.staff_users (
  id uuid primary key references auth.users(id) on delete cascade
);
alter table public.staff_users enable row level security;
-- aucune policy publique : uniquement modifiable depuis le SQL Editor (service_role)

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select exists (select 1 from public.staff_users where id = auth.uid());
$$;

-- ---------- Comptes clients ----------
create table if not exists public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  civilite text,
  prenom text,
  nom text,
  email text,
  telephone text,
  points integer not null default 0,
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
-- l'équipe peut aussi consulter les comptes clients (support, ajustement de points)
create policy "clients lecture equipe" on public.clients for select to authenticated using (is_staff());
create policy "clients maj equipe" on public.clients for update to authenticated using (is_staff());

-- ---------- Lien réservation <-> client + civilité ----------
alter table public.agenda_reservations
  add column if not exists client_id uuid references public.clients(id),
  add column if not exists civilite text;

alter table public.demandes
  add column if not exists civilite text;

-- ---------- Corrige les policies "équipe" existantes pour utiliser is_staff() ----------
drop policy if exists "reservations lecture equipe" on public.agenda_reservations;
drop policy if exists "reservations creation equipe" on public.agenda_reservations;
drop policy if exists "reservations maj equipe" on public.agenda_reservations;
drop policy if exists "reservations suppression equipe" on public.agenda_reservations;
create policy "reservations lecture equipe" on public.agenda_reservations for select to authenticated using (is_staff());
create policy "reservations creation equipe" on public.agenda_reservations for insert to authenticated with check (is_staff());
create policy "reservations maj equipe" on public.agenda_reservations for update to authenticated using (is_staff());
create policy "reservations suppression equipe" on public.agenda_reservations for delete to authenticated using (is_staff());

drop policy if exists "vehicules creation equipe" on public.agenda_vehicules;
drop policy if exists "vehicules maj equipe" on public.agenda_vehicules;
create policy "vehicules creation equipe" on public.agenda_vehicules for insert to authenticated with check (is_staff());
create policy "vehicules maj equipe" on public.agenda_vehicules for update to authenticated using (is_staff());

drop policy if exists "agences creation equipe" on public.agences;
drop policy if exists "agences maj equipe" on public.agences;
create policy "agences creation equipe" on public.agences for insert to authenticated with check (is_staff());
create policy "agences maj equipe" on public.agences for update to authenticated using (is_staff());

drop policy if exists "demandes lecture equipe" on public.demandes;
drop policy if exists "demandes maj equipe" on public.demandes;
create policy "demandes lecture equipe" on public.demandes for select to authenticated using (is_staff());
create policy "demandes maj equipe" on public.demandes for update to authenticated using (is_staff());

-- ---------- Le client peut voir SES PROPRES réservations (une fois lié via client_id) ----------
drop policy if exists "reservations lecture client" on public.agenda_reservations;
create policy "reservations lecture client" on public.agenda_reservations for select to authenticated using (client_id = auth.uid());

-- ============================================================
-- DERNIÈRE ÉTAPE MANUELLE OBLIGATOIRE :
-- Ajoutez votre (vos) compte(s) équipe dans staff_users, sinon plus personne
-- ne peut accéder à l'agenda interne après cette migration.
--
-- 1. Authentication → Users → copiez l'UUID de votre compte équipe
-- 2. Lancez, en remplaçant <VOTRE_UUID> :
--    insert into public.staff_users (id) values ('<VOTRE_UUID>');
-- ============================================================
