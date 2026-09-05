# Working on a section

Each section of the Academy has its own branch, so several people can write at
the same time without waiting on each other. Everything you need is already
wired up — you add content, nothing else.

## 1. Your branch and your array

Check out your branch and edit only the array named below, inside `index.html`.
Search the file for the array's name; it sits under a large banner comment that
explains the format.

| Section | Branch | The one array you edit |
|---|---|---|
| Mawlid | `section/mawlid` | `QASIDAS`, `BARZANJI_CHAPTERS`, `DIYA_CHAPTERS`, `BURDAH_CHAPTERS` |
| Dalāʾil al-Khayrāt | `section/dalail` | `DALAIL_CHAPTERS` |
| Naqshbandi Silsila | `section/silsila` | `SILSILA_CHAPTERS` |
| Turuqs | `section/turuqs` | `TURUQ_CHAPTERS` |
| Sohbets | `section/sohbets` | `SOHBET_CHAPTERS` |
| Ilahi | `section/ilahi` | `ILAHI_CHAPTERS` |
| Biographies | `section/biographies` | `BIOGRAPHY_CHAPTERS` |
| Ottoman History | `section/ottoman` | `OTTOMAN_CHAPTERS` |

```bash
git checkout section/silsila     # your branch
# edit index.html — your array only
git commit -am "Silsila: add Shaykh ʿAbd al-Khāliq al-Ghujdawānī"
git push
```

Your section's tile, list, reader, search and bookmarks all work the moment you
add an entry. There is no build step and nothing to register.

## 2. The entry format

Every section uses the same shape:

```js
{
  titleArabic : "الشَّيْخ عَبْد الْخَالِق الْغُجْدَوَانِي",
  titleEnglish: "1 · Shaykh ʿAbd al-Khāliq al-Ghujdawānī",
  note        : "…",                 // optional — green banner at the top
  video       : "https://youtu.be/…",// optional — adds a "Listen" link
  verses: [
    { ar: "مِنْ سَادَاتِ الطَّرِيقَةِ", tr: "Min sādāti-ṭ-ṭarīqah", en: "One of the masters of the path." }
  ]
}
```

- The leading `N ·` in `titleEnglish` sets the display order.
- One `verses` entry per paragraph (prose) or per line (poetry).
- `۞` splits the two halves of a line of poetry; `\n` is a hard line break.
- **English prose** (Sohbets, Biographies, Ottoman History): add `latin: true`,
  put the English in `ar` (it renders left-to-right), and leave `tr` as `""`.

### Silsila only: portraits

`SILSILA_CHAPTERS` already holds all 40 masters of the Golden Chain as
stubs — the tile, numbering and reader placeholder work as soon as
`titleArabic`/`titleEnglish` are there, even with an empty `verses: []`. To
add a small thumbnail beside a master's name, set `image` on their entry to
a data URI or an `https://` URL; leave it `""` to keep the placeholder
avatar. This field is specific to this section and does nothing elsewhere.

## 3. Checking your work

Open `index.html` in a browser — double-clicking the file is enough. Your
entries should appear in your section and open when tapped.

## 4. Rules that keep the merges clean

The whole app is one large `index.html`, so we avoid conflicts by staying out
of each other's way:

- **Only touch your own array.** Everything else — the menu, the routing, the
  counts, the readers — is already done and shared by all eight branches. If
  you think you need a change outside your array, raise it rather than making
  it on your branch.
- **Don't bump `APP_VERSION` or the cache version in `sw.js`.** Every branch
  would change the same line and every merge would conflict. Whoever merges to
  `main` bumps it once, at the end.
- **Keep your entries inside the array's blank-line margins.** The spacing
  around each array is deliberate — it's what stops two sections' edits from
  landing in the same diff hunk.
- **Merge `main` into your branch** before opening a pull request, so you
  resolve anything on your side rather than in the shared branch.

## 5. Content and copyright

Follow the policy in `README.md`: original texts only where they are public
domain, English renderings written by us rather than copied from a copyrighted
translation, and no modern copyrighted lyrics. If a piece can't be traced to a
public-domain source, link to it instead of pasting the full text.
