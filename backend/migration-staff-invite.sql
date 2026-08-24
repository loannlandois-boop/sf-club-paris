-- ============================================================
-- MIGRATION : gestion de l'équipe depuis le CRM (onglet "Équipe")
-- Ajoute les colonnes email/nom/created_at à staff_users et une
-- policy de lecture pour que l'équipe connectée puisse voir la
-- liste des comptes équipe existants. Aucune policy d'écriture :
-- la création de compte passe uniquement par la fonction Edge
-- "staff-invite", qui utilise la clé service_role.
-- À coller dans SQL Editor -> Run, une seule fois.
-- ============================================================
alter table public.staff_users add column if not exists email text;
alter table public.staff_users add column if not exists nom text;
alter table public.staff_users add column if not exists created_at timestamptz not null default now();

drop policy if exists "staff lecture equipe" on public.staff_users;
create policy "staff lecture equipe" on public.staff_users for select to authenticated using (is_staff());
