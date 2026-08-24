-- ============================================================
-- Ajoute le suivi de l'e-mail/offre de bienvenue (evite un double credit)
-- A coller dans SQL Editor -> Run, une seule fois
-- ============================================================
alter table public.clients
  add column if not exists bienvenue_envoye boolean not null default false;
