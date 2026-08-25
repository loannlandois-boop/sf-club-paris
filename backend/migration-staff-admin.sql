-- ============================================================
-- CORRECTIF ISOLÉ : rôle administrateur + fiches équipe complètes
-- + tâches assignables. À coller seul dans SQL Editor -> Run si le
-- gros script SETUP-COMPLET.sql a échoué en cours de route (une seule
-- erreur dans un script annule tout ce qu'il y avait avant elle).
-- Sans danger à rejouer plusieurs fois.
-- ============================================================

-- ---------- Colonnes staff_users ----------
alter table public.staff_users add column if not exists email text;
alter table public.staff_users add column if not exists nom text;
alter table public.staff_users add column if not exists prenom text;
alter table public.staff_users add column if not exists civilite text;
alter table public.staff_users add column if not exists telephone text;
alter table public.staff_users add column if not exists is_admin boolean not null default false;
alter table public.staff_users add column if not exists created_at timestamptz not null default now();

drop policy if exists "staff lecture equipe" on public.staff_users;
create policy "staff lecture equipe" on public.staff_users for select to authenticated using (is_staff());

-- ---------- Fonction is_admin() ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff_users where id = auth.uid() and is_admin = true);
$$;

-- Le tout premier compte équipe créé devient administrateur, s'il n'y a pas encore d'admin.
update public.staff_users set is_admin = true
where id = (select id from public.staff_users order by created_at asc limit 1)
and not exists (select 1 from public.staff_users where is_admin = true);

-- ---------- Tâches assignables ----------
alter table public.taches add column if not exists assigne_a uuid references public.staff_users(id) on delete set null;

drop policy if exists "taches lecture equipe" on public.taches;
drop policy if exists "taches maj equipe" on public.taches;
create policy "taches lecture equipe" on public.taches for select to authenticated using (
  is_admin() or assigne_a is null or assigne_a = auth.uid()
);
create policy "taches maj equipe" on public.taches for update to authenticated using (
  is_admin() or assigne_a is null or assigne_a = auth.uid()
);

-- ---------- Vérification : regardez le résultat ci-dessous ----------
-- Vous devez voir votre ligne avec is_admin = true. Si la colonne
-- n'existe pas ou si personne n'a is_admin = true, dites-le moi.
select id, email, nom, prenom, civilite, telephone, is_admin, created_at
from public.staff_users
order by created_at asc;
