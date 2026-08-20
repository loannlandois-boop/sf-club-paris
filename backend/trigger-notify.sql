-- ============================================================
-- Déclencheur automatique : à chaque nouvelle ligne dans listings/searches,
-- appelle la fonction notify-buyers (qui envoie les e-mails).
-- Remplacez <PROJECT_REF> et <ANON_KEY> ci-dessous avant de lancer (Run),
-- puis collez ce script dans SQL Editor.
-- ============================================================

create extension if not exists pg_net;

create or replace function public.sfmatch_notify()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://cuohpntjpkpwvhspzads.supabase.co/functions/v1/notify-buyers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2hwbnRqcGtwd3Zoc3B6YWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzMxMzgsImV4cCI6MjEwMjgwOTEzOH0.gAEYzBI0FMi63PjC3TRLvseirT-piMdwzriAYnt9PJQ'
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', row_to_json(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists sfmatch_listings_notify on public.listings;
create trigger sfmatch_listings_notify
after insert on public.listings
for each row execute function public.sfmatch_notify();

drop trigger if exists sfmatch_searches_notify on public.searches;
create trigger sfmatch_searches_notify
after insert on public.searches
for each row execute function public.sfmatch_notify();
