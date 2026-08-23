-- ============================================================
-- DEMANDES — formulaires du site (Contact, Événements, Financement,
-- Estimation Achat & Revente, Adhésion Club)
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================
create table if not exists public.demandes (
  id bigint generated always as identity primary key,
  type text not null,       -- 'contact' | 'evenement' | 'financement' | 'estimation' | 'adhesion'
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

-- Aucun accès public en lecture/écriture directe : tout passe par la fonction
-- demande-request (service_role), pour pouvoir déclencher les e-mails de façon fiable.
create policy "demandes lecture equipe" on public.demandes for select to authenticated using (true);
create policy "demandes maj equipe" on public.demandes for update to authenticated using (true);
