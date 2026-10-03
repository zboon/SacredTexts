# Content in Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every text out of `index.html` into `content/<section>/<piece>.json`, load the texts at startup, and move the bundled fonts and images into `fonts/` and `img/`. The app must behave exactly as before, offline included.

**Architecture:**
- A one-off Node script cuts the 14 content arrays out of `index.html`. It writes one JSON file per piece, plus an `index.json` per folder that sets the order.
- The arrays keep their names but start empty. `loadContent()` fills them before the first render, so none of the code that reads them changes.
- `sw.js` precaches every text it finds in the listings, and serves texts network-first.

**Tech Stack:**
- Plain HTML, CSS and JS: no build step, no dependencies.
- A service worker for offline use.
- Node 24 built-ins (`node:test`, `node:vm`, `node:crypto`) for throwaway scripts.
- Python's `http.server` for the local preview.
- The Browser pane for in-browser checks.

**Spec:** `docs/superpowers/specs/2026-10-03-content-files-design.md`

## Global Constraints

- **No build step and no runtime dependencies.** Throwaway scripts live in `.work/`, use Node built-ins only, and are never committed.
- **Every text stays identical byte for byte.** Never retype Arabic, and never call `.normalize()` on content. Texts move only through `.work/migrate-content.mjs`.
- **JSON files:** UTF-8 without a BOM, Arabic as literal characters, 2-space indentation, a final newline, and LF line endings in the repository.
- **Layout:**
  - one folder per content array, one file per piece
  - each folder's `index.json` lists file names without `.json`, in reading order
  - `content/index.json` lists the folders
- **File names** follow the spec's naming rule and must equal the spec's appendix.
- **`fonts/UthmanicHafs.otf` is the original font byte for byte.** The KFGQPC licence forbids modification, so it is never converted or subset.
- **Version bump:** don't bump `APP_VERSION` or `CACHE` before Task 6. Then go from `v385` to `v386` in both at once.
- **Line endings:** existing files have CRLF line endings in the working copy (`core.autocrlf=true`; the repository stores LF). Scripts detect and reuse each file's line ending.
- **The reference for "nothing changed"** is commit `38d413f`, `main` when this branch was cut.
- **Commits:** messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `git add` with explicit paths only.

## Review Focus

These are the failure modes most likely to bite a person using the app, and where each is pinned:

1. **A piece that is valid JSON but lacks `verses` or `titleEnglish`.** Its section reports the file and stays empty; search and the readers never crash. → Task 3, Step 7.
2. **An `index.json` that names a file that doesn't exist** (a typo, a renamed file, or `.json` written into the name). The notice names the missing path, and the Dalāʾil screens show the placeholder instead of crashing. → Task 3, Step 5.
3. **A piece saved by a Windows editor with a UTF-8 byte-order mark.** It loads normally. → Task 3, Step 8.
4. **A new service worker installing while a listed text is missing or not JSON.** The install still succeeds, so phones never get stuck on an old version. → Task 1, test "a missing or broken text never stops the install".
5. **A text corrected on the server while phones hold the old copy.** The next launch with a connection shows the correction, with no cache bump. → Task 1, test "a text comes from the network, revalidated, and refreshes the cache"; Task 6, Step 5.

## Before you start

- **Browser steps** use the Browser pane tools (`mcp__Claude_Browser__*`): `preview_start`, `preview_stop`, `tabs_create`, `tabs_context`, `navigate`, `javascript_tool`, `read_console_messages` and `computer` (for screenshots). Steps marked **(browser)** need them. A subagent without them hands those steps back to the main session.
- **Every commit prints a hook error.** About 20 seconds after each commit, `fatal: unable to access 'https://bitbucket.css.de:8443/scm/ega/githooks.git/'` appears: a company git hook that can't reach its server. The commit still succeeds; confirm with `git log --oneline -1`.
- **All commands run from the repository root,** `C:/Entwicklung/Documents/a_personal/Projects/SacredTexts`, in Git Bash.

## File map

| Path | Change | Responsibility |
|---|---|---|
| `sw.js` | modify | Precache the shell, fonts, images and every text; serve texts network-first |
| `index.html` | modify | Content declarations + loader at the top of the script; startup after loading; load-failure UI; fonts and images by URL |
| `content/index.json` | create | The section folders, for the service worker |
| `content/<folder>/index.json` | create (14) | Each section's pieces, in reading order |
| `content/<folder>/<name>.json` | create (152) | One piece each |
| `content/README.md` | create | How to write and add pieces |
| `fonts/UthmanicHafs.otf`, `fonts/Amiri-Regular.woff`, `fonts/Amiri-Bold.woff` | create | The Arabic faces, byte for byte |
| `img/medallion.png`, `img/header-bismillah.png` | create | The masthead art, byte for byte |
| `.claude/launch.json` | create | The local preview server (`python -m http.server 8000`) |
| `README.md`, `CONTRIBUTING.md` | rewrite | Docs for the new layout |
| `.work/*` | create, never committed | Throwaway migration scripts and checks; `.work/base` is a worktree of `38d413f` |

---

### Task 1: Service worker: network-first texts, precached from the listings

**Files:**
- Modify: `sw.js` (whole file)
- Test: `.work/sw.test.mjs` (never committed)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - **New `sw.js` top-level names:** `NETWORK_TIMEOUT` (4000), `CONTENT_URL`, `precacheContent(cache)`, `shellFromCache`, `isText(url)` and `networkFirst(req)`.
  - **`CORE` keeps its name.** Task 4 appends font and image paths to it.
  - **The test harness:** `.work/sw.test.mjs` derives the shell routes from `CORE`, so Task 4 only re-runs it.

- [ ] **Step 1: Set up the scratch folder, excluded from git without touching `.gitignore`**

```bash
mkdir -p .work
grep -qx '.work/' .git/info/exclude || echo '.work/' >> .git/info/exclude
git status --short
```

Expected: no line for `.work/`.

- [ ] **Step 2: Write the failing tests**

Create `.work/sw.test.mjs`:

```js
// .work/sw.test.mjs: run from the repo root with: node --test .work/sw.test.mjs
// Loads sw.js into a sandbox with a fake network, a fake Cache Storage and a
// fake clock, then fires install and fetch events at it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const BASE = 'http://localhost:8000/';
const SW_URL = BASE + 'sw.js';
const SOURCE = readFileSync('sw.js', 'utf8');
const CACHE_NAME = SOURCE.match(/const CACHE = '([^']+)'/)[1];
const abs = u => new URL(u, SW_URL).href;
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };

class FakeRequest {
  constructor(input, init = {}){
    const src = typeof input === 'string' ? { url: input } : input;
    this.url = abs(src.url);
    this.method = 'GET';
    this.mode = init.mode || src.mode || 'cors';
    this.cache = init.cache || src.cache || 'default';
  }
}

function loadWorker(){
  /* routes maps a path (relative to BASE) to: a string body (answered 200),
     { status } (answered with that status), 'stall' (never answers), a promise
     (answers when the test resolves it), or nothing at all, which fails the
     way an offline fetch does. Every request is recorded in calls. */
  const routes = {};
  const calls = [];
  const fetch = (input, init) => {
    const req = new FakeRequest(input, init);
    calls.push(req);
    const route = routes[req.url.slice(BASE.length)];
    if (route === undefined) return Promise.reject(new TypeError('Failed to fetch'));
    if (route === 'stall') return new Promise(() => {});
    if (typeof route.then === 'function') return route;
    if (typeof route === 'object') return Promise.resolve(new Response(route.body || '', { status: route.status }));
    return Promise.resolve(new Response(route, { status: 200 }));
  };

  let now = 0;
  const timers = [];
  const setTimeout = (fn, ms = 0) => { timers.push({ at: now + ms, fn }); return timers.length; };
  const tick = async ms => {
    await settle();
    now += ms;
    for (const t of timers) if (!t.done && t.at <= now) { t.done = true; t.fn(); }
    await settle();
  };

  const stores = new Map();
  const keyOf = r => abs(typeof r === 'string' ? r : r.url);
  const cacheApi = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      put: async (r, resp) => { m.set(keyOf(r), resp); },
      match: async r => m.get(keyOf(r))?.clone(),
      addAll: async reqs => {
        for (const r of reqs) {
          const resp = await fetch(r);
          if (!resp.ok) throw new TypeError(`addAll: ${r.url} answered ${resp.status}`);
          m.set(keyOf(r), resp);
        }
      },
    };
  };
  const caches = {
    open: async name => cacheApi(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async r => {
      for (const m of stores.values()) { const hit = m.get(keyOf(r)); if (hit) return hit.clone(); }
    },
  };

  const listeners = {};
  const ctx = {
    console, URL, Response, setTimeout, fetch, caches,
    Request: FakeRequest,
    location: new URL(SW_URL),
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  const core = vm.runInContext('CORE', ctx);

  return {
    routes, calls, tick, caches, core,
    /* Answer every CORE file, so that an install can succeed. */
    serveShell(){ for (const u of core) routes[abs(u).slice(BASE.length)] = 'shell'; },
    async seed(path, body){ await (await caches.open(CACHE_NAME)).put(BASE + path, new Response(body)); },
    async cached(path){ const r = await caches.match(BASE + path); return r && r.text(); },
    async install(){ let done; listeners.install({ waitUntil: p => { done = p; } }); await done; },
    request(path, mode = 'cors'){
      let answer;
      listeners.fetch({ request: new FakeRequest(BASE + path, { mode }), respondWith: p => { answer = Promise.resolve(p); } });
      return answer;
    },
  };
}

const TEXTS = {
  'content/index.json': JSON.stringify(['dalail', 'burdah']),
  'content/dalail/index.json': JSON.stringify(['title-page', 'monday-part-1']),
  'content/dalail/title-page.json': '{"titleEnglish":"Title Page","verses":[]}',
  'content/dalail/monday-part-1.json': '{"titleEnglish":"Monday — Part 1","verses":[]}',
  'content/burdah/index.json': JSON.stringify(['on-his-miracles']),
  'content/burdah/on-his-miracles.json': '{"titleEnglish":"5 · On His Miracles","verses":[]}',
};

test('install caches the shell and every listed text', async () => {
  const w = loadWorker();
  w.serveShell();
  Object.assign(w.routes, TEXTS);
  await w.install();
  for (const u of w.core) assert.ok(await w.caches.match(abs(u)), `${u} is cached`);
  for (const path of Object.keys(TEXTS).filter(p => p !== 'content/index.json'))
    assert.equal(await w.cached(path), TEXTS[path], `${path} is cached`);
});

test('a missing or broken text never stops the install', async () => {
  const w = loadWorker();
  w.serveShell();
  Object.assign(w.routes, TEXTS, {
    'content/dalail/monday-part-1.json': { status: 404 },
    'content/burdah/index.json': 'not json',
  });
  await w.install();
  assert.ok(await w.caches.match(BASE + 'index.html'));
  assert.equal(await w.cached('content/dalail/title-page.json'), TEXTS['content/dalail/title-page.json']);
  assert.equal(await w.cached('content/dalail/monday-part-1.json'), undefined);
});

test('install works when there is no content listing at all', async () => {
  const w = loadWorker();
  w.serveShell();
  await w.install();
  assert.ok(await w.caches.match(BASE + 'index.html'));
});

test('a text comes from the network, revalidated, and refreshes the cache', async () => {
  const w = loadWorker();
  await w.seed('content/dalail/title-page.json', 'old');
  w.routes['content/dalail/title-page.json'] = 'new';
  const resp = await w.request('content/dalail/title-page.json');
  assert.equal(await resp.text(), 'new');
  assert.equal(w.calls.at(-1).cache, 'no-cache');
  await w.tick(0);
  assert.equal(await w.cached('content/dalail/title-page.json'), 'new');
});

test('offline, a text comes from the cache', async () => {
  const w = loadWorker();
  await w.seed('content/dalail/title-page.json', 'cached');
  const resp = await w.request('content/dalail/title-page.json');
  assert.equal(await resp.text(), 'cached');
});

test('a stalled network gives way to the cached text after 4 seconds', async () => {
  const w = loadWorker();
  await w.seed('content/dalail/title-page.json', 'cached');
  w.routes['content/dalail/title-page.json'] = 'stall';
  let settled = false;
  const answer = w.request('content/dalail/title-page.json');
  answer.then(() => { settled = true; });
  await w.tick(3999);
  assert.equal(settled, false, 'still waiting at 3.999 s');
  await w.tick(1);
  assert.equal(await (await answer).text(), 'cached');
});

test('with nothing cached, a slow text is waited for', async () => {
  const w = loadWorker();
  let reply;
  w.routes['content/dalail/title-page.json'] = new Promise(r => { reply = r; });
  let settled = false;
  const answer = w.request('content/dalail/title-page.json');
  answer.then(() => { settled = true; });
  await w.tick(5000);
  assert.equal(settled, false, 'no cached copy, so it keeps waiting');
  reply(new Response('late', { status: 200 }));
  assert.equal(await (await answer).text(), 'late');
});

test('when the page came from the cache, texts skip the network', async () => {
  const w = loadWorker();
  await w.seed('index.html', 'cached page');
  await w.seed('content/dalail/title-page.json', 'cached text');
  w.routes[''] = 'stall';
  const page = w.request('', 'navigate');
  await w.tick(4000);
  assert.equal(await (await page).text(), 'cached page');
  const asked = w.calls.length;
  const resp = await w.request('content/dalail/title-page.json');
  assert.equal(await resp.text(), 'cached text');
  assert.equal(w.calls.length, asked, 'no network request for the text');
});

test('when the page came from the network, texts do too', async () => {
  const w = loadWorker();
  w.routes[''] = '<html>';
  await w.request('', 'navigate');
  await w.seed('content/dalail/title-page.json', 'cached');
  w.routes['content/dalail/title-page.json'] = 'fresh';
  assert.equal(await (await w.request('content/dalail/title-page.json')).text(), 'fresh');
});

test('other files stay cache-first', async () => {
  const w = loadWorker();
  await w.seed('manifest.json', 'cached');
  w.routes['manifest.json'] = 'fresh';
  assert.equal(await (await w.request('manifest.json')).text(), 'cached');
});
```

- [ ] **Step 3: Run the tests against today's `sw.js` and confirm they fail**

Run: `node --test .work/sw.test.mjs`

Expected: the summary shows `ℹ fail 5` and `ℹ pass 5`. These five fail:
- "install caches the shell and every listed text"
- "a missing or broken text never stops the install"
- "a text comes from the network, revalidated, and refreshes the cache"
- "a stalled network gives way to the cached text after 4 seconds"
- "when the page came from the network, texts do too"

Today's worker is cache-first for everything except the page, and it caches no texts at install. If the harness itself throws (for example `CORE is not defined`), fix the harness before going on.

- [ ] **Step 4: Replace `sw.js` with the new worker**

Write `sw.js` with exactly this content:

```js
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
const CACHE = 'sacredtexts-v385'; // bump this whenever you update index.html
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

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
   on the very next release. */
const AUDIO_CACHE = 'sacredtexts-audio';
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
```

- [ ] **Step 5: Run the tests and confirm they all pass**

Run: `node --test .work/sw.test.mjs`

Expected: the summary shows `ℹ pass 10` and `ℹ fail 0`. Node 24's default reporter prints `✔`/`✖` per test, not TAP.

- [ ] **Step 6: Commit**

```bash
git add sw.js
git commit -m "Serve texts network-first and precache them from the content listings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 2: Texts into `content/`, loaded at startup

**Files:**
- Create: `content/index.json`, `content/<folder>/index.json` (14), `content/<folder>/<name>.json` (152), `.claude/launch.json`
- Modify: `index.html`. The migration script does most of it; the boot edit and the loading line are done by hand.
- Test: `.work/content-lib.mjs`, `.work/check-content.mjs`, `.work/parse-check.mjs`, `.work/snapshot.js` (never committed)

**Interfaces:**
- Consumes: from Task 1, `sw.js` serves `content/…json` network-first. Edits show on reload.
- Produces (in `index.html`):
  - `CONTENT_ROOT` (`'content/'`)
  - `CONTENT_SECTIONS: { folder: string, pieces: object[] }[]`
  - `contentSection(folder: string): object[]`
  - `fetchJSON(path: string): Promise<any>`, which rejects with an `Error` whose message starts with `path`
  - `loadSection({ folder, pieces }): Promise<string[]>`, which resolves with error messages (none when the section loaded)
  - `loadContent(): Promise<{ errors: string[], nothingLoaded: boolean }>`
  - `start()` and `joinFromLink()`
- Produces (in `.work/`):
  - **`content-lib.mjs`** exports `BASE_COMMIT`, `SECTIONS` (`{ folder, array }[]`), `baseHtml()`, `arrayRange(lines, name)`, `arrayValue(lines, name)` and `fileNames(pieces)`.
  - **`snapshot.js`** defines `window.__snapshot()` and `window.__compare(other, mine)`.
  - **Two local servers.** `.claude/launch.json` has a config named `sacredtexts` on port 8000. The old app is served at `http://127.0.0.1:8000/.work/base/index.html`, a different origin from `localhost:8000` so it can't share service workers or storage with the new app.

- [ ] **Step 1: Add the local server config, start it, and check out the old version beside it**

Create `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "sacredtexts",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8000"],
      "port": 8000
    }
  ]
}
```

```bash
git worktree add .work/base 38d413f
```

**(browser)** Start the server with `preview_start` (name `sacredtexts`). The Browser pane opens `http://localhost:8000`, which still shows the app as it is today. Open a second tab with `tabs_create`, then `navigate` it to `http://127.0.0.1:8000/.work/base/index.html`. Note both tab ids (`tabs_context`).

- [ ] **Step 2: (browser) Make bookmarks in the current app so the switch can be checked against them**

In the `localhost:8000` tab, run with `javascript_tool`. Every snippet in this plan that declares names is wrapped in an async function, so its names can't collide with the app's own globals.

```js
await (async () => {
  state.pageView = false; openDalail(7); saveDalailPlace(7);
  toggleFav('b', 4); toggleFav('d', 7); toggleFav('i', 0);
  goHome();
  return { favs: JSON.parse(localStorage.getItem('mawlid-favs')),
           place: JSON.parse(localStorage.getItem('mawlid-dalail-place')).title };
})()
```

Expected: `favs` is `["b|5 · On His Miracles", "d|Tuesday", "i|Gelin Ey Aşıklar — Come, O Lovers"]` and `place` is `"Tuesday"`.

- [ ] **Step 3: Write the shared helpers**

Create `.work/content-lib.mjs`:

```js
// .work/content-lib.mjs: shared by the migration and the checks. Never committed.
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

/* main when this branch was cut: the reference for "nothing changed". */
export const BASE_COMMIT = '38d413f';

/* Every content array and its folder, in the order index.html declares them. */
export const SECTIONS = [
  { folder: 'qasidas',     array: 'QASIDAS' },
  { folder: 'sirah',       array: 'SIRAH_CHAPTERS' },
  { folder: 'barzanji',    array: 'BARZANJI_CHAPTERS' },
  { folder: 'diya',        array: 'DIYA_CHAPTERS' },
  { folder: 'burdah',      array: 'BURDAH_CHAPTERS' },
  { folder: 'dalail',      array: 'DALAIL_CHAPTERS' },
  { folder: 'litanies',    array: 'LITANY_CHAPTERS' },
  { folder: 'silsila',     array: 'SILSILA_CHAPTERS' },
  { folder: 'turuqs',      array: 'TURUQ_CHAPTERS' },
  { folder: 'sohbets',     array: 'SOHBET_CHAPTERS' },
  { folder: 'ilahis',      array: 'ILAHI_CHAPTERS' },
  { folder: 'nasheeds',    array: 'NASHEED_CHAPTERS' },
  { folder: 'biographies', array: 'BIOGRAPHY_CHAPTERS' },
  { folder: 'ottoman',     array: 'OTTOMAN_CHAPTERS' },
];

/* index.html as it was at BASE_COMMIT. */
export function baseHtml(){
  return execFileSync('git', ['show', `${BASE_COMMIT}:index.html`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/* Where an array literal sits, as 0-based line indexes: from "const NAME = ["
   to the first line that is exactly "];" (the same line for "[];"). */
export function arrayRange(lines, name){
  const start = lines.findIndex(l => l.startsWith(`const ${name} = [`));
  if (start < 0) throw new Error(`${name}: not found`);
  if (lines[start].trimEnd().endsWith('[];')) return [start, start];
  let end = start + 1;
  while (end < lines.length && lines[end].trimEnd() !== '];') end++;
  if (end >= lines.length) throw new Error(`${name}: no closing "];"`);
  return [start, end];
}

/* The array's value. The literals hold only data, so evaluating them in an
   empty sandbox is safe; a wrong range fails loudly as a syntax error. */
export function arrayValue(lines, name){
  const [start, end] = arrayRange(lines, name);
  const literal = lines.slice(start, end + 1).join('\n').replace(/^const \w+ = /, '').replace(/;\s*$/, '');
  const value = vm.runInNewContext('(' + literal + ')');
  if (!Array.isArray(value)) throw new Error(`${name}: not an array`);
  return value;
}

/* File names (without .json) from the pieces' English titles. The spec's rule:
   1. drop the leading "N ·", anything after an em dash, anything in parentheses;
   2. fold diacritics (ā → a, Turkish ı → i), drop ʿ ʾ and apostrophes;
   3. lowercase, runs of other characters → "-", at most 60 characters, cut at a word;
   4. names that would collide in a folder use the full title instead.
   normalize() here only builds names; it never touches the content itself. */
export function fileNames(pieces){
  const slugify = text => {
    let s = String(text)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/ı/g, 'i')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[ʿʾ'’‘`]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (s.length > 60) s = s.slice(0, 60).replace(/-[^-]*$/, '');
    return s || 'untitled';
  };
  const bare = t => String(t).replace(/^\d+b?\s*·\s*/, '');
  const short = pieces.map(p => slugify(bare(p.titleEnglish).split('—')[0]));
  const count = {};
  short.forEach(s => { count[s] = (count[s] || 0) + 1; });
  const names = pieces.map((p, i) => count[short[i]] > 1 ? slugify(bare(p.titleEnglish)) : short[i]);
  const seen = {};
  return names.map(n => { seen[n] = (seen[n] || 0) + 1; return seen[n] > 1 ? `${n}-${seen[n]}` : n; });
}
```

- [ ] **Step 4: Write the content check (this is the failing test)**

Create `.work/check-content.mjs`:

```js
// .work/check-content.mjs: run from the repo root with: node .work/check-content.mjs
// Passes when content/ holds exactly the texts of BASE_COMMIT's index.html, byte
// for byte, under the reviewed file names, and index.html declares the sections.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { BASE_COMMIT, SECTIONS, baseHtml, arrayValue } from './content-lib.mjs';

const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function readJSON(path){
  if (!existsSync(path)) { problems.push(`${path}: missing`); return undefined; }
  const bytes = readFileSync(path);
  check(!(bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF), `${path}: starts with a byte-order mark`);
  try { return JSON.parse(bytes.toString('utf8')); }
  catch (e) { problems.push(`${path}: ${e.message}`); return undefined; }
}

const baseLines = baseHtml().split(/\r?\n/);
const folders = SECTIONS.map(s => s.folder);
check(same(readJSON('content/index.json'), folders), `content/index.json must list, in order: ${folders.join(', ')}`);

const html = readFileSync('index.html', 'utf8');
const declared = [...html.matchAll(/contentSection\('([^']+)'\)/g)].map(m => m[1]);
check(same(declared, folders), `index.html must declare contentSection() for ${folders.join(', ')}; found: ${declared.join(', ') || 'none'}`);

/* The reviewed names: the spec's appendix. */
const reviewed = {};
let current = null;
for (const line of readFileSync('docs/superpowers/specs/2026-10-03-content-files-design.md', 'utf8').split(/\r?\n/)) {
  const head = line.match(/^\*\*`([a-z]+)\/`\*\*/);
  if (head) { current = reviewed[head[1]] = []; continue; }
  const item = line.match(/^\d+\. `([a-z0-9-]+)` — /);
  if (item && current) current.push(item[1]);
}

for (const { folder, array } of SECTIONS) {
  const dir = `content/${folder}/`;
  check(!html.includes(`const ${array} = [`), `index.html still holds the ${array} literal`);
  const names = readJSON(dir + 'index.json');
  if (!Array.isArray(names)) { problems.push(`${dir}index.json: not a list`); continue; }
  check(same(names, reviewed[folder] || []), `${dir}index.json differs from the names in the spec's appendix`);
  for (const f of existsSync(dir) ? readdirSync(dir) : [])
    if (f !== 'index.json') check(f.endsWith('.json') && names.includes(f.slice(0, -5)), `${dir}${f} is not listed in ${dir}index.json`);
  const pieces = names.map(n => readJSON(`${dir}${n}.json`));
  check(same(pieces, arrayValue(baseLines, array)), `${dir}: the pieces differ from ${array} at ${BASE_COMMIT}`);
}

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`content/ matches ${BASE_COMMIT}: ${SECTIONS.length} sections, every piece identical, names as reviewed.`);
```

- [ ] **Step 5: Run the check and confirm it fails**

Run: `node .work/check-content.mjs`

Expected: exit code 1. The output starts with `content/index.json: missing` and includes `index.html must declare contentSection() for …; found: none`.

- [ ] **Step 6: Write the migration script**

Create `.work/migrate-content.mjs`:

```js
// .work/migrate-content.mjs: run once from the repo root with: node .work/migrate-content.mjs
// 1. Writes content/ from the arrays in index.html.
// 2. Cuts those arrays, and the comments that only described them, out of
//    index.html, and puts the CONTENT block at the top of the script.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BASE_COMMIT, SECTIONS, arrayValue, fileNames } from './content-lib.mjs';

const changed = execFileSync('git', ['diff', '--name-only', BASE_COMMIT, '--', 'index.html'], { encoding: 'utf8' }).trim();
if (changed) throw new Error(`index.html differs from ${BASE_COMMIT}; the line numbers below are that commit's`);
if (existsSync('content')) throw new Error('content/ already exists; delete it to run again');

const html = readFileSync('index.html', 'utf8');
const EOL = html.includes('\r\n') ? '\r\n' : '\n';
const lines = html.split(/\r?\n/);
const json = value => JSON.stringify(value, null, 2) + '\n';

// ---- 1. content/ --------------------------------------------------------
for (const { folder, array } of SECTIONS) {
  const pieces = arrayValue(lines, array);
  const names = fileNames(pieces);
  mkdirSync(`content/${folder}`, { recursive: true });
  pieces.forEach((piece, i) => writeFileSync(`content/${folder}/${names[i]}.json`, json(piece)));
  writeFileSync(`content/${folder}/index.json`, json(names));
  console.log(`content/${folder}/  ${pieces.length} pieces`);
}
writeFileSync('content/index.json', json(SECTIONS.map(s => s.folder)));

// ---- 2. index.html ------------------------------------------------------
const CONTENT_BLOCK = `/* ================================================================
   CONTENT
   ----------------------------------------------------------------
   Every text lives in content/<section>/: one JSON file per piece,
   and an index.json listing the pieces in reading order. These
   arrays start empty; loadContent() fills them before the first
   render, so the rest of the script can treat them as ordinary
   arrays. How to write and add pieces: content/README.md.
   ================================================================ */
const CONTENT_ROOT = 'content/';
const CONTENT_SECTIONS = [];   // { folder, pieces }, in the order declared below

/* An empty array that loadContent() fills from content/<folder>/. */
function contentSection(folder){
  const pieces = [];
  CONTENT_SECTIONS.push({ folder, pieces });
  return pieces;
}

const QASIDAS            = contentSection('qasidas');
const SIRAH_CHAPTERS     = contentSection('sirah');
const BARZANJI_CHAPTERS  = contentSection('barzanji');
const DIYA_CHAPTERS      = contentSection('diya');
const BURDAH_CHAPTERS    = contentSection('burdah');
const DALAIL_CHAPTERS    = contentSection('dalail');
const LITANY_CHAPTERS    = contentSection('litanies');
const SILSILA_CHAPTERS   = contentSection('silsila');
const TURUQ_CHAPTERS     = contentSection('turuqs');
const SOHBET_CHAPTERS    = contentSection('sohbets');
const ILAHI_CHAPTERS     = contentSection('ilahis');
const NASHEED_CHAPTERS   = contentSection('nasheeds');
const BIOGRAPHY_CHAPTERS = contentSection('biographies');
const OTTOMAN_CHAPTERS   = contentSection('ottoman');

/* One JSON file. Every error names the file, so it's clear what to fix.
   'no-cache' always asks the server whether the file changed, so an edit
   shows on the next reload even before the service worker is running. */
async function fetchJSON(path){
  let resp;
  try { resp = await fetch(path, { cache: 'no-cache' }); }
  catch(e){ throw new Error(path + ': could not be fetched'); }
  if(!resp.ok) throw new Error(path + ': HTTP ' + resp.status);
  const text = await resp.text();
  try { return JSON.parse(text); }
  catch(e){ throw new Error(path + ': ' + e.message); }
}

/* One section, all or nothing: its pieces go in only once every file has
   arrived, so a failure can leave a section empty but never shift the
   positions the code relies on (the Dalāʾil days, the Aʿẓam and Istighfār
   days). Resolves with the section's error messages; none when it loaded. */
async function loadSection({ folder, pieces }){
  const dir = CONTENT_ROOT + folder + '/';
  let names;
  try { names = await fetchJSON(dir + 'index.json'); }
  catch(e){ return [e.message]; }
  if(!Array.isArray(names)) return [dir + 'index.json: should be a list of file names'];
  const results = await Promise.allSettled(names.map(name => fetchJSON(dir + name + '.json')));
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
  if(!errors.length) pieces.push(...results.map(r => r.value));
  return errors;
}

/* Every section, in parallel. nothingLoaded: not one section arrived. */
async function loadContent(){
  const perSection = await Promise.all(CONTENT_SECTIONS.map(loadSection));
  return {
    errors: perSection.flat(),
    nothingLoaded: perSection.every(errors => errors.length > 0),
  };
}`.split(/\r?\n/);

/* Each edit replaces the 1-based lines [from, to] as they are at BASE_COMMIT.
   All checks run before any change, so a shifted file stops the script
   instead of cutting the wrong code. The edits are listed bottom-up, so
   applying them in order keeps every line number valid. */
const line = n => lines[n - 1].trimEnd();
function expect(n, start){
  const ok = start === '' ? line(n) === '' : line(n).startsWith(start);
  if (!ok) throw new Error(`line ${n}: expected ${JSON.stringify(start)}, found ${JSON.stringify(line(n).slice(0, 70))}`);
}
const keep = (from, to) => lines.slice(from - 1, to);

const edits = [
  { // The Burdah, Sirah and Ilahi arrays, each with its comment.
    from: 11395, to: 12612, with: [],
    check(){ expect(11394, ''); expect(11395, '/* The 10 chapters of Imam al-B'); expect(11397, 'const BURDAH_CHAPTERS = [');
             expect(11921, 'const SIRAH_CHAPTERS = ['); expect(12369, 'const ILAHI_CHAPTERS = [');
             expect(12611, '];'); expect(12612, ''); expect(12613, 'function navBar(){'); } },
  { // The Silsila, Turuqs, Sohbets, Biographies and Ottoman arrays with their banners.
    // SOHBET_SHAYKHS stays: it's the Sohbets menu. The home-page menu comment,
    // stranded above the Silsila banner, goes back above TABS.
    from: 11102, to: 11351, with: [...keep(11251, 11260), '', ...keep(11102, 11106)],
    check(){ expect(11101, ''); expect(11102, '/* The home-page menu.'); expect(11106, '   render a placeholder() until content is added');
             expect(11107, '/* '); expect(11147, 'const SILSILA_CHAPTERS = ['); expect(11217, 'const TURUQ_CHAPTERS = [];');
             expect(11251, '/* Sohbets are grouped by who gave them'); expect(11255, 'const SOHBET_SHAYKHS = ['); expect(11260, '];');
             expect(11262, '/* Every sohbet carries `shaykh`'); expect(11265, 'const SOHBET_CHAPTERS = [');
             expect(11316, 'const BIOGRAPHY_CHAPTERS = [];'); expect(11350, 'const OTTOMAN_CHAPTERS = [];');
             expect(11351, ''); expect(11352, 'const TABS = ['); } },
  { // The Mawlid hub's comment, stranded above NASHEED_CHAPTERS, goes back above MAWLID_COLLECTIONS.
    from: 11077, to: 11077, with: keep(8015, 8016),
    check(){ expect(11076, ''); expect(11077, ''); expect(11078, 'const MAWLID_COLLECTIONS = [');
             expect(8015, '/* The mawlid texts, gathered under one hub tab'); expect(8016, '   without crowding the tab bar. */'); } },
  { // The Dalail, Diya, Barzanji, Nasheed and Litany arrays with their comments, and a
    // stale "nav bar" comment that described none of them.
    from: 2943, to: 11068, with: [],
    check(){ expect(2942, ''); expect(2943, '/* ---- Top-level sections shown as a left-to-right nav bar');
             expect(2946, 'const DALAIL_CHAPTERS = ['); expect(7318, 'const DIYA_CHAPTERS = ['); expect(7980, 'const BARZANJI_CHAPTERS = [');
             expect(8018, 'const NASHEED_CHAPTERS = [];'); expect(8022, 'const LITANY_CHAPTERS = [');
             expect(11067, '];'); expect(11068, ''); expect(11069, '/* Everything under Additional Praises. */'); } },
  { // QASIDAS and its banner become the CONTENT block.
    from: 1294, to: 2386, with: CONTENT_BLOCK,
    check(){ expect(1293, '<script>'); expect(1294, '/* ======'); expect(1310, 'const QASIDAS = [');
             expect(2386, '];'); expect(2387, ''); expect(2388, '/* ---------------- app logic'); } },
];
for (const e of edits) e.check();
for (const e of edits) lines.splice(e.from - 1, e.to - e.from + 1, ...e.with);
writeFileSync('index.html', lines.join(EOL));
console.log(`index.html: ${lines.length} lines, the arrays replaced by the CONTENT block`);
```

- [ ] **Step 7: Run the migration**

Run: `node .work/migrate-content.mjs`

Expected: 14 `content/<folder>/  N pieces` lines with these counts: qasidas 25, sirah 7, barzanji 17, diya 8, burdah 10, dalail 15, litanies 18, silsila 40, turuqs 0, sohbets 1, ilahis 11, nasheeds 0, biographies 0, ottoman 0. Then the `index.html: … lines` summary. If it throws `line N: expected …`, stop: `index.html` isn't the `38d413f` version.

- [ ] **Step 8: Start the app only after the texts arrive**

In `index.html`, use the Edit tool for two edits. The working copy has CRLF line endings, and the Edit tool handles them.

Replace this:

```js
renderIndex();

/* Opened from a shared session link
```

with this:

```js
/* Startup: the texts first, then everything that shows them. */
loadContent().then(({ errors }) => {
  errors.forEach(e => console.error('Content: ' + e));
  start();
});

function start(){
  renderIndex();
  joinFromLink();
}

/* Opened from a shared session link
```

Then replace this:

```js
(function joinFromLink(){
  const code = pendingSessionCode();
  if(!code) return;
  state.tab = 'session';
  renderIndex();
  connectSession(code, 'follower');
})();
```

with this:

```js
function joinFromLink(){
  const code = pendingSessionCode();
  if(!code) return;
  state.tab = 'session';
  renderIndex();
  connectSession(code, 'follower');
}
```

- [ ] **Step 9: Show a loading line until the first render**

In `index.html`, replace `<div id="app"></div>` with:

```html
<div id="app"><div class="placeholder"><div class="ph-star">۞</div><p>Loading the texts…</p></div></div>
```

- [ ] **Step 10: Check that the script still parses, and that the content check passes**

Create `.work/parse-check.mjs`:

```js
// .work/parse-check.mjs: run from the repo root with: node .work/parse-check.mjs
// Compiles the one inline <script> of index.html, to catch syntax errors before the browser.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync('index.html', 'utf8');
const start = html.indexOf('<script>') + '<script>'.length;
new vm.Script(html.slice(start, html.indexOf('</script>', start)), { filename: 'index.html' });
console.log('the script in index.html parses');
```

Run: `node .work/parse-check.mjs && node .work/check-content.mjs`

Expected:

```
the script in index.html parses
content/ matches 38d413f: 14 sections, every piece identical, names as reviewed.
```

- [ ] **Step 11: (browser) Load the new app and confirm the texts and the bookmarks**

In the `localhost:8000` tab, `navigate` to `http://localhost:8000/`, then run with `javascript_tool`:

```js
await (async () => {
  await new Promise(r => setTimeout(r, 1500));
  return {
    counts: CONTENT_SECTIONS.map(s => s.folder + ':' + s.pieces.length).join(' '),
    favs: favItems().map(f => f.kind + ' ' + f.piece.titleEnglish),
    place: placeChapter() && placeChapter().c.titleEnglish,
  };
})()
```

Expected:
- `counts`: `qasidas:25 sirah:7 barzanji:17 diya:8 burdah:10 dalail:15 litanies:18 silsila:40 turuqs:0 sohbets:1 ilahis:11 nasheeds:0 biographies:0 ottoman:0`
- `favs`: `["b 5 · On His Miracles", "d Tuesday", "i Gelin Ey Aşıklar — Come, O Lovers"]`
- `place`: `"Tuesday"`

Then run `read_console_messages` with `onlyErrors: true`: expect no errors. Take a screenshot (`computer`, `screenshot`): the home page shows its tiles with their counts.

- [ ] **Step 12: Write the rendering snapshot**

Create `.work/snapshot.js`:

```js
// .work/snapshot.js: evaluate in the app page (old or new) with javascript_tool.
// window.__snapshot() renders every tab, opens every piece and runs a few
// searches, returning a hash of #app's HTML for each. To compare like with like
// it renders in light mode with no favourites or saved place, then restores
// them. Image URLs and the version tag are blanked: the old app inlines images
// as base64 while the new one links files, and Task 6 bumps the version.
window.__snapshot = async () => {
  for (let i = 0; i < 100 && !(DALAIL_CHAPTERS.length && QASIDAS.length); i++)
    await new Promise(r => setTimeout(r, 100));
  await document.fonts.ready;
  const saved = { favs: state.favs, place: localStorage.getItem('mawlid-dalail-place'),
                  dark: document.documentElement.classList.contains('dark') };
  state.favs = [];
  localStorage.removeItem('mawlid-dalail-place');
  document.documentElement.classList.remove('dark');

  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16) + '/' + s.length; };
  const app = document.getElementById('app');
  const html = () => app.innerHTML
    .replace(/src="(data:image\/png;base64,[^"]*|img\/[^"]*)"/g, 'src="IMG"')
    .replace(/<div class="build-tag">[^<]*<\/div>/g, '<div class="build-tag"></div>');
  const views = {};
  const tabs = [...new Set(['home', 'favs', ...TABS.map(t => t.id), ...Object.keys(TAB_CHILDREN), ...Object.values(TAB_CHILDREN).flat()])];
  for (const id of tabs) { selectTab(id); views['tab ' + id] = hash(html()); }
  for (const kind of Object.keys(OPENERS))
    arrayOf(kind).forEach((_, i) => { goHome(); window[OPENERS[kind]](i); views[`open ${kind} ${i}`] = hash(html()); });
  for (const q of ['muhammad', 'ya nabi', 'salam', 'مُحَمَّد', 'محمد', 'burdah', 'hizb', 'monday', 'ilim', 'nazim']) {
    goHome(); updateSearch(q); views['search ' + q] = hash(html());
  }

  state.favs = saved.favs;
  if (saved.place) localStorage.setItem('mawlid-dalail-place', saved.place);
  if (saved.dark) document.documentElement.classList.add('dark');
  goHome();
  return { count: Object.keys(views).length, views };
};
/* The names of the views that differ from another version's snapshot. */
window.__compare = (other, mine) =>
  [...new Set([...Object.keys(other), ...Object.keys(mine)])].filter(k => other[k] !== mine[k]);
'snapshot helpers ready';
```

- [ ] **Step 13: (browser) Compare the old and new app, view by view**

1. In the old tab (`127.0.0.1:8000/.work/base/index.html`), run the full text of `.work/snapshot.js` with `javascript_tool`. Then run `(await window.__snapshot()).views` and keep the returned object.
2. In the new tab (`localhost:8000`), run `.work/snapshot.js` too. Then run the following, pasting the old object in place of `OLD_VIEWS`. JSON is valid JavaScript, so it pastes as it is.

```js
await (async () => {
  const mine = (await window.__snapshot()).views;
  const other = OLD_VIEWS;
  return { count: Object.keys(mine).length, differ: window.__compare(other, mine) };
})()
```

Expected: `count` about 190 (27 tabs, 152 pieces and 10 searches), and `differ: []`.

If a view differs, render it in both tabs and compare `document.getElementById('app').innerHTML` to find the cause. Fix it before committing.

- [ ] **Step 14: Confirm the JSON files will be stored with LF, then commit**

```bash
git add index.html content .claude/launch.json
git ls-files --eol content | grep -v "i/lf" ; echo "non-LF files above (expect none)"
git commit -m "Move every text into content/, one JSON file per piece, loaded at startup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 3: When texts fail to load

**Files:**
- Modify: `index.html`: the CSS after `.placeholder p{…}`, `loadSection()` plus a new `isPiece()`, the startup block, two new UI functions, and two Dalāʾil screens in `renderResults()`
- Test: `.work/visit-all.js` (never committed), plus browser checks

**Interfaces:**
- Consumes: `loadSection`, `loadContent` (`{ errors, nothingLoaded }`), `start()` and `CONTENT_SECTIONS` from Task 2, and the app's own `escHTML(s)`, `placeholder(title)` and the `app` element.
- Produces:
  - `isPiece(p): boolean`
  - `showLoadNotice(errors: string[])` and `showLoadFailure(errors: string[])`
  - the CSS classes `.load-notice`, `.load-notice-x` and `.load-failed`

- [ ] **Step 1: (browser) Reproduce the gap**

```bash
mv content/dalail/monday-part-2.json .work/
```

Reload `http://localhost:8000/`. Then run `selectTab('dalail')` with `javascript_tool`, and run `read_console_messages` with `onlyErrors: true`.

Expected today:
- The console shows `Content: content/dalail/monday-part-2.json: HTTP 404`.
- Nothing on screen says so.
- `selectTab('dalail')` throws a `TypeError` (`Cannot read properties of undefined (reading 'titleArabic')`).

Leave the file moved for Step 5.

- [ ] **Step 2: Style the notice and the failure screen**

In `index.html`, replace the line `  .placeholder p{margin:.5rem 0}` with:

```css
  .placeholder p{margin:.5rem 0}
  /* Texts that couldn't be loaded: a notice pinned to the foot of the screen,
     outside #app so re-renders leave it alone, naming each failed file. */
  .load-notice{
    position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:1000;
    width:min(34rem,calc(100% - 2rem));max-height:40vh;overflow:auto;
    background:var(--card);color:var(--ink);border:1px solid var(--gold);border-radius:12px;
    box-shadow:0 6px 24px rgba(0,0,0,.2);padding:.8rem 2.6rem .8rem 1rem;font-size:.85rem;line-height:1.45;
  }
  .load-notice ul{margin:.4rem 0 0;padding-left:1.1rem}
  .load-notice li{overflow-wrap:anywhere}
  .load-notice-x{position:absolute;top:.35rem;right:.45rem;border:0;background:none;color:var(--ink-soft);font-size:1.1rem;padding:.3rem;cursor:pointer}
  .load-failed .retry{padding:.55rem 1.3rem;border:0;border-radius:9px;background:var(--theme);color:#fff;font:inherit;font-weight:700;cursor:pointer}
  .load-failed .load-detail{font-size:.8rem;overflow-wrap:anywhere}
```

- [ ] **Step 3: Reject pieces the app can't show**

In `index.html`, inside `loadSection`, replace:

```js
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
```

with:

```js
  const errors = [];
  results.forEach((r, i) => {
    if(r.status === 'rejected') errors.push(r.reason.message);
    else if(!isPiece(r.value)) errors.push(dir + names[i] + '.json: needs "titleEnglish" (text) and "verses" (a list)');
  });
```

and replace:

```js
/* Every section, in parallel. nothingLoaded: not one section arrived. */
```

with:

```js
/* The least a piece needs: search and the readers rely on both. */
function isPiece(p){
  return !!p && typeof p === 'object' && typeof p.titleEnglish === 'string' && Array.isArray(p.verses);
}

/* Every section, in parallel. nothingLoaded: not one section arrived. */
```

- [ ] **Step 4: Say what failed, and keep Dalāʾil from crashing when empty**

In `index.html`, replace the startup block:

```js
loadContent().then(({ errors }) => {
  errors.forEach(e => console.error('Content: ' + e));
  start();
});

function start(){
  renderIndex();
  joinFromLink();
}
```

with:

```js
loadContent().then(({ errors, nothingLoaded }) => {
  errors.forEach(e => console.error('Content: ' + e));
  if(nothingLoaded){ showLoadFailure(errors); return; }
  if(errors.length) showLoadNotice(errors);
  start();
});

function start(){
  renderIndex();
  joinFromLink();
}

/* Some texts couldn't be loaded: say which, at the foot of the screen. It
   lives outside #app, so re-renders leave it alone until it's dismissed. */
function showLoadNotice(errors){
  const notice = document.createElement('div');
  notice.className = 'load-notice';
  notice.setAttribute('role', 'alert');
  notice.innerHTML = `<button class="load-notice-x" onclick="this.parentNode.remove()" aria-label="Dismiss">✕</button>
    <strong>Some texts couldn't be loaded</strong>
    <ul>${errors.map(e => `<li>${escHTML(e)}</li>`).join('')}</ul>`;
  document.body.appendChild(notice);
}

/* Not one section arrived, typically on a first visit with no connection. */
function showLoadFailure(errors){
  app.innerHTML = `<div class="placeholder load-failed">
      <div class="ph-star">۞</div>
      <p><strong>The texts couldn't be loaded</strong></p>
      <p>Check your connection, then try again.</p>
      <p><button class="retry" onclick="location.reload()">Try again</button></p>
      <p class="load-detail">${escHTML(errors[0] || '')}</p>
    </div>`;
}
```

Then, in `renderResults()`, replace `+ dalailBeforeCards();` with:

```js
+ (DALAIL_CHAPTERS.length ? dalailBeforeCards() : placeholder('Before the reading'));
```

and replace the line `    return dalailIndex();` with:

```js
    /* Empty only when its files failed to load; the index assumes its portions. */
    return DALAIL_CHAPTERS.length ? dalailIndex() : placeholder('Dalāʾil al-Khayrāt');
```

Run: `node .work/parse-check.mjs`. Expected: `the script in index.html parses`.

- [ ] **Step 5: (browser) A missing file: the notice names it and Dalāʾil stays usable**

The file from Step 1 is still moved away. Reload `http://localhost:8000/`, then run:

```js
await (async () => {
  await new Promise(r => setTimeout(r, 1500));
  const notice = document.querySelector('.load-notice');
  selectTab('dalail'); const dalail = app.innerText.includes('No entries here yet');
  selectTab('before'); const before = app.innerText.includes('No entries here yet');
  goHome();
  return { notice: notice && notice.innerText, dalail, before, dalailCount: DALAIL_CHAPTERS.length,
           favsKept: JSON.parse(localStorage.getItem('mawlid-favs')).length };
})()
```

Expected:
- `notice` contains `content/dalail/monday-part-2.json: HTTP 404`.
- `dalail` and `before` are both `true`: both screens show the placeholder.
- `dalailCount` is 0.
- `favsKept` is 3: the Dalāʾil favourite from Task 2 survives its section failing.
- `read_console_messages` with `onlyErrors: true` shows only the `Content: …` line.

Click the notice's ✕ (`find` "Dismiss", then `computer` `left_click` on its ref) and check that `document.querySelector('.load-notice')` is now `null`.

```bash
mv .work/monday-part-2.json content/dalail/
```

- [ ] **Step 6: (browser) Invalid JSON: the notice quotes the parser**

```bash
printf '{"titleEnglish": "Broken",}\n' > content/burdah/on-his-miracles.json
```

Reload, wait 1.5 s, and read `document.querySelector('.load-notice').innerText`. Expected: it contains `content/burdah/on-his-miracles.json:` followed by the browser's JSON error (for example `Expected double-quoted property name in JSON at position 25`). `BURDAH_CHAPTERS.length` is 0, and the other sections are loaded.

```bash
git checkout -- content/burdah/on-his-miracles.json
```

- [ ] **Step 7: (browser) Valid JSON but the wrong shape: the section is held back, nothing crashes**

```bash
printf '{"titleEnglish": "Broken"}\n' > content/burdah/on-his-miracles.json
```

Reload, then run:

```js
await (async () => {
  await new Promise(r => setTimeout(r, 1500));
  const notice = document.querySelector('.load-notice').innerText;
  goHome(); updateSearch('miracles'); const searched = !!app.innerHTML;
  goHome();
  return { notice, burdah: BURDAH_CHAPTERS.length, searched };
})()
```

Expected: `notice` contains `content/burdah/on-his-miracles.json: needs "titleEnglish" (text) and "verses" (a list)`, `burdah` is 0, and `searched` is `true`, with no `TypeError` in `read_console_messages`.

```bash
git checkout -- content/burdah/on-his-miracles.json
```

- [ ] **Step 8: (browser) A byte-order mark from a Windows editor still loads**

```bash
{ printf '\xEF\xBB\xBF'; cat content/burdah/on-his-miracles.json; } > .work/bom.json && mv .work/bom.json content/burdah/on-his-miracles.json
head -c 3 content/burdah/on-his-miracles.json | od -An -tx1
```

Expected from `od`: ` ef bb bf`. Reload, wait 1.5 s, then run:

```js
({ notice: !!document.querySelector('.load-notice'), title: BURDAH_CHAPTERS[4] && BURDAH_CHAPTERS[4].titleEnglish })
```

Expected: `{ notice: false, title: "5 · On His Miracles" }`.

```bash
git checkout -- content/burdah/on-his-miracles.json
```

- [ ] **Step 9: (browser) Every section empty at once: no screen crashes**

Create `.work/visit-all.js`:

```js
// .work/visit-all.js: evaluate in the app page. Visits every tab and runs two
// searches, collecting any exception or blank screen. Expected: errors is [].
(() => {
  const ids = [...new Set(['home', 'favs', ...TABS.map(t => t.id), ...Object.keys(TAB_CHILDREN), ...Object.values(TAB_CHILDREN).flat()])];
  const errors = [];
  for (const id of ids) {
    try { selectTab(id); if (!app.innerHTML.trim()) errors.push(id + ': blank'); }
    catch (e) { errors.push(id + ': ' + e.message); }
  }
  for (const q of ['a', 'محمد']) {
    try { goHome(); updateSearch(q); } catch (e) { errors.push('search ' + q + ': ' + e.message); }
  }
  goHome();
  return { visited: ids.length, errors };
})()
```

Break every section except `turuqs` (empty, and it still loads, so the app renders):

```bash
for d in qasidas sirah barzanji diya burdah dalail litanies silsila sohbets ilahis nasheeds biographies ottoman; do mv content/$d/index.json content/$d/index.json.off; done
```

Reload, wait 1.5 s, and run the full text of `.work/visit-all.js`. Expected: `{ visited: 27, errors: [] }` (give or take the tab count), and the notice lists 13 `…/index.json: HTTP 404` lines.

```bash
for d in qasidas sirah barzanji diya burdah dalail litanies silsila sohbets ilahis nasheeds biographies ottoman; do mv content/$d/index.json.off content/$d/index.json; done
```

- [ ] **Step 10: (browser) Nothing loads: the error screen, and "Try again" recovers**

```bash
mv content .work/content-aside
```

Reload, wait 1.5 s. Expected: `app.innerText` contains `The texts couldn't be loaded` and `Try again`. Take a screenshot in light mode. Then run `toggleTheme()` and take another in dark mode; both must be readable.

```bash
mv .work/content-aside content
```

Click "Try again" (`find` "Try again", then `left_click`). Expected: the home page with its tiles, and `DALAIL_CHAPTERS.length === 15`. If the theme is now dark, switch it back with `toggleTheme()`.

- [ ] **Step 11: Confirm everything is restored, then commit**

```bash
node .work/check-content.mjs && node .work/parse-check.mjs && git status --short
```

Expected: both checks pass, and `git status` lists only `M index.html`.

```bash
git add index.html
git commit -m "Name any text that fails to load, and keep empty sections from crashing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 4: Fonts and images as files

**Files:**
- Create: `fonts/UthmanicHafs.otf`, `fonts/Amiri-Regular.woff`, `fonts/Amiri-Bold.woff`, `img/medallion.png`, `img/header-bismillah.png`
- Modify: `index.html`, through the extraction script: three `@font-face` `src`, two image constants, two deleted constants, two comments, and preloads in `<head>`
- Modify: `sw.js`, the `CORE` list
- Test: `.work/check-assets.mjs`, `.work/extract-assets.mjs` (never committed); `.work/sw.test.mjs` re-run

**Interfaces:**
- Consumes: `baseHtml()` from `.work/content-lib.mjs` (Task 2), and `CORE` plus the harness from Task 1.
- Produces: the five files above, referenced by `index.html` and precached through `CORE`.

- [ ] **Step 1: Write the asset check (the failing test)**

Create `.work/check-assets.mjs`:

```js
// .work/check-assets.mjs: run from the repo root with: node .work/check-assets.mjs
// Passes when the fonts and images are files identical to the base64 they
// replaced, index.html links them, and sw.js precaches them.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { baseHtml } from './content-lib.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = baseHtml();
const decoded = re => { const m = base.match(re); if (!m) throw new Error(`not in 38d413f: ${re}`); return Buffer.from(m[1], 'base64'); };
const EXPECTED = {
  'fonts/UthmanicHafs.otf':   decoded(/font-family:'UthmanicHafs';[^]*?base64,([A-Za-z0-9+/=]+)\)/),
  'fonts/Amiri-Regular.woff': decoded(/font-family:'Amiri';\s*font-style:normal; font-weight:400;[^]*?base64,([A-Za-z0-9+/=]+)\)/),
  'fonts/Amiri-Bold.woff':    decoded(/font-family:'Amiri';\s*font-style:normal; font-weight:700;[^]*?base64,([A-Za-z0-9+/=]+)\)/),
  'img/medallion.png':        decoded(/const MEDALLION_ICON = 'data:image\/png;base64,([A-Za-z0-9+/=]+)'/),
  'img/header-bismillah.png': decoded(/const HEADER_BISMILLAH = 'data:image\/png;base64,([A-Za-z0-9+/=]+)'/),
};

const problems = [];
const html = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');
for (const [file, bytes] of Object.entries(EXPECTED)) {
  if (!existsSync(file)) problems.push(`${file}: missing`);
  else if (sha(readFileSync(file)) !== sha(bytes)) problems.push(`${file}: differs from the base64 in 38d413f`);
  if (!html.includes(file)) problems.push(`index.html never references ${file}`);
  if (!sw.includes(`'./${file}'`)) problems.push(`sw.js CORE is missing './${file}'`);
}
const blobs = (html.match(/;base64,/g) || []).length;
if (blobs !== 2) problems.push(`index.html still has ${blobs} base64 blobs; only the two favicons should remain`);
for (const name of ['BISMILLAH_MARK', 'LOGO_INNER']) if (html.includes(name)) problems.push(`index.html still mentions ${name}`);

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('fonts/ and img/ match 38d413f byte for byte; index.html links them and sw.js precaches them.');
```

Run: `node .work/check-assets.mjs`. Expected: exit code 1, starting with `fonts/UthmanicHafs.otf: missing`.

- [ ] **Step 2: Write the extraction script**

Create `.work/extract-assets.mjs`:

```js
// .work/extract-assets.mjs: run once from the repo root with: node .work/extract-assets.mjs
// Writes the base64 fonts and images in index.html out as files, byte for byte,
// points index.html at them, preloads them, and drops the two unused images.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

let html = readFileSync('index.html', 'utf8');
const EOL = html.includes('\r\n') ? '\r\n' : '\n';
mkdirSync('fonts', { recursive: true });
mkdirSync('img', { recursive: true });

const FONTS = [
  { family: 'UthmanicHafs', weight: 400, type: 'otf',  format: 'opentype', file: 'fonts/UthmanicHafs.otf' },
  { family: 'Amiri',        weight: 400, type: 'woff', format: 'woff',     file: 'fonts/Amiri-Regular.woff' },
  { family: 'Amiri',        weight: 700, type: 'woff', format: 'woff',     file: 'fonts/Amiri-Bold.woff' },
];
for (const f of FONTS) {
  const re = new RegExp(`(font-family:'${f.family}';\\s*font-style:normal; font-weight:${f.weight}; font-display:swap;\\s*)src:url\\(data:font/${f.type};base64,([A-Za-z0-9+/=]+)\\) format\\('${f.format}'\\);`);
  const m = html.match(re);
  if (!m) throw new Error(`@font-face ${f.family} ${f.weight}: not found`);
  writeFileSync(f.file, Buffer.from(m[2], 'base64'));
  html = html.replace(re, `$1src:url(${f.file}) format('${f.format}');`);
  console.log(f.file);
}

for (const { name, file } of [
  { name: 'MEDALLION_ICON',   file: 'img/medallion.png' },
  { name: 'HEADER_BISMILLAH', file: 'img/header-bismillah.png' },
]) {
  const re = new RegExp(`const ${name} = 'data:image/png;base64,([A-Za-z0-9+/=]+)';`);
  const m = html.match(re);
  if (!m) throw new Error(`${name}: not found`);
  writeFileSync(file, Buffer.from(m[1], 'base64'));
  html = html.replace(re, `const ${name} = '${file}';`);
  console.log(file);
}

/* Declared but never used anywhere. */
for (const name of ['BISMILLAH_MARK', 'LOGO_INNER']) {
  const re = new RegExp(`const ${name} = 'data:image/png;base64,[A-Za-z0-9+/=]+';\\r?\\n`);
  if (!re.test(html)) throw new Error(`${name}: not found`);
  html = html.replace(re, '');
}

/* The comments above the header artwork described the inlining and a frieze
   that no longer exists. */
const artwork = /\/\* Header artwork, embedded so it needs no network and can't go missing\.\r?\n[^\n]*\r?\n\/\* Zellige frieze[^\n]*\r?\n[^\n]*\*\/\r?\n/;
if (!artwork.test(html)) throw new Error('header artwork comment: not found');
html = html.replace(artwork, [
  '/* Header artwork, served from img/ and cached by sw.js for offline use.',
  '   HOME shows the medallion; inner pages and the reader show the bismillah. */',
].join(EOL) + EOL);

const licence = /comma still looks like a comma\. Embedded byte-for-byte: the licence\r?\n {7}forbids modifying the font, so it cannot be subset\. \*\//;
if (!licence.test(html)) throw new Error('Uthmani licence comment: not found');
html = html.replace(licence, [
  'comma still looks like a comma. fonts/UthmanicHafs.otf is the original',
  "       file byte for byte: the licence forbids modifying the font, so it can't",
  '       be subset or converted. */',
].join(EOL));

const anchor = '<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro';
const at = html.indexOf(anchor);
if (at < 0) throw new Error('Google Fonts link: not found');
const after = html.indexOf('\n', at) + 1;
html = html.slice(0, after) + [
  '<!-- The bundled Arabic faces and the home masthead, fetched while the texts',
  "     load rather than after the first render, so the Arabic doesn't visibly",
  "     swap font. Font preloads need crossorigin even from this site, or they're",
  '     fetched twice. -->',
  '<link rel="preload" href="fonts/UthmanicHafs.otf" as="font" type="font/otf" crossorigin>',
  '<link rel="preload" href="fonts/Amiri-Regular.woff" as="font" type="font/woff" crossorigin>',
  '<link rel="preload" href="img/medallion.png" as="image">',
].join(EOL) + EOL + html.slice(after);

writeFileSync('index.html', html);
console.log('index.html now links fonts/ and img/');
```

- [ ] **Step 3: Run the extraction**

Run: `node .work/extract-assets.mjs`

Expected: the five file paths, then `index.html now links fonts/ and img/`. Sizes: `ls -l fonts img` shows 246428, 188688, 188168, 300063 and 37518 bytes.

- [ ] **Step 4: Precache the files**

In `sw.js`, replace:

```js
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
```

with:

```js
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './fonts/UthmanicHafs.otf', './fonts/Amiri-Regular.woff', './fonts/Amiri-Bold.woff',
  './img/medallion.png', './img/header-bismillah.png'];
```

- [ ] **Step 5: Run every check**

Run: `node .work/check-assets.mjs && node .work/parse-check.mjs && node .work/check-content.mjs && node --test .work/sw.test.mjs`

Expected:
- the `fonts/ and img/ match 38d413f …` line
- `the script in index.html parses`
- the content line
- `ℹ pass 10` and `ℹ fail 0`

- [ ] **Step 6: (browser) The fonts and images load, and no preload goes to waste**

Reload `http://localhost:8000/` and wait 5 s. Then run:

```js
await document.fonts.ready;
({
  faces: [...document.fonts].filter(f => /Uthmanic|Amiri/.test(f.family)).map(f => `${f.family} ${f.weight} ${f.status}`),
  medallion: document.querySelector('.medallion-mark').naturalWidth,
})
```

Expected: `faces` includes `UthmanicHafs 400 loaded` and `Amiri 400 loaded` (the bold face may still show `unloaded`), and `medallion` is greater than 0.

Open a Dalāʾil portion (`openDalail(7)`) and check that the header bismillah has `naturalWidth > 0` (`document.querySelector('.bismillah-mark, .reader-bismillah').naturalWidth`).

Switch to dark mode (`toggleTheme()`) and open the same portion in the Book view (`state.pageView = true; openDalail(7)`). Take a screenshot: the Arabic is set in the Uthmani hand on the manuscript leaf, and readable in dark mode. Run `toggleTheme()` again to go back to light, then `goHome()`.

Run `read_console_messages`: there must be no 404s, and no "was preloaded using link preload but not used" warning. If that warning names `fonts/Amiri-Regular.woff`, delete that preload line from `<head>` and re-check.

- [ ] **Step 7: (browser) Compare old and new again**

In the old tab, run the full text of `.work/snapshot.js`, then `(await window.__snapshot()).views`, and keep the object. In the new tab, run `.work/snapshot.js`, then this, with the old object pasted in place of `OLD_VIEWS`:

```js
await (async () => {
  const mine = (await window.__snapshot()).views;
  const other = OLD_VIEWS;
  return { count: Object.keys(mine).length, differ: window.__compare(other, mine) };
})()
```

Expected: `differ: []`. Image URLs are blanked by the snapshot.

- [ ] **Step 8: Commit**

```bash
git add fonts img index.html sw.js
git ls-files --eol fonts img
git commit -m "Serve the Arabic fonts and masthead images as files instead of base64

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -1
```

Expected from `ls-files --eol`: `i/-text` for all five files, meaning git treats them as binary.

---

### Task 5: Documentation

**Files:**
- Create: `content/README.md`
- Rewrite: `README.md`, `CONTRIBUTING.md`

**Interfaces:**
- Consumes: the folder names and fields as they now exist; the position-dependent tables in `index.html`.
- Produces: docs only.

- [ ] **Step 1: Write `content/README.md`**

Create `content/README.md` with exactly:

~~~~markdown
# The texts

Every text in the app lives here: one folder per section, one JSON file per piece.
The app loads them all when it starts, so a piece added here shows up in its
section, in search and in favourites with no other change.

## Folders

| Folder | What it holds |
|---|---|
| `qasidas/` | Duas and qasidas, including the numbered sections of the Mawlid ad-Daybaʿī |
| `sirah/` | The prose sections of the Mawlid ad-Daybaʿī |
| `barzanji/` | Mawlid al-Barzanjī |
| `diya/` | The Shimmering Light, al-Ḥabīb ʿUmar bin Ḥafīẓ’s mawlid |
| `burdah/` | The 10 chapters of the Qaṣīda Burdah |
| `dalail/` | Dalāʾil al-Khayrāt, divided for the week |
| `litanies/` | The aḥzāb, with the daily portions of Ḥizb al-Aʿẓam and Ḥizb al-Istighfār |
| `silsila/` | The 40 masters of the Naqshbandi Golden Chain |
| `turuqs/` | The Sufi orders |
| `sohbets/` | Sohbets, each in its shaykh's room |
| `ilahis/` | Turkish ilahis |
| `nasheeds/` | Nasheeds |
| `biographies/` | Lives of the awliyāʾ and scholars |
| `ottoman/` | Ottoman history |

`index.json` in this folder lists the section folders, so the service worker knows
what to keep for offline use. It changes only when a section is added to the app,
which needs code changes in `index.html` as well.

## Order: each folder's `index.json`

Each folder has an `index.json` listing its pieces in reading order, by file name
without `.json`:

```json
[
  "title-page",
  "the-opening-dua",
  "the-names-of-allah"
]
```

The app shows exactly these pieces, in this order. A file that isn't listed doesn't
appear. A name that has no file stops the whole section from loading, and a notice
at the bottom of the screen names the missing file.

**Don't reorder `dalail/` or `litanies/`.** The app finds some of their pieces by
position: the Dalāʾil day cards and recitations, and the daily portions of Ḥizb
al-Aʿẓam and Ḥizb al-Istighfār. Add new pieces at the end. Moving one needs a
matching change in `index.html`: `DALAIL_DAYS`, `DALAIL_TODAY_IDX`, `DALAIL_AUDIO`,
`AZAM_FIRST`, `ISTIGHFAR_FIRST`, and their `…_TODAY_IDX` tables.

## Adding a piece

1. Copy a piece from the same folder as a template.
2. Name the new file after the piece's English title (see "File names" below).
3. Add that name to the folder's `index.json`, where the piece belongs.
4. Check it in the app (see "Running it locally" in the main `README.md`). If a
   file has a mistake, a notice at the bottom of the screen names it and says
   what's wrong, and that section stays empty until it's fixed.

## File names

A file is named after the piece's English title:

1. Drop the leading `N ·`, anything after an em dash (—) and anything in
   parentheses.
2. Fold accents and diacritics (`Ḥizb al-Wiqāyah` → `hizb-al-wiqayah`, Turkish `ı`
   → `i`), and drop ʿ, ʾ and apostrophes.
3. Lowercase it, turn every run of other characters into `-`, and keep it to 60
   characters at most, cut at a word.
4. If two pieces in a folder would get the same name, use the full title for both
   (`monday-part-1`, `monday-part-2`).

Names carry no numbers: the order lives only in `index.json`, so adding a piece
never means renaming others. A name is only a label; if a title changes later, the
file can keep its name.

## Writing JSON

- Text goes in double quotes. A `"` inside text is written `\"`.
- No comma after the last item of a list or object, and no comments.
- Write Arabic as it is, not escaped, and save files as UTF-8.
- `\n` inside text is a line break; `۞` splits the two halves of a line of poetry.

## A piece

```json
{
  "titleArabic": "…",
  "titleEnglish": "5 · On His Miracles",
  "note": "Shown as a banner at the top of the reader.",
  "video": "https://youtu.be/…",
  "verses": [
    {
      "ar": "…",
      "tr": "…",
      "en": "…"
    }
  ]
}
```

| Field | Required | What it does |
|---|---|---|
| `titleEnglish` | yes | The English title. A leading `N ·` (`"5 · On His Miracles"`) is shown as the piece's number; in the Mawlid ad-Daybaʿī it also sets the piece's place in the kitab. |
| `titleArabic` | | The Arabic title, shown large, right to left. |
| `verses` | yes | A list with one entry per line of poetry or paragraph of prose. It may be empty (`[]`) for a piece still to be written. |
| `note` | | A banner at the top of the reader. |
| `video`, `video2` | | A "Listen" link, and an alternate version. To start at a timestamp, keep the `t=` parameter and drop the `si=` part: `https://youtu.be/VIDEO?t=355`. |

Each verse:

| Field | What it does |
|---|---|
| `ar` | The original: Arabic, or the Turkish or English text in a `latin` piece. |
| `tr` | Transliteration; `""` when there is none. |
| `en` | English. |
| `refrain` | `true` marks the verse as the refrain. |
| `note` | A small note shown with the verse. |
| `instruction` | `true` marks a reading instruction rather than text to recite. |

### Fields some sections use

| Field | Where | What it does |
|---|---|---|
| `group`, `category` | `qasidas/` | `group` is `"duas"` or `"qasidas"`, and `category` is `"dua"` or `"qasida"`. A qasida with no `N ·` number belongs to the Qasidas list rather than the Mawlid. |
| `latin` | `ilahis/`, `sohbets/`, `biographies/`, `ottoman/` | `true` for text in Latin script: the Turkish or English goes in `ar` and is shown left to right, and `tr` stays `""`. |
| `prose` | `sohbets/` | `true` sets `latin` text as flowing paragraphs. |
| `shaykh`, `date`, `location` | `sohbets/` | The room the sohbet belongs in (a shaykh's `id` from `SOHBET_SHAYKHS` in `index.html`), and when and where it was given. Leave `date` or `location` as `""` when unknown. |
| `image` | `silsila/` | A small portrait beside the master's name: a `data:` URI or an `https://` URL. `""` keeps the placeholder avatar. |
| `folios` | `dalail/`, `litanies/` | Turns on the Book view. Each entry `{ "from": 0, "to": 52 }` is a range of verse positions, counted from 0, laid out as manuscript leaves. |
| `cartouche` | `dalail/`, `litanies/` | The heading on each leaf in the Book view; the Arabic title when left out. |
| `videoStart`, `videoEnd` | `dalail/` | Where this portion's recitation starts and ends in the video, in seconds. The end may be left out. |

Verses in the Book view can also carry these fields:
- `sep`: a mark such as `ﷺ`, drawn instead of the rosette
- `band`: a heading on a decorative band before the verse, such as the start of a third
- `noRosette`: `true` means no rosette after the verse
- `shortPage`: `true` means the leaf ends early, as it does in the book

A `‖` inside `ar` marks a page turn in the Book view. Copy these from an existing
piece rather than writing them from scratch.
~~~~

- [ ] **Step 2: Rewrite `README.md`**

Replace the whole of `README.md` with exactly:

~~~~markdown
# Sacred Texts

A small, offline-capable web app (PWA) for Islamic devotional texts and learning.
The home page opens onto its sections: the mawlid texts and Qaṣīda Burdah,
Dalāʾil al-Khayrāt, the Naqshbandi silsila, the turuqs, sohbets, ilahis, biographies
and Ottoman history. Each piece shows the original text with transliteration and
English, has adjustable Arabic size, dark mode and fuzzy search.

Sections still being written (silsila, turuqs, sohbets, biographies, Ottoman history)
are wired up and show a placeholder until their content is added — see
"How the content is organised" below.

Started from the [Mawalid](https://github.com/zboon/Mawlid-app) app and carries its
structure, fonts and conventions.

It is a **static site**: plain HTML, CSS and JavaScript, with the texts as JSON files in
`content/`. There is no build step and there are no dependencies.

---

## Files

| File | What it is |
|------|------------|
| `content/` | **The texts.** One folder per section, one JSON file per piece, and an `index.json` in each folder giving the order. This is where you normally edit — see `content/README.md`. |
| `index.html` | The app: its styling (CSS) and logic (JS). |
| `fonts/` | The bundled Arabic fonts (see below). |
| `img/` | The masthead artwork. |
| `sw.js` | Service worker — makes the app work offline. Contains the cache version string (see below). |
| `manifest.json` | PWA metadata (app name, icons, colours) so it installs to a phone home screen. |
| `icon-192.png`, `icon-512.png` | Home-screen icons. |
| `OFL.txt` | The SIL Open Font License for the bundled Arabic font. **Keep this file** — the licence requires it to travel with the font. |

### The Arabic fonts

Two Arabic faces are bundled in `fonts/` and served with the app. Neither is
fetched from Google.

**KFGQPC Uthmanic Script HAFS** sets the body Arabic — the mushaf hand from the
King Fahd Glorious Qur'an Printing Complex, based on the calligraphy of Uthman
Taha.

**Amiri** (Regular and Bold, WOFF) sits underneath it as the fallback, and is
what draws the rosettes.

That pairing is deliberate, and the `unicode-range` on the Uthmani `@font-face`
is load-bearing. The Uthmani font maps 171 codepoints — the Arabic comma,
semicolon, question mark and full stop, the ۞ rosette, and every Persian letter
among them — to an *empty placeholder glyph*, which renders as a black blob
rather than as nothing. Checking whether a character is in the font's cmap is
therefore misleading; it is there, it just isn't drawn. The `unicode-range`
lists only the codepoints the font genuinely draws, so everything else falls
through to Amiri and a comma still looks like a comma. If you ever replace or
update the Uthmani file, recompute that range rather than trusting the cmap.

Bundling matters more than it sounds: the text is fully vocalised, and if the
font failed to load, the harakat would fall back to whatever the phone happens
to have — at exactly the moment someone is reciting aloud. Bundling means the
Arabic renders correctly with no connection at all. The Latin faces (Crimson
Pro, Karla) still come from Google Fonts, but the service worker caches them
after the first load.

**Licences differ between the two, which matters if you change anything.** Amiri
is under the SIL OFL 1.1 (see `OFL.txt`) — bundling, redistribution and
modification are all permitted. The KFGQPC font is free to use, copy and
distribute but **may not be modified**, which is why `fonts/UthmanicHafs.otf` is the
original file byte for byte, *not* subset or converted; that costs about 240KB and
cannot be optimised away without breaching the licence.

To swap the body Arabic, replace `fonts/UthmanicHafs.otf` and update its `@font-face`
block and preload in `index.html`, its entry in `CORE` in `sw.js`, and the
`font-family:'UthmanicHafs','Amiri',serif` rules. Leave the rosette rule
(`.ms-r, .rosette`) pinned to Amiri, and keep `OFL.txt`.

---

## Running it locally

The app loads its texts from `content/`, and browsers refuse to do that for a page
opened straight from disk, so double-clicking `index.html` no longer works. Serve the
folder with any local web server instead, for example with Python:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. For editing, [VS Code](https://code.visualstudio.com/)
(free) is ideal.

The offline service worker runs on `localhost` too. It fetches `index.html` and the
texts network-first, so a normal reload shows your edits. Fonts and images are
cache-first: after replacing one, clear the site's data in the browser.

---

## How the content is organised

Every text lives in `content/`: one folder per section, one JSON file per piece, and
an `index.json` in each folder listing its pieces in reading order.
`content/README.md` describes a piece's format, every field, how files are named,
and how to add one.

### Text conventions

- In the `ar` field, use `۞` to separate the two halves (hemistichs) of a line of poetry.
- Use `\n` for a hard line break within a verse (rendered as a new line).
- For **Turkish Ilahis**, the piece is marked `"latin": true`. The Turkish lyric goes in the
  `ar` field (it renders left-to-right in Latin script, not Arabic), the English goes in
  `en`, and `tr` is left empty (`""`). The transliteration toggle is hidden automatically.

### Adding a new qasida

Copy a qasida in `content/qasidas/` to a new file named after the new piece's English
title, replace the text (keep `"group": "qasidas"`), and add the file's name to
`content/qasidas/index.json`. That's it — it appears in the Qasidas tab and in search
automatically.

### Adding a new Turkish ilahi

Add a file to `content/ilahis/` with `"latin": true`, the Turkish in `ar` and the English
in `en`, and add its name to `content/ilahis/index.json`. Only use **public-domain**
lyrics (see the note on content below).

### Adding audio to a Burda chapter (or anything)

Add a `"video"` field with a YouTube link to the piece's file. To link a specific
timestamp, keep the `t=` parameter and drop the `si=` tracking part, e.g.
`https://youtu.be/VIDEO?t=355`.

---

## ⚠️ The one thing you must not forget: bump the cache version

Because the app caches itself for offline use, **installed phones will not see your changes
until you bump the cache version.** After editing `index.html`, open `sw.js` and increment
the number on this line:

```js
const CACHE = 'sacredtexts-v385';   // change to 'sacredtexts-v386', then v387, …
```

If you forget this, your edits will look fine in a fresh browser but won't reach anyone who
already installed the app.

Texts are the exception: the app fetches everything in `content/` network-first, so a
corrected text reaches installed phones the next time they open the app with a
connection, without a bump.

---

## Deploying / hosting

The app is just static files, so any static host works.

### Option A — GitHub Pages (recommended, free, auto-updates)
1. In the repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, and Save.
3. After a minute your app is live at `https://zboon.github.io/SacredTexts/`.
   (The repo must be public for Pages on a free account.)
4. Every time you commit a change (and bump the cache), the live site updates automatically.

### Option B — Netlify Drop (drag-and-drop, no account needed)
Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag in the **folder** of
files (`index.html`, `sw.js` and the `content/`, `fonts/` and `img/` folders must be at
the top level). You get an instant public link.

---

## Installing on a phone

Open the hosted link in Chrome (Android) or Safari (iOS) → menu → **Add to Home screen** /
**Install app**. It then works fully offline. Bumping the cache version makes installed
phones auto-update on next launch.

---

## Live sessions (optional — off by default)

Lets a gathering follow whoever is leading: when they open a piece, every joined
device opens it too. It's the only part of the app that uses the network.

**It is off until you switch it on**, and the rest of the app never depends on it.
The Supabase library is only fetched when someone taps Start/Join, so an offline
launch never waits on it. If it can't connect, following stops and nothing else
changes — you browse, search and bookmark exactly as before.

### Switching it on

1. Make a free project at [supabase.com](https://supabase.com).
2. In the dashboard go to **Project Settings → API** and copy the **Project URL**
   and the **anon / public** key.
3. In `index.html`, find `SESSION_CONFIG` near the top of the `<script>` and paste
   them in:

```js
const SESSION_CONFIG = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'eyJhbGciOi…'      // the anon/public key
};
```

4. Bump the cache version in `sw.js` and redeploy.

The anon key is designed to be public — it's safe in a public repo. No database
tables and no sign-in are needed: sessions use Realtime **Broadcast**, which just
relays messages and stores nothing.

### Using it

- The leader opens **Live Session → Start a session**, then taps **Share link** and
  sends it to the group (WhatsApp, SMS, wherever). Tapping the link joins them
  straight away — no code to type.
- The 4-digit code is still shown, so anyone who can't open the link can be told it
  and enter it under **Join**.
- Anyone who opens something themselves takes over; a **Resume** button in the
  banner puts them back in step. Joining late jumps you to wherever the leader is.
- A banner at the top shows whether you're leading, following, or paused.

The link is just `…/#s=4821`. The code sits in the URL *fragment*, which browsers
never send to a server, so sharing a link reveals nothing to the host.

### The honest limits

- Following needs internet at the gathering. Everything else works offline.
- A device that is offline can't be told the leader moved — it simply stays put.

---

## A note on content & copyright (please keep to this)

The approach throughout this project has been deliberate:

- **Original texts are reproduced only when public domain.** The Arabic of the Burda
  (al-Būṣīrī, ~750 years old) and the *Mawlid ad-Daybaʿī* prose (~500 years old) are public
  domain. Turkish ilahis are included only from poets who died centuries ago (Yunus Emre,
  Pir Sultan Abdal, Niyazi Mısrî, etc.).
- **English translations are our own renderings** — checked against the source meaning, but
  not copied from any copyrighted translation.
- **We do not reproduce modern, copyrighted lyrics** (e.g. a contemporary artist's recorded
  ilahi), even for private use. If a piece can't be traced to a public-domain author, we
  don't paste its full text — we link to the source instead.

If you add content, please keep to this: public-domain originals + your own English.
~~~~

- [ ] **Step 3: Rewrite `CONTRIBUTING.md`**

Replace the whole of `CONTRIBUTING.md` with exactly:

~~~~markdown
# Working on a section

Each section of the app has its own branch, so several people can write at
the same time without waiting on each other. Everything you need is already
wired up — you add content, nothing else.

## 1. Your branch and your folder

Check out your branch and edit only the folder named below, inside `content/`.
Each piece is its own JSON file, and the folder's `index.json` lists the pieces
in reading order.

| Section | Branch | The folder you edit |
|---|---|---|
| Mawlid | `section/mawlid` | `content/qasidas/`, `content/barzanji/`, `content/diya/`, `content/burdah/` |
| Dalāʾil al-Khayrāt | `section/dalail` | `content/dalail/` |
| Naqshbandi Silsila | `section/silsila` | `content/silsila/` |
| Turuqs | `section/turuqs` | `content/turuqs/` |
| Sohbets | `section/sohbets` | `content/sohbets/` |
| Ilahi | `section/ilahi` | `content/ilahis/` |
| Biographies | `section/biographies` | `content/biographies/` |
| Ottoman History | `section/ottoman` | `content/ottoman/` |

```bash
git checkout section/silsila     # your branch
# edit content/silsila/ — your folder only
git add content/silsila
git commit -m "Silsila: add Shaykh ʿAbd al-Khāliq al-Ghujdawānī"
git push
```

Your section's tile, list, reader, search and bookmarks all work the moment you
add a piece and list it in `index.json`. There is no build step.

## 2. The piece format

Every section uses the same shape, one piece per file:

```json
{
  "titleArabic": "الشَّيْخ عَبْد الْخَالِق الْغُجْدَوَانِي",
  "titleEnglish": "1 · Shaykh ʿAbd al-Khāliq al-Ghujdawānī",
  "note": "…",
  "video": "https://youtu.be/…",
  "verses": [
    {
      "ar": "مِنْ سَادَاتِ الطَّرِيقَةِ",
      "tr": "Min sādāti-ṭ-ṭarīqah",
      "en": "One of the masters of the path."
    }
  ]
}
```

- `note` (a banner at the top) and `video` (a "Listen" link) are optional.
- The leading `N ·` in `titleEnglish` is the number shown with the piece.
- One `verses` entry per paragraph (prose) or per line (poetry).
- `۞` splits the two halves of a line of poetry; `\n` is a hard line break.
- **English prose** (Sohbets, Biographies, Ottoman History): add `"latin": true`,
  put the English in `ar` (it renders left-to-right), and leave `tr` as `""`.
- It's JSON: double quotes only, `\"` for a quote inside text, no comma after the
  last item, no comments.

`content/README.md` lists every field, how files are named, and how to add a piece.

### Silsila only: portraits

`content/silsila/` already holds all 40 masters of the Golden Chain as stubs —
the tile, numbering and reader placeholder work as soon as
`titleArabic`/`titleEnglish` are there, even with an empty `"verses": []`. Fill
in each master's own file; don't rename, remove or reorder the stubs. To add a
small thumbnail beside a master's name, set `"image"` to a data URI or an
`https://` URL; leave it `""` to keep the placeholder avatar. This field is
specific to this section and does nothing elsewhere.

## 3. Checking your work

Serve the app locally — opening `index.html` by double-click no longer works,
because browsers won't load the texts from files:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Your pieces should appear in your section and
open when tapped. If a file has a mistake, a notice at the bottom of the screen
names the file and what's wrong, and your section stays empty until it's fixed.

## 4. Rules that keep the merges clean

- **Only touch your own folder.** Everything else — the menu, the routing, the
  counts, the readers — is already done and shared by all eight branches. If
  you think you need a change outside your folder, raise it rather than making
  it on your branch.
- **Don't bump `APP_VERSION` or the cache version in `sw.js`.** Every branch
  would change the same line and every merge would conflict. Whoever merges to
  `main` bumps it once, at the end.
- **Merge `main` into your branch** before opening a pull request, so you
  resolve anything on your side rather than in the shared branch.

## 5. Content and copyright

Follow the policy in `README.md`: original texts only where they are public
domain, English renderings written by us rather than copied from a copyrighted
translation, and no modern copyrighted lyrics. If a piece can't be traced to a
public-domain source, link to it instead of pasting the full text.
~~~~

- [ ] **Step 4: Check the docs against the repository**

```bash
for p in content/README.md content/index.json fonts/UthmanicHafs.otf img/medallion.png .claude/launch.json; do test -e "$p" && echo "ok $p" || echo "MISSING $p"; done
for d in qasidas sirah barzanji diya burdah dalail litanies silsila turuqs sohbets ilahis nasheeds biographies ottoman; do grep -q "\`$d/\`" content/README.md || echo "content/README.md does not mention $d/"; done
grep -n "DALAIL_DAYS\|DALAIL_TODAY_IDX\|DALAIL_AUDIO\|AZAM_FIRST\|ISTIGHFAR_FIRST" index.html | grep -c "const "
node .work/check-content.mjs
```

Expected:
- five `ok` lines
- no "does not mention" lines
- the count `5` (the five position-dependent tables named in `content/README.md` exist)
- the content check passes, since `content/README.md` sits outside the section folders

- [ ] **Step 5: Commit**

```bash
git add content/README.md README.md CONTRIBUTING.md
git commit -m "Document the content/ layout for editors and contributors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 6: Release check and version bump

**Files:**
- Modify: `sw.js` (`CACHE`), `index.html` (`APP_VERSION`), `README.md` (the cache example)
- Test: every check and browser test from the earlier tasks, on the final state

**Interfaces:**
- Consumes: everything above.
- Produces: the release-ready branch.

- [ ] **Step 1: Bump the version, all three places at once**

In `sw.js`, replace `const CACHE = 'sacredtexts-v385';` with `const CACHE = 'sacredtexts-v386';`.

In `index.html`, replace `const APP_VERSION = 'v385';` with `const APP_VERSION = 'v386';`.

In `README.md`, replace `const CACHE = 'sacredtexts-v385';   // change to 'sacredtexts-v386', then v387, …` with `const CACHE = 'sacredtexts-v386';   // change to 'sacredtexts-v387', then v388, …`.

```bash
grep -n "v385" sw.js index.html README.md ; echo "(expect no v385 lines above)"
```

- [ ] **Step 2: Run every automated check**

Run: `node --test .work/sw.test.mjs && node .work/check-content.mjs && node .work/check-assets.mjs && node .work/parse-check.mjs`

Expected: `ℹ pass 10` and `ℹ fail 0`, the content line, the assets line, and `the script in index.html parses`.

- [ ] **Step 3: (browser) Offline after a normal visit**

Reload `http://localhost:8000/` twice so the v386 worker installs and takes over. Then run:

```js
await (async () => {
  await navigator.serviceWorker.ready;
  const c = await caches.open('sacredtexts-v386');
  return { controlled: !!navigator.serviceWorker.controller, cached: (await c.keys()).length };
})()
```

Expected: `controlled: true` and `cached` of at least 176: 10 shell files, 14 section listings and 152 pieces.

Stop the server (`preview_list`, then `preview_stop`), then `navigate` to `http://localhost:8000/` and run:

```js
await new Promise(r => setTimeout(r, 1500));
({ counts: CONTENT_SECTIONS.map(s => s.pieces.length).join(','), notice: !!document.querySelector('.load-notice'),
   medallion: document.querySelector('.medallion-mark').naturalWidth > 0 })
```

Expected: `counts` `25,7,17,8,10,15,18,40,0,1,11,0,0,0`, `notice: false` and `medallion: true`. Then open a Dalāʾil portion (`openDalail(7)`) and take a screenshot: the Arabic is set in the Uthmani hand. Restart the server with `preview_start` (name `sacredtexts`).

- [ ] **Step 4: (browser) Offline straight after a first visit (the precache)**

Wipe this site's worker and caches, keeping recitations:

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const k of await caches.keys()) if (k !== 'sacredtexts-audio') await caches.delete(k);
'cleared'
```

`navigate` to `http://localhost:8000/` (a first visit as far as the worker is concerned), then run:

```js
await navigator.serviceWorker.ready;
for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 200));
({ controlled: !!navigator.serviceWorker.controller, cached: (await (await caches.open('sacredtexts-v386')).keys()).length })
```

Expected: `controlled: true` and `cached` of at least 176. Stop the server, `navigate` to `http://localhost:8000/` again, and repeat the Step 3 check. Expected: the same counts, `notice: false`. Restart the server.

- [ ] **Step 5: (browser) A corrected text arrives without a cache bump**

```bash
sed -i 's/"titleEnglish": "5 · On His Miracles"/"titleEnglish": "5 · On His Miracles (edited)"/' content/burdah/on-his-miracles.json
git diff --stat
```

Expected: `content/burdah/on-his-miracles.json | 2 +-`. Reload `http://localhost:8000/`, wait 1.5 s, and evaluate `BURDAH_CHAPTERS[4].titleEnglish`. Expected: `"5 · On His Miracles (edited)"`. Then:

```bash
git checkout -- content/burdah/on-his-miracles.json
```

Reload again. Expected: `"5 · On His Miracles"`.

- [ ] **Step 6: (browser) A shared session link still lands on the session screen**

`navigate` to `http://localhost:8000/#s=4821`, wait 1.5 s, and evaluate `state.tab`. Expected: `"session"`. Then `navigate` to `http://localhost:8000/`.

- [ ] **Step 7: (browser) The final old-against-new comparison**

In the old tab, run the full text of `.work/snapshot.js`, then `(await window.__snapshot()).views`, and keep the object. In the new tab, run `.work/snapshot.js`, then this, with the old object pasted in place of `OLD_VIEWS`:

```js
await (async () => {
  const mine = (await window.__snapshot()).views;
  const other = OLD_VIEWS;
  return { count: Object.keys(mine).length, differ: window.__compare(other, mine) };
})()
```

Expected: `differ: []`. The snapshot blanks the version tag, so the bump to `v386` doesn't count as a difference.

- [ ] **Step 8: Remove the old copy and commit the bump**

```bash
git worktree remove .work/base
git add sw.js index.html README.md
git commit -m "Bump the cache version to v386 for the content/ release

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git status --short
git log --oneline 38d413f..HEAD
```

Expected: a clean `git status`, and since `38d413f` the spec and plan commits followed by one commit per task, six in all. Leave `.work/` in place until the branch is merged; it's excluded from git.
