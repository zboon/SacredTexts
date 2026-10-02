---
name: pr-review
description: Automated code review of a Sacred Texts pull request that flags only breaking issues (blank app, stale cache, lost bookmarks, offline regressions, font licence or copyright breaches, XSS, leaked keys) as inline comments, then posts a verdict. Use when asked to review PR #N, or when triggered on pull_request opened/synchronize.
argument-hint: "<PR number>"
---

# Playbook: Automated PR review

Flags what would **break the app, break users' phones, or breach licence or
copyright** if merged. Style is out of scope. Silence is better than noise.

**Read first:** `.claude/skills/CONVENTIONS.md`.

---

## Critical (MUST)

- Comment only on lines in the diff, one issue per comment.
- Each comment carries a confidence level (High / Medium / Low) and a concrete fix.
- Check existing review threads first and never repeat a point already raised.
- **Never approve or merge.** Submit the review as `COMMENT`, or `REQUEST_CHANGES` when there is a High-confidence finding. A human approves.
- Run the static check (CONVENTIONS §7.1) on the PR head. Its result goes in the summary.
- Finish end to end without waiting for input.

---

## Inputs

PR number `N` (head branch, base branch, linked issue are read from the PR).

---

## Procedure

### 1. Gather

1. PR title, body, base and head, the linked issue (`Closes #…`), and changed files.
2. Every existing review and comment thread, so you can skip duplicates.
3. The diff. `index.html` diffs can be huge when base64 font data changes. Treat any change inside a `@font-face` `src: url(data:…)` as a **font change** (see category 6) and don't read the base64.
4. Check out the PR head locally and run the static check (CONVENTIONS §7.1).
5. If the linked issue has Gherkin acceptance criteria, keep them to hand. A diff that clearly can't meet a scenario is a finding.

### 2. Analyse against the breaking categories

#### Critical: always comment (usually High)

| # | Category | What to look for |
|---|---|---|
| 1 | **App won't load** | JS syntax error (static check fails), a reference to an undefined function or variable on the startup path, a broken template literal or quote in a content string (an unescaped `` ` `` or `${` inside a content entry is a classic). One error here blanks every section. |
| 2 | **Stale cache / version drift** | PR into `main` changes `index.html`, `sw.js`, `manifest.json` or icons but does **not** bump `sw.js` `CACHE`; or `APP_VERSION`, `<meta name="app-version">` and `CACHE` disagree; or the new number is not higher than `main`'s. Section-branch PRs must **not** bump. |
| 3 | **User data loss** | Renaming or removing a `localStorage` key (list in CONVENTIONS §8) without migration; changing the shape stored under a key without tolerant parsing; `AUDIO_CACHE` gaining a version or dropping out of `KEEP` in `sw.js`, which wipes downloaded recitations on the next release. |
| 4 | **Offline regression** | A new `fetch`/`<script src>`/`<link>` on the startup path; `sw.js` changes that break precache (`CORE` list), the navigate network-first + 4s fallback, or the opaque-response caching that keeps fonts offline. |
| 5 | **Security** | `innerHTML` built from anything user-controlled (search query, URL hash `#s=…`, Live Session broadcast payloads) without escaping; a Supabase service-role key or any secret in `SESSION_CONFIG`; `eval`/`new Function` on external data. |
| 6 | **Font licence** | KFGQPC Uthmanic Hafs base64 altered or subset (licence forbids modification); `OFL.txt` deleted; the `unicode-range` on the Uthmani `@font-face` widened to include codepoints the font maps to its blank glyph (renders black blobs). The rosette rule must stay pinned to Amiri. |
| 7 | **Copyright** | New full text of a modern or copyrighted lyric, or an English translation that appears copied rather than our own (README policy). Medium confidence unless the source is obvious. |

#### High impact: comment if confidence ≥ Medium

| # | Category | What to look for |
|---|---|---|
| 8 | **Content structure** | Entry missing `verses`; `titleEnglish` without the `N ·` order prefix, or a duplicate number that reorders a list; `latin: true` missing on English prose (renders RTL); `tr` populated on `latin` entries; `۞` used outside `ar`; a duplicated or mis-numbered chapter. |
| 9 | **Section-branch rule** | A PR from `section/*` touching anything outside its own array (CONTRIBUTING.md), or editing inside another section's blank-line margins. |
| 10 | **Navigation / routing** | New `state.tab` values not handled in `renderResults`/`TAB_CHILDREN`; `OPENERS` missing a new kind; back button or `#s=` hash handling broken. |
| 11 | **Live Session** | Supabase library loaded eagerly (must stay lazy); sessions no longer failing silently when unreachable. |
| 12 | **Mobile / RTL layout** | Fixed widths larger than 360px; Arabic text losing `dir="rtl"` or the Uthmani font-family; dark-mode colours hard-coded instead of using the CSS custom properties. |
| 13 | **Performance** | Work that runs per keystroke over all content without debounce; large new base64 assets (note the size). |

#### Do NOT comment on

Formatting, naming, comment wording, refactor ideas, "consider adding a
test", transliteration style preferences (unless it changes meaning), or
anything outside the diff.

### 3. Confidence

| Level | Evidence | Action |
|---|---|---|
| **High** | Static check fails; clear key rename; missing bump on `main` PR; font bytes changed | Always comment |
| **Medium** | Pattern very likely to break (unescaped hash into `innerHTML`, new startup fetch) | Comment, saying what would confirm it |
| **Low** | Suspicious only | Comment only if the category is Critical; otherwise mention in the summary |

### 4. Comment format (inline, one per issue)

~~~markdown
**[High] {short issue title}**

**Impact:** {what breaks, for whom — e.g. "every installed phone keeps v385 and never sees this change"}
**Fix:** {specific change}

```js
// suggested code, if useful
```
~~~

### 5. Submit the review

Use a pending review: create it, add the inline comments, then submit with:

- `REQUEST_CHANGES` if any **High** finding exists, otherwise `COMMENT`.
- Summary body:

```markdown
## Automated review

**Verdict:** {🔴 Changes needed — N blocking | 🟢 No breaking issues found}
**Static check:** JS syntax {OK/FAIL} · versions {vNNN in step / MISMATCH} · manifest {OK/FAIL}
**Cache bump:** {bumped vA → vB | missing | N/A (section branch)}

| Severity | Count |
|---|---|
| High | n |
| Medium | n |
| Low (not posted inline) | n |

{Low-confidence notes, one line each, if any}

Human QC and approval still required.
{footer}
```

Then add the `claude:reviewed` label to the PR.

### 6. Re-reviews

On new pushes, review only the new commits' diff. Reply on your own earlier
threads with "Fixed in {sha}" where they are fixed, and resolve them. Don't
re-post findings that still stand. Point to the existing thread in the
summary instead.

---

## Edge cases

| Case | Do |
|---|---|
| Docs-only PR (`*.md`, `.github/`, `.claude/`) | Skip categories 1–13 except secrets. `COMMENT` "No app changes". No bump needed. |
| Empty diff | No review |
| Merge conflict with base | High comment in the summary (not inline) |
| Base64 / binary changes | Don't read; apply category 6 or 13 |
| GitHub API failure | Retry 3× with backoff. If inline comments can't be posted, put the findings in the summary body. Never submit an empty review when High findings exist. |

---

## Examples

**Missing bump.** Diff touches `BURDAH_CHAPTERS`, PR into `main`, `sw.js` unchanged:

> **[High] Cache version not bumped**
> **Impact:** Installed phones keep serving `sacredtexts-v385` from cache and never see this content.
> **Fix:** Bump `sw.js` `CACHE`, `APP_VERSION` and `<meta name="app-version">` to `v386` together.

**Key rename.** `const FAV_KEY = 'mawlid-favs'` → `'sacredtexts-favs'`:

> **[High] Favourites storage key renamed without migration**
> **Impact:** Every user's favourites disappear on update.
> **Fix:** Keep the old key, or read `mawlid-favs` once, write it to the new key, then remove the old one.

**Hash into HTML.** `el.innerHTML = 'Joined ' + code` where `code` comes from `location.hash`:

> **[Medium] Session code from URL inserted as HTML**
> **Impact:** A crafted share link (`#s=<img onerror=…>`) could run script, though the current regex limits characters. Confirm the regex is applied before this line.
> **Fix:** Use `textContent`, or escape it.
