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
