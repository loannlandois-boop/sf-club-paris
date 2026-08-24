-- ============================================================
-- CRM interne : taches (manuelles + automatiques) + visites du site
-- A coller dans Supabase -> SQL Editor -> Run
-- ============================================================

-- ---------- Tâches (manuelles + générées automatiquement) ----------
create table if not exists public.taches (
  id bigint generated always as identity primary key,
  titre text not null,
  description text,
  statut text not null default 'a_faire',      -- a_faire | fait
  priorite text not null default 'normale',    -- normale | urgente
  origine text not null default 'manuelle',    -- manuelle | auto
  reservation_id bigint references public.agenda_reservations(id) on delete set null,
  echeance date,
  created_at timestamptz default now(),
  termine_at timestamptz
);
alter table public.taches enable row level security;
-- Pas de policy anon : les tâches manuelles passent par l'équipe connectée (is_staff()),
-- les tâches automatiques sont créées par les fonctions serveur (service_role, contourne RLS).
create policy "taches lecture equipe" on public.taches for select to authenticated using (is_staff());
create policy "taches creation equipe" on public.taches for insert to authenticated with check (is_staff());
create policy "taches maj equipe" on public.taches for update to authenticated using (is_staff());

-- ---------- Visites du site (comptage simple, sans donnée personnelle) ----------
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  path text,
  created_at timestamptz default now()
);
alter table public.site_visits enable row level security;
create policy "site_visits insertion anon" on public.site_visits for insert to anon with check (true);
create policy "site_visits lecture equipe" on public.site_visits for select to authenticated using (is_staff());

create index if not exists idx_site_visits_created on public.site_visits (created_at);
create index if not exists idx_taches_statut on public.taches (statut);

-- ---------- Date exacte du paiement (pour le CA par jour/mois/annee dans le CRM) ----------
alter table public.agenda_reservations
  add column if not exists paye_at timestamptz;
