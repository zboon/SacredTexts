# Calendar reminders: one-time setup

The app side is built and switched off. It stays hidden until you finish these steps, so nothing changes for anyone meanwhile.

A phone that turns reminders on gets **one notification at 6 pm its own time, the evening before an urs or an Islamic occasion** (the Hijri day begins at sunset). The dates are read from the live site, so a date you add to the app is picked up automatically.

On iPhone this only works once the app is added to the Home Screen (iOS 16.4 or later). Android works from the installed app or the browser.

## 1. Create the table and functions
Supabase dashboard → SQL Editor → New query → paste `docs/calendar-push-setup.sql` (leave the last, commented `cron.schedule` block for step 4) → Run.

## 2. Make the keys (on any computer with Node)
    npx web-push generate-vapid-keys
You get a **public** and a **private** key. The private one never goes in the app or in chat.

## 3. Deploy the function
Dashboard → Edge Functions → Deploy a new function → name it `send-calendar-push` → paste `supabase/functions/send-calendar-push/index.ts` → turn **off** "Verify JWT" → Deploy.
Then Edge Functions → Secrets, add:

| Secret | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:` plus an address people can reach you on |
| `CRON_SECRET` | any long random string you make up |

## 4. Schedule it hourly
Database → Extensions: enable `pg_cron` and `pg_net`. In the SQL Editor run the commented `cron.schedule` block at the bottom of `docs/calendar-push-setup.sql`, with `YOUR_CRON_SECRET` replaced by your `CRON_SECRET`.

## 5. Switch the app on
Give Claude the **public** key (or put it in `calendar.js`, `var VAPID_PUBLIC_KEY = '...'`) and merge. The calendar then shows a "Reminders" box with a "Remind me" button.

## Checking it works
Run the function once by hand: Edge Functions → `send-calendar-push` → test with header `x-cron-secret`. It answers with counts (`subscriptions`, `due`, `ok`, `gone`). `due` is 0 outside 6 pm somewhere, which is normal.

## Good to know
- A phone that blocks notifications or uninstalls the app is removed automatically the next time a send to it fails.
- Births and history entries do not notify, only urs and occasions.
- Anyone can turn reminders off from the same box. The stored address is never readable by the public key.
