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
