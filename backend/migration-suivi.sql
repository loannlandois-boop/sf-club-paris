-- ============================================================
-- Ajoute : numero de reservation, statut de paiement, infos de vol
-- (projet deja cree : a coller dans SQL Editor -> Run, une seule fois)
-- ============================================================
alter table public.agenda_reservations
  add column if not exists reference text,
  add column if not exists paye boolean default false,
  add column if not exists caution_recue boolean default false,
  add column if not exists numero_vol text,
  add column if not exists heure_arrivee_vol text,
  add column if not exists heure_depart_vol text;

create unique index if not exists agenda_reservations_reference_key
  on public.agenda_reservations (reference) where reference is not null;
