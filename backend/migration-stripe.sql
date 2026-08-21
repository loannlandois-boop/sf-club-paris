-- ============================================================
-- Ajoute la caution (par vehicule) et les liens de paiement Stripe
-- (projet deja cree : a coller dans SQL Editor -> Run, une seule fois)
-- ============================================================
alter table public.agenda_vehicules
  add column if not exists caution numeric;

alter table public.agenda_reservations
  add column if not exists lien_paiement text,
  add column if not exists lien_caution text;
