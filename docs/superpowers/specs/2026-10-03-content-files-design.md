# Content in files — design

**Status:** draft for review
**Branch:** `issue10_splitting_content_to_files`
**Date:** 2026-10-03

## Goal

Move every text out of `index.html` into its own file: one folder per section, one
JSON file per piece. Content can then be edited, reviewed and merged piece by piece,
which is the groundwork for a platform with many sections. The bundled fonts and
images leave `index.html` in the same change.

## What must not change

- **Behaviour.** The same pieces in the same order, every string identical byte for
  byte (no Unicode normalisation), and the same search, bookmarks, Dalāʾil saved
  place and live sessions.
- **No build step, no dependencies.** The app stays plain HTML, CSS and JS, plus
  data files.
- **Offline.** After the first visit, the whole app works with no connection, every
  text included.
- **Updates arrive.** A corrected text reaches installed apps without anyone bumping
  the cache version.

## Decisions already made

| Question | Decision |
|---|---|
| File format | JSON, UTF-8 without BOM, Arabic as literal characters |
| Granularity | One folder per section, one file per piece |
| Loading | Load everything at startup, then run exactly as today. Loading sections on demand is a possible later step. |
| Local preview | Needs a local web server. Double-clicking `index.html` no longer works. |
| Special cases | None. Every content folder has the same shape. |

## 1. Layout

```
index.html                 the app only: CSS + JS (about 0.3 MB, from 2.8 MB)
content/
  index.json               the list of section folders, for the service worker
  README.md                how to write and add pieces
  dalail/
    index.json             the reading order
    title-page.json        one piece
    the-opening-dua.json
    …
  burdah/
    …
fonts/
  UthmanicHafs.otf
  Amiri-Regular.woff
  Amiri-Bold.woff
img/
  medallion.png
  header-bismillah.png
```

### Sections

There is one folder per content array. Folders follow the arrays, not the home
menu, because one screen can draw on several arrays: the Mawlid kitab mixes
`qasidas` and `sirah`.

| Folder | Array in the code | Kind | Pieces |
|---|---|---|---|
| `qasidas/` | `QASIDAS` (duas, qasidas and the numbered Mawlid sections) | `q` | 25 |
| `sirah/` | `SIRAH_CHAPTERS` | `s` | 7 |
| `barzanji/` | `BARZANJI_CHAPTERS` | `z` | 17 |
| `diya/` | `DIYA_CHAPTERS` | `y` | 8 |
| `burdah/` | `BURDAH_CHAPTERS` | `b` | 10 |
| `dalail/` | `DALAIL_CHAPTERS` | `d` | 15 |
| `litanies/` | `LITANY_CHAPTERS` | `l` | 18 |
| `silsila/` | `SILSILA_CHAPTERS` | `c` | 40 |
| `turuqs/` | `TURUQ_CHAPTERS` | `t` | 0 |
| `sohbets/` | `SOHBET_CHAPTERS` | `h` | 1 |
| `ilahis/` | `ILAHI_CHAPTERS` | `i` | 11 |
| `nasheeds/` | `NASHEED_CHAPTERS` | `n` | 0 |
| `biographies/` | `BIOGRAPHY_CHAPTERS` | `g` | 0 |
| `ottoman/` | `OTTOMAN_CHAPTERS` | `o` | 0 |

That makes 152 piece files. Empty sections get their folder now, with an
`index.json` of `[]`, so contributors know where to write.

### A piece file

A piece file holds exactly one entry of today's arrays, with the same keys, the
same key order and the same values. It is written with two-space indentation (the
format `DALAIL_CHAPTERS` already uses), LF line endings in the repository, and a
final newline.

```json
{
  "titleArabic": "عُنْوَانُ الْكِتَابِ",
  "titleEnglish": "Title Page",
  "note": "The title page of the book, giving its full name and its author.",
  "verses": [
    {
      "ar": "دَلَائِلُ الْخَيْرَاتِ …",
      "tr": "",
      "en": "Waymarks of Benefits …"
    }
  ]
}
```

The content holds no invisible characters (checked), so plain JSON keeps every
string readable. The only escapes in today's source are four curly quotes
(`“`, `”`), and they become the literal characters.

### A section's `index.json`

A section's `index.json` gives the reading order, as file names without `.json`:

```json
[
  "title-page",
  "the-opening-dua",
  "the-names-of-allah"
]
```

The file has to exist because a static host can't list a folder, so the app must
be told which files there are. It is also the only place where order lives: a
piece's position here is its position in the app.

**Positions matter in two sections.** The code refers to some pieces by position:
- the Dalāʾil day cards (`DALAIL_DAYS`, `DALAIL_TODAY_IDX`)
- the Ḥizb al-Aʿẓam and Istighfār days (`AZAM_FIRST`, `ISTIGHFAR_FIRST` and their
  `…_TODAY_IDX` tables)

In `dalail/` and `litanies/`, new pieces go at the end, and any reordering needs a
matching code change. `content/README.md` says so.

### `content/index.json`

This file lists the section folders. Only the service worker reads it, to know what
to cache for offline use (section 3). It changes only when a section is added, and
adding a section needs code changes anyway.

### File names

Each file is named after the piece's English title:

1. Drop the leading `N ·`, anything after an em dash (—) and anything in
   parentheses.
2. Fold accents and diacritics (`Ḥizb al-Wiqāyah` → `hizb-al-wiqayah`, Turkish `ı`
   → `i`), and drop ʿ, ʾ and apostrophes.
3. Lowercase the result, turn every run of other characters into `-`, and cap it at
   60 characters, cut at a word boundary.
4. If two pieces in a folder would get the same name, both use their full title
   instead (`monday-part-1`, `monday-part-2`).

Names carry no numbers. Order lives only in `index.json`, so inserting a piece
never means renaming other files. A file name is only a label: changing a piece's
title later doesn't require renaming its file. The full list is in the appendix.

### What stays in `index.html`

- **App structure.** The menus and hubs stay: `TABS`, `HOME_CARDS`,
  `MAWLID_COLLECTIONS`, `PRAISE_SECTIONS` and `SOHBET_SHAYKHS`. So does every
  lookup table that points into the content (`DALAIL_DAYS`, `AZAM_DAYS`, …). These
  describe screens, not texts. `SOHBET_SHAYKHS` in particular is read while the
  script starts, to build the Sohbet sub-tabs, before any content could have loaded.
- **Arabic in the interface.** Tile names, day labels and `INLINE_INSTRUCTIONS`
  stay.
- **The two favicons.** They stay inline on purpose: they are tiny and needed
  before anything else loads.

### Fonts and images

- **The three Arabic fonts move to `fonts/`,** byte for byte from the base64 they
  are now. The KFGQPC licence forbids modifying the Uthmani font, so it is not
  converted or subset. The `@font-face` rules keep everything, including the
  load-bearing `unicode-range`; only `src` changes, to `url(fonts/…)`. `OFL.txt`
  stays where it is.
- **The two images in use move to `img/`.** `LOGO_INNER` and `BISMILLAH_MARK` are
  deleted: they are declared but never used.
- **`<head>` preloads the fonts and the masthead image,** so they download
  alongside the content instead of after the first render, and the Arabic doesn't
  visibly swap fonts. Font preloads need `crossorigin`, even from the same site.

Binary files are a quarter smaller than their base64: the fonts take about 620 KB
instead of 830 KB, and the images about 340 KB instead of 450 KB.

## 2. Loading the content

### Declaring the arrays

The arrays keep their names, so none of the code that reads them changes. They are
declared together in one block at the top of the script, where `QASIDAS` starts
today:

```js
const QASIDAS          = contentSection('qasidas');
const SIRAH_CHAPTERS   = contentSection('sirah');
…
```

`contentSection(folder)` returns an empty array and records which folder fills it.
`CONTENT_ROOT = 'content/'` keeps the base URL in one place, so the texts could
later come from another server.

The banner comments above each array, which describe the entry format, move to
`content/README.md`. The advice to "keep your additions inside the blank lines" is
dropped, because it no longer applies.

### Startup

1. `loadContent()` loads all sections in parallel. For each section it fetches the
   section's `index.json`, then every piece in parallel, then fills the array in
   `index.json` order.
2. `start()` then runs what runs at the end of the script today: `renderIndex()`
   and `joinFromLink()`, which opens a shared session link.

Nothing else touches the content while the script starts. This was checked: every
other top-level statement either registers an event listener or reads
localStorage.

Until the first render, `#app` shows a short loading line written into the HTML.

### When something fails

- **Each section loads completely or not at all.** If a section's `index.json` or
  any of its pieces fails (network error, HTTP error or invalid JSON), that whole
  section stays empty. It never has a gap, because the positions of the other
  pieces must not shift.
- **The rest of the app works.** A notice pinned to the bottom of the screen names
  each failed file and the reason, such as the JSON parser's message with its
  position, so a contributor can find a typo. Each failure is also logged to the
  console. The notice sits outside `#app`, so re-renders don't remove it, and it
  has a close button.
- **If no section loads at all,** for example on a first visit with no connection,
  the app shows an error screen with a "Try again" button that reloads the page.
- **An empty section must not crash.** Most sections already show the "No entries
  here yet" placeholder when empty. Dalāʾil's index assumes its portions exist
  (`DALAIL_CHAPTERS[today].titleArabic`), so it gets a guard that shows the
  placeholder instead. Testing (section 5) breaks each folder in turn to find any
  other such screen.
- **Bookmarks survive a failed section.** Favourites and the Dalāʾil saved place
  are looked up by title. A piece that isn't loaded is skipped, never deleted.

## 3. Offline and updates (`sw.js`)

### Precache (install)

- `CORE` gains the three fonts and the two images.
- The worker then reads `content/index.json` and each section's `index.json`, and
  caches every listed file.
- Content caching is best effort: a missing or broken file never stops the new
  worker from installing. If it did, one typo would freeze every installed app on
  its old version, which is the failure the comments in `sw.js` already warn about.

### Requests

| Request | Strategy |
|---|---|
| The page | Unchanged: network first, give up after 4 s, then the cached copy |
| Content (`content/…json`) | **New:** network first with the same 4 s limit, then the cached copy (details below) |
| Fonts, images, Google Fonts | Unchanged: cache first |

For content:

- **Network first, revalidated.** The worker asks the server with
  `cache: 'no-cache'`. The browser revalidates its HTTP-cached copy, so an unchanged
  file costs a tiny 304 response instead of a full download, and nothing stale is
  ever used. The page keeps its `no-store`.
- **Successful responses refresh the cache,** so the latest texts are the ones
  available offline.
- **With no cached copy yet,** the worker keeps waiting for the network instead of
  failing after 4 s.
- **Content follows the page.** If the page itself was just served from the cache
  because the network didn't answer, content requests go straight to the cache too.
  A weak signal, like the masjid wifi, then costs one 4-second wait, not two.

Because content is fetched network first, a fixed typo appears on the next launch
with a connection, and no cache bump is needed. The cache version is still bumped
once for this change, from v385 to v386 in `sw.js` and `APP_VERSION` together. That
is the last commit on this branch.

## 4. Documentation

- **`content/README.md` (new)** covers:
  - the entry format, moved from the code
  - the fields each section uses (`latin`, `refrain`, `group`/`category`,
    `folios`, `cartouche`, `shaykh`/`date`/`location`, `image`, …)
  - the JSON rules: double quotes, no trailing commas, no comments, `\"` inside
    text, `\n` for a line break
  - how to add a piece: create the file, then add its name to `index.json`
  - the naming rule and the position warning
- **`README.md`** gets an updated files table, fonts section (now files, not
  base64), "Running it locally" section, content organisation, and steps for adding
  a qasida or ilahi.
- **`CONTRIBUTING.md`** says "your folder" instead of "your array", keeping the same
  branch-to-section table. It describes checking your work with a local server and
  drops the blank-line merge rule.
- **Running locally:** run `python -m http.server 8000`, then open
  `http://localhost:8000`. Any static server works. `.claude/launch.json` holds the
  same command for Claude Code's preview pane.

## 5. Verification

There is no test suite, so the change is verified with throwaway scripts (not
committed) and in the browser, always with `main` as the reference.

1. **Data, checked automatically.**
   - Each array rebuilt from the files equals the array in `main`'s `index.html`,
     compared as exact strings.
   - Every name in an `index.json` has a file, and every file is listed in its
     `index.json`.
   - `content/index.json` lists exactly the folders the code declares.
   - No file has a BOM.
2. **Fonts.** Each font file's SHA-256 equals that of the base64 it replaced.
3. **Rendering, old against new.** Both versions are served locally side by side.
   These must produce the same HTML, apart from image URLs:
   - the home page and every hub
   - every piece, opened
   - searches: Arabic with and without harakat, and transliteration
4. **In the browser.**
   - The Uthmani face is the one in use.
   - Dark mode works, and the Dalāʾil book view works.
   - Favourites and the Dalāʾil saved place made before the switch still appear
     after it.
   - A shared session link opens.
5. **Offline.**
   - Load once, stop the server and reload: everything works.
   - On a fresh profile, make one online visit, then go offline: everything works,
     thanks to the precache.
6. **Updates.** Change a piece on the server and reload online: the new text
   appears with no cache bump.
7. **Failures.**
   - Remove a piece, or break a file's JSON: only that section is empty, and the
     notice names the file.
   - With the server unreachable and nothing cached, the error screen appears, and
     "Try again" recovers once the server is back.

## Out of scope

- Loading a section only when it's opened (approach B). One file per piece makes it
  easier later.
- Referring to the Dalāʾil and litany days by name instead of by position.
- Moving menus or interface text into data files.
- A JSON check in CI before merging, such as a GitHub Action.
- Updating the `section/*` branches. None has commits of its own, so each one
  fast-forwards to `main` after this lands. That needs a push, so it's a separate
  step done with your go-ahead.

## Appendix: file names

These names are generated with the naming rule above, in reading order.

**`qasidas/`** (25)

1. `the-opening` — 1 · The Opening
2. `allah-praises-his-prophet` — 3 · Allah Praises His Prophet (Quranic verses)
3. `the-closing-praise` — 35 · The Closing Praise
4. `the-opening-qasida` — 2 · The Opening Qasida — Yā Rabbi Ṣalli ʿalā Muḥammad
5. `the-caravaners-qasida` — 7 · The Caravaner's Qasida — Ṣalātullāhi mā lāḥat kawākib
6. `ya-nabi-salam-alayka-mawlid-version` — 13 · Yā Nabī Salām ʿAlayka — Mawlid version (Ashraqa-l-kawn)
7. `ya-nabi-salam-alayka-anta-shamsun-version` — Yā Nabī Salām ʿAlayka — Anta Shamsun version
8. `marhaban-marhaban` — 14 · Marḥaban Marḥaban
9. `talaa-l-badru-alayna` — 15 · Ṭalaʿa-l-Badru ʿAlaynā
10. `talama-ashku-gharami` — 16 · Ṭālamā Ashkū Gharāmī
11. `salla-llahu-ala-muhammad` — 17 · Ṣallā-Llāhu ʿalā Muḥammad
12. `ya-arhama-r-rahimin` — 18 · Yā Arḥama-r-Rāḥimīn
13. `ya-rasulallahi-salamun-alayk` — 19 · Yā Rasūlallāhi Salāmun ʿAlayk
14. `burdah` — 20 · Burdah
15. `qul-ya-azim` — 21 · Qul Yā ʿAẓīm
16. `ya-rabbi-salli-ala-n-nabi-muhammadin` — 23 · Yā Rabbī Ṣalli ʿalā-n-Nabī Muḥammadin
17. `an-nabi-sallu-alayh` — 24 · An-Nabī Ṣallū ʿAlayh
18. `ya-imama-r-rusli` — 26 · Yā Imāma-r-Rusli
19. `as-salatu-l-badriyyah` — 27 · Aṣ-Ṣalātu-l-Badriyyah
20. `qasidatu-s-salam` — Qaṣīdatu s-Salām — The Poem of Peace
21. `wishlon-anam-al-layl` — Wishlōn Anām al-Layl — How Can I Sleep at Night?
22. `authors-praise` — 8 · Author's Praise
23. `ya-tawwab-tub-alayna` — 22 · Yā Tawwāb Tub ʿAlaynā
24. `ya-badra-timma` — 25 · Yā Badra Timma
25. `the-muhammadan-qasidah` — 34 · The Muhammadan Qasidah

**`sirah/`** (7)

1. `his-creation` — 4 · His Creation
2. `who-is-he` — 5 · Who is He?
3. `the-prophets-blessed-description` — 6 · The Prophet's Blessed Description
4. `his-pure-ancestry` — 9 · His Pure Ancestry
5. `the-biblical-prediction-of-the-prophetic-kingdom` — 10 · The Biblical Prediction of the Prophetic Kingdom
6. `his-birth` — 11 · His Birth (Mawlid)
7. `his-youth` — 12 · His Youth

**`burdah/`** (10)

1. `on-longing-and-the-complaint-of-love` — 1 · On Longing and the Complaint of Love
2. `on-warning-against-the-caprice-of-the-self` — 2 · On Warning against the Caprice of the Self
3. `in-praise-of-the-prophet` — 3 · In Praise of the Prophet ﷺ
4. `on-his-noble-birth` — 4 · On His Noble Birth
5. `on-his-miracles` — 5 · On His Miracles
6. `on-the-nobility-of-the-quran` — 6 · On the Nobility of the Qur'an
7. `on-the-night-journey-and-ascension` — 7 · On the Night Journey and Ascension
8. `on-his-campaigns-and-striving` — 8 · On His Campaigns and Striving
9. `on-seeking-intercession` — 9 · On Seeking Intercession
10. `on-intimate-prayer-and-petition` — 10 · On Intimate Prayer and Petition

**`barzanji/`** (17)

1. `opening-praise` — Opening Praise
2. `the-noble-lineage` — The Noble Lineage
3. `the-passing-of-the-light` — The Passing of the Light
4. `abdullah-and-aminah` — ʿAbdullāh and Āminah
5. `the-noble-pregnancy` — The Noble Pregnancy
6. `the-noble-birth` — The Noble Birth
7. `signs-at-the-birth` — Signs at the Birth
8. `the-nursing` — The Nursing — Ḥalīmah
9. `the-opening-of-the-breast` — The Opening of the Breast
10. `his-childhood` — His Childhood
11. `youth-and-the-trading-journeys` — Youth and the Trading Journeys
12. `the-marriage-to-khadijah` — The Marriage to Khadījah
13. `the-prophetic-call` — The Prophetic Call
14. `the-night-journey-and-ascension` — The Night Journey and Ascension
15. `the-migration` — The Migration
16. `his-noble-form-and-character` — His Noble Form and Character
17. `the-closing-dua` — The Closing Duʿāʾ

**`diya/`** (8)

1. `the-opening-salawat` — 1 · The Opening Ṣalawāt
2. `the-taawwudh-and-the-quranic-openings` — 2 · The Taʿawwudh and the Qurʾānic Openings
3. `praise-and-the-call-to-the-lovers` — 3 · Praise, and the Call to the Lovers
4. `the-light-announced` — 4 · The Light Announced
5. `the-covenant-and-the-intercession` — 5 · The Covenant and the Intercession
6. `the-conception-and-the-birth` — 6 · The Conception and the Birth
7. `the-standing` — 7 · The Standing
8. `the-supplication` — 8 · The Supplication

**`dalail/`** (15)

1. `title-page` — Title Page
2. `the-opening-dua` — The Opening Duʿāʾ
3. `the-names-of-allah` — The Names of Allah ﷻ
4. `seeking-refuge-from-shirk` — Seeking Refuge from Shirk
5. `sayyid-al-istighfar` — Sayyid al-Istighfār
6. `the-names-of-the-prophet` — The Names of the Prophet ﷺ
7. `monday-part-1` — Monday — Part 1
8. `tuesday` — Tuesday
9. `wednesday` — Wednesday
10. `thursday` — Thursday
11. `friday` — Friday
12. `saturday` — Saturday
13. `sunday` — Sunday
14. `monday-part-2` — Monday — Part 2
15. `the-dua-of-completion` — The Duʿāʾ of Completion

**`litanies/`** (18)

1. `hizb-al-ghayat` — Ḥizb al-Ghāyāt
2. `hizb-al-wiqayah` — Ḥizb al-Wiqāyah
3. `hizb-al-istighfar` — Ḥizb al-Istighfār
4. `al-hizb-al-azam` — Al-Ḥizb al-Aʿẓam
5. `al-hizb-al-azam-saturday` — Al-Ḥizb al-Aʿẓam · Saturday
6. `al-hizb-al-azam-sunday` — Al-Ḥizb al-Aʿẓam · Sunday
7. `al-hizb-al-azam-monday` — Al-Ḥizb al-Aʿẓam · Monday
8. `al-hizb-al-azam-tuesday` — Al-Ḥizb al-Aʿẓam · Tuesday
9. `al-hizb-al-azam-wednesday` — Al-Ḥizb al-Aʿẓam · Wednesday
10. `al-hizb-al-azam-thursday` — Al-Ḥizb al-Aʿẓam · Thursday
11. `al-hizb-al-azam-friday` — Al-Ḥizb al-Aʿẓam · Friday
12. `hizb-al-istighfar-friday` — Ḥizb al-Istighfār · Friday
13. `hizb-al-istighfar-saturday` — Ḥizb al-Istighfār · Saturday
14. `hizb-al-istighfar-sunday` — Ḥizb al-Istighfār · Sunday
15. `hizb-al-istighfar-monday` — Ḥizb al-Istighfār · Monday
16. `hizb-al-istighfar-tuesday` — Ḥizb al-Istighfār · Tuesday
17. `hizb-al-istighfar-wednesday` — Ḥizb al-Istighfār · Wednesday
18. `hizb-al-istighfar-thursday` — Ḥizb al-Istighfār · Thursday

**`nasheeds/`** (0) — empty, `index.json` is `[]`

**`ilahis/`** (11)

1. `gelin-ey-asiklar` — Gelin Ey Aşıklar — Come, O Lovers
2. `guzel-asik-cevrimizi` — Güzel Aşık Cevrimizi — Fair Lover, Our Trial
3. `yemen-illerinde-veysel-karani` — Yemen İllerinde Veysel Karani — Veysel Karani in the Lands of Yemen
4. `su-cennetin-irmaklari` — Şu Cennetin İrmakları — The Rivers of Paradise
5. `sordum-sari-cicege` — Sordum Sarı Çiçeğe — I Asked the Yellow Flower
6. `dolap-nicin-inilersin` — Dolap Niçin İnilersin — Dertli Dolap (The Sorrowful Waterwheel)
7. `ilim-ilim-bilmektir` — İlim İlim Bilmektir — Knowledge Is to Know
8. `adi-guzel-kendi-guzel-muhammed` — Adı Güzel Kendi Güzel Muhammed — Beautiful of Name, Beautiful of Self
9. `derman-arardim-derdime` — Derman Arardım Derdime — I Sought a Cure for My Ailment
10. `daglar-ile-taslar-ile` — Dağlar İle Taşlar İle — Let Me Call Upon You, My Lord
11. `arayi-arayi-bulsam-izini` — Arayı Arayı Bulsam İzini — O Muhammad, My Soul Longs for You

**`silsila/`** (40)

1. `prophet-muhammad` — 1 · Prophet Muhammad ﷺ
2. `abu-bakr-al-siddiq` — 2 · Abu Bakr al-Siddiq
3. `salman-al-farisi` — 3 · Salman al-Farisi
4. `qasim-ibn-muhammad-ibn-abi-bakr` — 4 · Qasim ibn Muhammad ibn Abi Bakr
5. `imam-jafar-al-sadiq` — 5 · Imam Ja'far al-Sadiq
6. `bayazid-al-bistami` — 6 · Bayazid al-Bistami
7. `abul-hasan-al-kharqani` — 7 · Abul Hasan al-Kharqani
8. `abu-ali-al-farmadi` — 8 · Abu Ali al-Farmadi
9. `abu-yaqub-yusuf-al-hamadani` — 9 · Abu Yaqub Yusuf al-Hamadani
10. `abul-abbas-al-khidr` — 10 · Abul Abbas al-Khidr (peace be upon him)
11. `shaykh-abdul-khaliq-al-ghujdawani` — 11 · Shaykh Abdul Khaliq al-Ghujdawani
12. `shaykh-arif-al-riwgari` — 12 · Shaykh Arif al-Riwgari
13. `shaykh-mahmud-al-anjir-al-faghnawi` — 13 · Shaykh Mahmud al-Anjir al-Faghnawi
14. `shaykh-ali-al-ramitani` — 14 · Shaykh Ali al-Ramitani
15. `shaykh-muhammad-baba-al-sammasi` — 15 · Shaykh Muhammad Baba al-Sammasi
16. `sayyid-amir-kulal` — 16 · Sayyid Amir Kulal
17. `shah-baha-al-din-naqshband` — 17 · Shah Baha' al-Din Naqshband
18. `shaykh-ala-al-din-al-attar` — 18 · Shaykh Ala' al-Din al-Attar
19. `shaykh-yaqub-al-charkhi` — 19 · Shaykh Ya'qub al-Charkhi
20. `shaykh-ubaydullah-al-ahrar` — 20 · Shaykh Ubaydullah al-Ahrar
21. `shaykh-muhammad-al-zahid` — 21 · Shaykh Muhammad al-Zahid
22. `shaykh-darwish-muhammad` — 22 · Shaykh Darwish Muhammad
23. `shaykh-muhammad-khwaja-al-amkanaki` — 23 · Shaykh Muhammad Khwaja al-Amkanaki
24. `shaykh-muhammad-al-baqi-billah` — 24 · Shaykh Muhammad al-Baqi Billah
25. `imam-rabbani-ahmad-al-faruqi-al-sirhindi` — 25 · Imam Rabbani Ahmad al-Faruqi al-Sirhindi
26. `shaykh-muhammad-al-masum` — 26 · Shaykh Muhammad al-Ma'sum
27. `shaykh-muhammad-sayfuddin-al-faruqi` — 27 · Shaykh Muhammad Sayfuddin al-Faruqi
28. `shaykh-nur-muhammad-al-badawani` — 28 · Shaykh Nur Muhammad al-Badawani
29. `shaykh-shams-al-din-habibullah` — 29 · Shaykh Shams al-Din Habibullah (Mazhar Jan-i-Janan)
30. `shaykh-abdullah-al-dahlawi` — 30 · Shaykh Abdullah al-Dahlawi
31. `mawlana-khalid-al-baghdadi` — 31 · Mawlana Khalid al-Baghdadi
32. `shaykh-ismail-al-anarani` — 32 · Shaykh Isma'il al-Anarani
33. `shaykh-khas-muhammad-shirwani` — 33 · Shaykh Khas Muhammad Shirwani
34. `shaykh-muhammad-effendi-al-yaraghi` — 34 · Shaykh Muhammad Effendi al-Yaraghi
35. `shaykh-jamal-al-din-al-ghumuqi-al-husayni` — 35 · Shaykh Jamal al-Din al-Ghumuqi al-Husayni
36. `shaykh-abu-ahmad-al-sughuri` — 36 · Shaykh Abu Ahmad al-Sughuri
37. `shaykh-abu-muhammad-al-madani` — 37 · Shaykh Abu Muhammad al-Madani
38. `shaykh-sharaf-al-din-al-daghestani` — 38 · Shaykh Sharaf al-Din al-Daghestani
39. `shaykh-abdullah-al-faiz-al-daghestani` — 39 · Shaykh Abdullah al-Fa'iz al-Daghestani
40. `mawlana-shaykh-muhammad-nazim-al-haqqani` — 40 · Mawlana Shaykh Muhammad Nazim al-Haqqani

**`turuqs/`** (0) — empty, `index.json` is `[]`

**`sohbets/`** (1)

1. `dont-worry` — 1 · Don't Worry

**`biographies/`** (0) — empty, `index.json` is `[]`

**`ottoman/`** (0) — empty, `index.json` is `[]`
