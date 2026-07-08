-- ============================================================
-- SF MATCH — Table d'inventaire (stock agrégé des plateformes)
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  source text,            -- 'marketcheck', 'autoscout24', 'mobile', 'partner'...
  ext_id text,            -- identifiant de l'annonce chez la source
  marque text,
  modele text,
  annee text,
  prix text,
  couleur text,
  km text,
  segment text,           -- calculé à la synchro (supercar, suv_luxe, ...)
  url text,               -- lien vers l'annonce d'origine
  image text,
  ville text,
  updated_at timestamptz default now(),
  unique (source, ext_id)
);

create index if not exists idx_inventory_segment on public.inventory (segment);
create index if not exists idx_inventory_marque on public.inventory (lower(marque));

-- Lecture publique (données marché, non sensibles) ; écriture réservée au serveur (service_role)
alter table public.inventory enable row level security;
drop policy if exists "read_inventory_anon" on public.inventory;
create policy "read_inventory_anon" on public.inventory for select to anon using (true);
-- (pas de policy insert/update pour anon : seule la fonction de synchro, en service_role, écrit)
