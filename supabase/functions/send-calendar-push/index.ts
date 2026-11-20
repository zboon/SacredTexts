/* Sends the calendar reminders. Runs every hour (see docs/calendar-push-setup.sql).

   A reminder goes out at 18:00 in each device's own time zone, the evening BEFORE a date,
   because the Hijri day begins at sunset: at 18:00 on the 11th the 12th is about to begin.
   So "tomorrow's" Hijri date is the Hijri date of tomorrow's Gregorian day.

   Only urs and Islamic occasions notify. The dates are read from the published site, the
   same files the app reads, so a date added to the app is picked up with no change here.

   Written without type annotations so the logic can be tested in plain Node. */

export const SITE = 'https://zboon.github.io/SacredTexts/';
export const SEND_HOUR = 18;
export const NOTIFY_KINDS = ['urs', 'occasion'];
const MONTHS = ['Muḥarram', 'Ṣafar', 'Rabīʿ al-Awwal', 'Rabīʿ al-Thānī', 'Jumādā al-Ūlā', 'Jumādā al-Ākhira', 'Rajab', 'Shaʿbān', 'Ramaḍān', 'Shawwāl', 'Dhū al-Qaʿda', 'Dhū al-Ḥijja'];

/* The local calendar date and hour in a time zone. */
export function localParts(now, tz) {
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }); }
  catch (e) { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }); }
  const o = {};
  f.formatToParts(now).forEach(p => { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
  return { y: o.year, m: o.month, d: o.day, hour: o.hour };
}
export function isoDate(p) { return p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0'); }

/* Hijri date (Umm al-Qura, as the app shows it) of a Gregorian y/m/d. */
export function hijriOf(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
  const o = {};
  f.formatToParts(date).forEach(p => { if (p.type === 'day' || p.type === 'month' || p.type === 'year') o[p.type] = parseInt(p.value, 10); });
  return { y: o.year, m: o.month, d: o.day };
}

export function tomorrowOf(p) {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + 1, 12));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function stripNum(t) { return String(t || '').replace(/^\s*\d+\s*·\s*/, ''); }
function normDate(src) {
  if (!src || typeof src !== 'object') return null;
  let h = null, g = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(src.gregorian || '');
  if (m) g = { m: +m[2], d: +m[3] };
  if (src.hijri && +src.hijri.month >= 1 && +src.hijri.month <= 12 && +src.hijri.day >= 1 && +src.hijri.day <= 30) h = { m: +src.hijri.month, d: +src.hijri.day };
  return (h || g) ? { h, g } : null;
}

/* Pieces in the same shape the app uses: standalone events plus `died` on silsila pieces. */
export function buildEvents(standalone, silsila) {
  const out = [];
  standalone.forEach(e => {
    const dt = normDate(e);
    if (dt && NOTIFY_KINDS.includes(e.kind)) out.push({ kind: e.kind, title: e.titleEnglish, dt });
  });
  silsila.forEach(p => {
    const dt = normDate(p.died);
    if (dt) out.push({ kind: 'urs', title: stripNum(p.titleEnglish), dt });
  });
  return out;
}

export function eventsOnDay(events, h, y, m, d) {
  return events.filter(e => e.dt.h ? (e.dt.h.m === h.m && e.dt.h.d === h.d) : (e.dt.g.m === m && e.dt.g.d === d));
}

/* The notification text, or null when nothing begins tonight. */
export function messageFor(list, h) {
  if (!list.length) return null;
  const ord = { urs: 0, occasion: 1 };
  const sorted = list.slice().sort((a, b) => ord[a.kind] - ord[b.kind]);
  const when = h.d + ' ' + MONTHS[h.m - 1];
  const name = e => (e.kind === 'urs' ? 'Urs of ' : '') + e.title;
  if (sorted.length === 1) return { title: name(sorted[0]), body: 'Begins at sunset tonight · ' + when, tag: 'calendar-' + h.y + '-' + h.m + '-' + h.d };
  const shown = sorted.slice(0, 4).map(name).join(', ') + (sorted.length > 4 ? ' and ' + (sorted.length - 4) + ' more' : '');
  return { title: sorted.every(e => e.kind === 'urs') ? 'Urs tonight' : 'Tonight', body: shown + ' · begins at sunset · ' + when, tag: 'calendar-' + h.y + '-' + h.m + '-' + h.d };
}

/* Which subscriptions are due now: it is SEND_HOUR where they are, and not already sent today. */
export function dueSubscriptions(subs, now) {
  return subs.filter(s => {
    const p = localParts(now, s.tz || 'UTC');
    return p.hour === SEND_HOUR && s.last_sent !== isoDate(p);
  });
}

async function readJson(url) {
  const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}
export async function loadEvents(site) {
  const calIdx = await readJson(site + 'content/calendar/index.json');
  const silIdx = await readJson(site + 'content/silsila/index.json');
  const standalone = await Promise.all(calIdx.map(n => readJson(site + 'content/calendar/' + n + '.json')));
  const silsila = await Promise.all(silIdx.map(n => readJson(site + 'content/silsila/' + n + '.json').catch(() => ({}))));
  return buildEvents(standalone, silsila);
}

export async function run(env, deps) {
  const { sb, webpush, now = new Date(), site = SITE } = deps;
  const subs = await sb.listSubscriptions();
  const due = dueSubscriptions(subs, now);
  if (!due.length) return { subscriptions: subs.length, due: 0, sent: 0 };
  const events = await loadEvents(site);
  const sent = { ok: 0, gone: 0, failed: 0, none: 0 };
  /* One Hijri lookup per distinct local date. */
  const cache = {};
  for (const s of due) {
    const p = localParts(now, s.tz || 'UTC');
    const key = isoDate(p);
    if (!cache[key]) {
      const t = tomorrowOf(p), h = hijriOf(t.y, t.m, t.d);
      cache[key] = messageFor(eventsOnDay(events, h, t.y, t.m, t.d), h);
    }
    const msg = cache[key];
    if (!msg) { sent.none++; await sb.markSent(s.id, key); continue; }
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag }), { TTL: 6 * 3600 });
      sent.ok++; await sb.markSent(s.id, key);
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { sent.gone++; await sb.remove(s.id); }
      else sent.failed++;
    }
  }
  return { subscriptions: subs.length, due: due.length, ...sent };
}

/* ---- Supabase Edge runtime ---- */
if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve(async req => {
    const env = Deno.env;
    if (req.headers.get('x-cron-secret') !== env.get('CRON_SECRET') || !env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
    const url = env.get('SUPABASE_URL'), key = env.get('SUPABASE_SERVICE_ROLE_KEY');
    const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
    const sb = {
      listSubscriptions: async () => (await fetch(url + '/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth,tz,last_sent&limit=100000', { headers: H })).json(),
      markSent: (id, day) => fetch(url + '/rest/v1/push_subscriptions?id=eq.' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ last_sent: day }) }),
      remove: id => fetch(url + '/rest/v1/push_subscriptions?id=eq.' + id, { method: 'DELETE', headers: H }),
    };
    const webpush = (await import('npm:web-push@3.6.7')).default;
    webpush.setVapidDetails(env.get('VAPID_SUBJECT') || 'mailto:admin@example.com', env.get('VAPID_PUBLIC_KEY'), env.get('VAPID_PRIVATE_KEY'));
    try {
      return new Response(JSON.stringify(await run(env, { sb, webpush })), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(String(e && e.message || e), { status: 500 });
    }
  });
}
