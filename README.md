# Naqshbandi Hakkani Academy — الأكاديمية النقشبندية الحقانية

A small, offline-capable web app (PWA) for Islamic devotional texts and learning.
The home page opens onto the Academy's sections: the mawlid texts and Qaṣīda Burdah,
Dalāʾil al-Khayrāt, the Naqshbandi silsila, the turuqs, sohbets, ilahis, biographies
and Ottoman history. Each piece shows the original text with transliteration and
English, has adjustable Arabic size, dark mode, fuzzy search, and a hands-free
auto-scroll for recitation.

Sections still being written (silsila, turuqs, sohbets, biographies, Ottoman history)
are wired up and show a placeholder until their content is added — see
"How the content is organised" below.

Started from the [Mawalid](https://github.com/zboon/Mawlid-app) app and carries its
structure, fonts and conventions.

It is a **single self-contained app** — no build step, no server, no dependencies.

---

## Files

| File | What it is |
|------|------------|
| `index.html` | **Everything.** All content, styling (CSS), and logic (JS) live here — including the bundled Arabic font. This is the only file you normally edit. |
| `sw.js` | Service worker — makes the app work offline. Contains the cache version string (see below). |
| `manifest.json` | PWA metadata (app name, icons, colours) so it installs to a phone home screen. |
| `icon-192.png`, `icon-512.png` | Home-screen icons. |
| `OFL.txt` | The SIL Open Font License for the bundled Arabic font. **Keep this file** — the licence requires it to travel with the font. |

### The Arabic fonts

Two Arabic faces are embedded directly in `index.html` as base64. Neither is
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
distribute but **may not be modified**, which is why it is embedded byte-for-byte
and *not* subset; that costs about 330KB and cannot be optimised away without
breaching the licence.

To swap the body Arabic, replace the `UthmanicHafs` `@font-face` block and the
`font-family:'UthmanicHafs','Amiri',serif` rules. Leave the rosette rule
(`.ms-r, .rosette`) pinned to Amiri, and keep `OFL.txt`.

---

## Running it locally

Just open `index.html` in a web browser (double-click it). That's enough to see and test
everything. For editing, [VS Code](https://code.visualstudio.com/) (free) is ideal.

> Note: the offline service worker only activates when the app is served over **https**
> (i.e. once it's hosted). Opening the file directly still works fine for previewing content.

---

## How the content is organised

Inside `index.html`, near the top of the `<script>`, the content lives in a few arrays:

- `QASIDAS` — the Duas group and the Qasidas group (each item has a `group:` of `"duas"` or `"qasidas"`).
- `BURDAH_CHAPTERS` — the 10 chapters of the Qaṣīda Burdah.
- `SIRAH_CHAPTERS` — the 7 prose sections of the Shamāʾil & Sīrah.
- `ILAHI_CHAPTERS` — the Turkish Ilahis.

Every "piece" is an object shaped like this:

```js
{
  category: "qasida",          // "qasida" or "dua" (only used in the QASIDAS array)
  group: "qasidas",            // "duas" or "qasidas" (only used in the QASIDAS array)
  titleArabic: "…",
  titleEnglish: "13 · …",      // the leading "N ·" just controls display order/label
  note: "…",                   // optional — shows a green banner at the top of the reader
  video: "https://…",          // optional — adds a "▶ Listen to the tune" link
  video2: "https://…",         // optional — adds a second "alternate version" link
  verses: [
    { ar: "…", tr: "…", en: "…" },              // Arabic · transliteration · English
    { refrain: true, ar: "…", tr: "…", en: "…" } // refrain verses get a "Refrain" label
  ]
}
```

### Text conventions

- In the `ar` field, use `۞` to separate the two halves (hemistichs) of a line of poetry.
- Use `\n` for a hard line break within a verse (rendered as a new line).
- For **Turkish Ilahis**, the entry is marked `latin: true`. The Turkish lyric goes in the
  `ar` field (it renders left-to-right in Latin script, not Arabic), the English goes in
  `en`, and `tr` is left empty (`""`). The transliteration toggle is hidden automatically.

### Adding a new qasida

Add another object to the `QASIDAS` array with `group: "qasidas"`. Copy an existing entry
as a template and replace the text. That's it — it appears in the Qasidas tab and in search
automatically.

### Adding a new Turkish ilahi

Add an object to `ILAHI_CHAPTERS`, using `latin: true`, with the Turkish in `ar` and the
English in `en`. Only use **public-domain** lyrics (see the note on content below).

### Adding audio to a Burda chapter (or anything)

Add a `video:` field with a YouTube link. To link a specific timestamp, keep the `t=`
parameter and drop the `si=` tracking part, e.g. `https://youtu.be/VIDEO?t=355`.

---

## ⚠️ The one thing you must not forget: bump the cache version

Because the app caches itself for offline use, **installed phones will not see your changes
until you bump the cache version.** After editing `index.html`, open `sw.js` and increment
the number on this line:

```js
const CACHE = 'nhacademy-v381';   // change to 'nhacademy-v382', then v383, …
```

If you forget this, your edits will look fine in a fresh browser but won't reach anyone who
already installed the app.

---

## Deploying / hosting

The app is just static files, so any static host works.

### Option A — GitHub Pages (recommended, free, auto-updates)
1. In the repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, and Save.
3. After a minute your app is live at `https://zboon.github.io/naqshbandi-hakkani-academy/`.
   (The repo must be public for Pages on a free account.)
4. Every time you commit a change (and bump the cache), the live site updates automatically.

### Option B — Netlify Drop (drag-and-drop, no account needed)
Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag in the **folder** of
files (the 5 app files must be at the top level). You get an instant public link.

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
changes — you browse, search, bookmark and auto-scroll exactly as before.

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
