/* Offline support: caches the app shell, fonts, images and every text on the
   first visit.

   Navigations are NETWORK-FIRST: the app checks for a newer index.html when
   there is a connection, and falls back to the cache when there isn't. The
   old worker was cache-first for everything, which meant the ONLY way to
   ever see an update was for this file itself to change — so a deploy that
   missed sw.js froze the app permanently with no way out from the phone.
   The texts in content/ are network-first for the same reason: a corrected
   text reaches phones on their next launch with a connection, no bump needed.
   Everything else (fonts, images, icons, manifest) stays cache-first: it's
   large, it doesn't change, and it's what makes the app work with no signal. */
const CACHE = 'sacredtexts-v386'; // bump this whenever you update index.html
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './fonts/UthmanicHafs.otf', './fonts/Amiri-Regular.woff', './fonts/Amiri-Bold.woff',
  './img/medallion.png', './img/header-bismillah.png'];

/* How long the network gets before the cached copy is used instead. */
const NETWORK_TIMEOUT = 4000;

/* The texts: content/<section>/<piece>.json, next to this file. */
const CONTENT_URL = new URL('./content/', self.location.href).href;

/* Downloaded recitations live in their own cache, opened by the page rather
   than by this worker. It is listed here so the cleanup below spares it.

   This matters more than it looks. The cleanup deletes every cache whose name
   is not the current one — which is right for the app shell, and was quietly
   fatal for audio: a listener downloads all seven portions over the masjid
   wifi, a typo fix ships, and 150MB disappears on next launch with nothing
   said. Audio is expensive to fetch and must outlive app versions, so its
   cache name carries no version and is never swept.

   Anything added here must likewise be version-free, or it will be collected
   on the very next release. The name must be the page's own: AUDIO_CACHE in
   index.html. It once drifted (renamed here only), and every release then
   swept the downloads anyway. */
const AUDIO_CACHE = 'mawlid-audio';
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
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))
        .then(() => precacheContent(c)))
      .then(() => self.skipWaiting())
  );
});

/* Every text listed in content/index.json (the section folders) and in each
   folder's index.json (its pieces), so the app works offline from the first
   visit. Best effort, unlike the shell above: a missing or broken text must
   never stop a new worker from installing, or one typo would leave every
   installed app stuck on its old version. Whatever fails here is cached the
   first time the page asks for it. */
async function precacheContent(cache){
  const get = url => fetch(new Request(url, { cache: 'reload' }));
  try {
    const folders = await (await get('./content/index.json')).json();
    await Promise.allSettled(folders.map(async folder => {
      const dir = './content/' + folder + '/';
      const listing = await get(dir + 'index.json');
      if (!listing.ok) return;
      const names = await listing.clone().json();
      await cache.put(dir + 'index.json', listing);
      await Promise.allSettled(names.map(async name => {
        const resp = await get(dir + name + '.json');
        if (resp.ok) await cache.put(dir + name + '.json', resp);
      }));
    }));
  } catch (e) { /* no listing to read: the page fills the cache as it loads */ }
}

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => KEEP.indexOf(k) === -1).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Whether the page itself last came from the cache because the network
   didn't answer in time. Its texts then come straight from the cache too, so
   a weak signal costs one wait, not two. This lives only as long as the
   worker does; a fresh worker starts out trying the network. */
let shellFromCache = false;

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
        new Promise(res => setTimeout(() => res(null), NETWORK_TIMEOUT))
      ])
        .then(resp => { shellFromCache = !resp; return resp || caches.match('./index.html'); })
        .catch(() => { shellFromCache = true; return caches.match('./index.html'); })
    );
    return;
  }

  /* A text: network first, unless the page just had to come from the cache. */
  if (isText(req.url)) {
    e.respondWith(shellFromCache
      ? caches.match(req).then(cached => cached || networkFirst(req))
      : networkFirst(req));
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

function isText(url){
  return url.startsWith(CONTENT_URL) && new URL(url).pathname.endsWith('.json');
}

/* Ask the network and keep what comes back. 'no-cache' makes the browser
   revalidate its own HTTP-cached copy, so an unchanged file costs a small 304
   rather than a download, yet nothing stale is ever used. After
   NETWORK_TIMEOUT the cached copy is served; with no cached copy yet, keep
   waiting for the network rather than fail. */
function networkFirst(req){
  const network = fetch(new Request(req, { cache: 'no-cache' })).then(resp => {
    if (resp.ok) {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    }
    return resp;
  });
  const timeout = new Promise(res => setTimeout(() => res(null), NETWORK_TIMEOUT));
  return Promise.race([network.catch(() => null), timeout])
    .then(resp => resp || caches.match(req))
    .then(resp => resp || network)
    .catch(() => Response.error());
}
