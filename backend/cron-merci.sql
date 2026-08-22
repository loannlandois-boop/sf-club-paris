-- ============================================================
-- Planifie l'appel quotidien de la fonction agenda-merci (e-mail de
-- remerciement automatique à la fin de la location).
-- Remplacez <PROJECT_REF> et <ANON_KEY> avant de lancer (Run).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'agenda-merci-quotidien',
  '0 10 * * *',  -- tous les jours à 10h00 UTC (11h00 heure de Paris en hiver, 12h00 en été)
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/agenda-merci',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
