-- Pickup / return reminder emails (send-rental-reminders) never ran: the
-- function requires CRON_SECRET and nothing was scheduled. NOT YET APPLIED —
-- apply with `supabase db push` (or paste into the SQL editor), then copy
-- Vault -> cron_secret into Edge Functions -> Secrets -> CRON_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'Bearer secret for send-rental-reminders');
  end if;
end $$;

-- Daily at 02:00 UTC (06:00 Dubai)
select cron.unschedule('send-rental-reminders') where exists (select 1 from cron.job where jobname = 'send-rental-reminders');
select cron.schedule(
  'send-rental-reminders',
  '0 2 * * *',
  $job$
  select net.http_post(
    url := 'https://blsuohqmeyzrqycqcjdr.supabase.co/functions/v1/send-rental-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
