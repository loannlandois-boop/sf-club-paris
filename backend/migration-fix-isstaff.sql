-- ============================================================
-- CORRECTIF IMPORTANT : is_staff() ne pouvait pas lire staff_users
-- (la table staff_users n'a aucune policy de lecture pour un compte
-- normal, et is_staff() n'etait pas "security definer" -> elle
-- s'executait avec les droits de l'appelant, donc etait bloquee par
-- cette meme regle). Resultat : is_staff() pouvait renvoyer faux la
-- ou elle devrait renvoyer vrai, meme pour un vrai compte equipe.
--
-- A coller dans SQL Editor -> Run, une seule fois.
-- ============================================================
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff_users where id = auth.uid());
$$;
