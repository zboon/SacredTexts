-- Calendar reminders (web push). Run once in the Supabase dashboard:
-- SQL Editor -> New query -> paste -> Run.
--
-- Each phone that turns reminders on stores its push address here. The public (anon)
-- key can only call the two functions below: it cannot read, list or edit the table,
-- so nobody can see another device's address.
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  tz         text not null default 'UTC' check (char_length(tz) <= 64),
  last_sent  date
);

alter table public.push_subscriptions enable row level security;
-- No policies on purpose: only the functions below and the service role can touch it.
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.subscribe_push(p_endpoint text, p_p256dh text, p_auth text, p_tz text)
returns void language sql security definer set search_path = public as $$
  insert into public.push_subscriptions (endpoint, p256dh, auth, tz)
  values (p_endpoint, p_p256dh, p_auth, coalesce(nullif(p_tz, ''), 'UTC'))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz;
$$;

create or replace function public.unsubscribe_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

grant execute on function public.subscribe_push(text, text, text, text) to anon, authenticated;
grant execute on function public.unsubscribe_push(text) to anon, authenticated;

-- The hourly trigger. Needs the pg_cron and pg_net extensions (Database -> Extensions -> enable both).
-- Replace YOUR_CRON_SECRET with the same value you set as the CRON_SECRET function secret.
-- select cron.schedule('calendar-push-hourly', '0 * * * *', $job$
--   select net.http_post(
--     url := 'https://heduxokhztwdqcfamdfd.supabase.co/functions/v1/send-calendar-push',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
--     body := '{}'::jsonb);
-- $job$);
