-- Temporary Blogdel four-category archive recovery runner.
-- One category runs per minute in rotation, two articles per request.
-- Each job removes itself when its queue and in-flight work are exhausted.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare job_name text;
begin
  foreach job_name in array array[
    'blogdel-recover-technology',
    'blogdel-recover-health',
    'blogdel-recover-sports',
    'blogdel-recover-politics'
  ]
  loop
    if exists (select 1 from cron.job where jobname = job_name) then
      perform cron.unschedule(job_name);
    end if;
  end loop;
end $$;

select cron.schedule(
  'blogdel-recover-technology',
  '0-59/4 * * * *',
  $job$
  do $run$
  begin
    if exists (
      select 1 from public.source_items
      where external_id like 'tech-archive-2026-%' and status = 'queued'
    ) then
      perform net.http_post(
        url := 'https://blogdel.blog/api/public/cron/backfill-archive/technology?limit=2',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='CRON_TOKEN' order by created_at desc limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
    elsif not exists (
      select 1 from public.source_items
      where external_id like 'tech-archive-2026-%' and status = 'pending'
    ) then
      perform cron.unschedule('blogdel-recover-technology');
    end if;
  end
  $run$;
  $job$
);

select cron.schedule(
  'blogdel-recover-health',
  '1-59/4 * * * *',
  $job$
  do $run$
  begin
    if exists (
      select 1 from public.source_items
      where external_id like 'health-archive-2026-%' and status = 'queued'
    ) then
      perform net.http_post(
        url := 'https://blogdel.blog/api/public/cron/backfill-archive/health?limit=2',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='CRON_TOKEN' order by created_at desc limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
    elsif not exists (
      select 1 from public.source_items
      where external_id like 'health-archive-2026-%' and status = 'pending'
    ) then
      perform cron.unschedule('blogdel-recover-health');
    end if;
  end
  $run$;
  $job$
);

select cron.schedule(
  'blogdel-recover-sports',
  '2-59/4 * * * *',
  $job$
  do $run$
  begin
    if exists (
      select 1 from public.source_items
      where external_id like 'sports-archive-2026-%' and status = 'queued'
    ) then
      perform net.http_post(
        url := 'https://blogdel.blog/api/public/cron/backfill-archive/sports?limit=2',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='CRON_TOKEN' order by created_at desc limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
    elsif not exists (
      select 1 from public.source_items
      where external_id like 'sports-archive-2026-%' and status = 'pending'
    ) then
      perform cron.unschedule('blogdel-recover-sports');
    end if;
  end
  $run$;
  $job$
);

select cron.schedule(
  'blogdel-recover-politics',
  '3-59/4 * * * *',
  $job$
  do $run$
  begin
    if exists (
      select 1 from public.source_items
      where external_id like 'politics-archive-2026-%' and status = 'queued'
    ) then
      perform net.http_post(
        url := 'https://blogdel.blog/api/public/cron/backfill-archive/politics?limit=2',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='CRON_TOKEN' order by created_at desc limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
    elsif not exists (
      select 1 from public.source_items
      where external_id like 'politics-archive-2026-%' and status = 'pending'
    ) then
      perform cron.unschedule('blogdel-recover-politics');
    end if;
  end
  $run$;
  $job$
);
