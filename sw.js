/* Offline support: caches the app shell and fonts on first visit.

   Navigations are NETWORK-FIRST: the app checks for a newer index.html when
   there is a connection, and falls back to the cache when there isn't. The
   old worker was cache-first for everything, which meant the ONLY way to
   ever see an update was for this file itself to change — so a deploy that
   missed sw.js froze the app permanently with no way out from the phone.
   Everything else (fonts, icons, manifest) stays cache-first: it's large,
   it doesn't change, and it's what makes the app work with no signal. */
const CACHE = 'nhacademy-v382'; // bump this whenever you update index.html
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

/* Downloaded recitations live in their own cache, opened by the page rather
   than by this worker. It is listed here so the cleanup below spares it.

   This matters more than it looks. The cleanup deletes every cache whose name
   is not the current one — which is right for the app shell, and was quietly
   fatal for audio: a listener downloads all seven portions over the masjid
   wifi, a typo fix ships, and 150MB disappears on next launch with nothing
   said. Audio is expensive to fetch and must outlive app versions, so its
   cache name carries no version and is never swept.

   Anything added here must likewise be version-free, or it will be collected
   on the very next release. */
const AUDIO_CACHE = 'nhacademy-audio';
const KEEP = [CACHE, AUDIO_CACHE];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      /* cache:'reload' bypasses the browser's HTTP cache. addAll() does NOT do
         this by default, and the consequence was ugly: a newly installed
         worker could precache the PREVIOUS index.html — the copy still sitting
         in the HTTP cache from before the deploy — and then the timeout path
         below would serve that stale page whenever the network was slow. The
         app appeared to update, then flipped back to the old build on the next
         refresh. Always fetch the shell fresh at install. */
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => KEEP.indexOf(k) === -1).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* The page itself: try the network, keep what comes back, fall back to the
     cache. A slow connection shouldn't mean a blank screen, so the network
     attempt gives up after 4 seconds and the cached shell is used instead. */
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([
        /* Same reasoning: ask the network, not the HTTP cache, or a stale
           copy gets stored and served back as though it were current. */
        fetch(new Request(req.url, { cache: 'no-store' })).then(resp => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          }
          return resp;
        }),
        new Promise(res => setTimeout(() => res(null), 4000))
      ])
        .then(resp => resp || caches.match('./index.html'))
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        /* Cache same-origin successes AND opaque cross-origin responses.
           The Google Fonts stylesheet is fetched no-cors, so it comes back
           opaque with status 0 and resp.ok === false — without the opaque
           check it was never cached, and the Arabic font quietly fell back
           to a system font offline. */
        if (resp && (resp.ok || resp.type === 'opaque')) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        /* Handing back HTML for a stylesheet or font request just breaks it. */
        return Response.error();
      });
    })
  );
});
