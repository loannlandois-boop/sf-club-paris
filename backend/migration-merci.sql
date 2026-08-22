-- ============================================================
-- Ajoute la colonne de suivi pour l'e-mail de remerciement automatique
-- (projet deja cree : a coller dans SQL Editor -> Run, une seule fois)
-- ============================================================
alter table public.agenda_reservations
  add column if not exists merci_envoye boolean default false;
