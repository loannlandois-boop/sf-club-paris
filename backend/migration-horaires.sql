-- ============================================================
-- Ajoute l'adresse de livraison et les horaires aux réservations
-- (projet déjà créé : à coller dans SQL Editor → Run, une seule fois)
-- ============================================================
alter table public.agenda_reservations
  add column if not exists adresse_livraison text,
  add column if not exists heure_debut text,
  add column if not exists heure_fin text;
