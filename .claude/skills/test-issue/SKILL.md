---
name: test-issue
description: Exploratory and acceptance testing of a Sacred Texts GitHub issue. Serve the app locally, drive it in Chromium with Playwright against the issue's Gherkin scenarios and app-specific risk areas (Arabic rendering, offline/PWA, persistence, mobile, dark mode), capture named screenshots, post a structured results comment with evidence, and attach a happy-path Playwright script for regression-pack. Use when asked to "test" issue #N or PR #N.
argument-hint: "<issue number> [branch or PR] [focus areas]"
---

# Playbook: Test a GitHub issue

Checks that an issue's change works and hasn't broken anything around it.
**This playbook finds bugs. It does not fix them.**

**Read first:** `.claude/skills/CONVENTIONS.md`.

---

## Critical (MUST)

- **Don't modify app code** (`index.html`, `sw.js`, `manifest.json`). Document bugs instead of fixing them.
- Test the **PR branch** if the issue has an open PR. Otherwise test the requester's branch, or `main`.
- Test locally (`python3 -m http.server`), not the live GitHub Pages site, unless the requester asks for a live smoke check.
- Take a screenshot at each test's decisive moment, named `TC{NN}_{snake_description}_{PASS|FAIL}.png`.
- Post results in the exact template from step 6, with screenshots embedded.
- Write a happy-path Playwright script (step 7) and include it in the results comment for `regression-pack`.
- Every scenario in the issue's Gherkin block becomes at least one test case.

---

## Inputs

| Input | Required | Default |
|---|---|---|
| Issue number `N` | yes | — |
| Branch / PR | no | The open PR that `Closes #N`, else `main` |
| Focus areas, devices, data | no | — |

---

## 1. Gather

1. Read the issue and all comments: type, Gherkin scenarios, environment (bugs), the "Testing scope" and "Technical notes" sections of the linked PR if one exists.
2. Read the PR diff to see exactly what changed (which arrays, functions, CSS, `sw.js`).
3. Note earlier `test-issue` runs (by the marker). If this is a re-test, use the re-test template.

## 2. Plan

Pick categories from the table below. Always include **A** plus every Gherkin scenario.

| | Category | What to check in this app |
|---|---|---|
| **A** | Happy path / acceptance | Each Gherkin scenario, exactly as written. For bugs, first reproduce on `main`, then confirm it's fixed on the branch. |
| **B** | Text rendering | Arabic renders in the Uthmani face with full harakat (no tofu or black blobs). Arabic punctuation and `۞` fall back to Amiri. Hemistichs split on `۞`. `\n` breaks lines. Refrain verses are labelled. `latin: true` entries render LTR with the transliteration toggle hidden. The `N ·` order is correct. Arabic size +/− works. |
| **C** | Layout & UI | 360×740 and 390×844 (phone), 768×1024 (tablet), 1280×800 (desktop). Dark and light ("Day or night"). No horizontal scroll. RTL alignment. Green note banner. "Listen" links. Home tiles and back navigation. |
| **D** | Persistence | Survives reload: favourites (`mawlid-favs`), bookmarks/marks (`mawlid-marks`), Dalāʾil place (`mawlid-dalail-place`), theme, reciter, play rate, spread. Survives an app update (bump the version locally, reload, data still there). |
| **E** | Offline / PWA | Service worker registers on `localhost`. With `context.setOffline(true)` a reload still opens the app and the changed section. The fonts still render offline. The manifest is valid. After a version bump the new build is served on the next navigation. |
| **F** | Search | Fuzzy search finds the new or changed content by English title, by transliteration, and with and without diacritics. Results open the right piece. An empty query restores the list. |
| **G** | Accessibility | Keyboard Tab reaches the controls, focus is visible, icon buttons have `aria-label`s, contrast is readable in both themes, Arabic has `lang`/`dir`. |
| **H** | Regression | Adjacent sections and pieces still open. Home still lists every section. Placeholder sections still show placeholders. No `pageerror` anywhere visited. |
| **I** | Audio / video | "Listen to the tune" links and the player dock open. Download-for-offline still works. Third-party playback may fail in the sandbox, so record it as **Untested (network)**, not FAIL. |
| **J** | Live Session | Only if `SESSION_CONFIG` is set or the change touches sessions. Start/Join UI, `#s=1234` link parsing, the app still works when Supabase is unreachable (it must fail quietly). |

Which categories apply to each change type:

| Change type | Always | If relevant |
|---|---|---|
| New/changed content | A, B, F, H | C, D |
| UI / styling | A, C, G | B, H |
| Bug fix | A, H | anything the bug touched |
| Offline / `sw.js` | A, E, D | H |
| Persistence / settings | A, D | E, H |
| Search | A, F | B |
| Audio | A, I | E |
| Live Session | A, J | E, H |

Write the plan into your working notes as a numbered list of
`TC{NN} — It should …` test names before you start.

## 3. Environment

```bash
git fetch origin {branch} && git checkout {branch}
python3 -m http.server 8765        # background
mkdir -p test-evidence/{N}         # local only — never commit to the app branch
```

Then run the static check (CONVENTIONS §7.1). If it fails, that is
**TC00 — It should load without a JavaScript error: FAIL**. Post the result
straight away, because nothing else can be tested.

Drive Chromium with Playwright (pre-installed in cloud sessions, see
CONVENTIONS §7.3). Log `pageerror` and console errors for the whole session.
Ignore third-party network failures (Google Fonts, YouTube, Supabase).

## 4. Execute

For each test case:

1. Do the steps. Use a fresh `BrowserContext` when the test needs clean storage.
2. Screenshot the decisive moment: `test-evidence/{N}/TC{NN}_{desc}_{PASS|FAIL}.png`. Use `fullPage: false` at the test's viewport so it reads like a phone screen.
3. For a FAIL, also capture the "before" state and any console error text.

Name tests `It should …`, for example:
- `It should show chapter 3 of the Burdah with a Listen link`
- `It should render the new ilahi left-to-right with no transliteration toggle`
- `It should keep favourites after the cache version changes`
- `It should open the new sohbet with the network offline`

## 5. Publish evidence

Screenshots must be viewable straight from the issue comment.

1. Commit the screenshots to the orphan branch **`test-evidence`** at path `issues/{N}/{YYYY-MM-DD}-{runId}/`. Create the branch with `git switch --orphan test-evidence` if it doesn't exist. This branch never merges anywhere and holds only evidence.
2. Embed each image with `https://raw.githubusercontent.com/zboon/SacredTexts/test-evidence/issues/{N}/{run}/TC01_….png`.
3. Optional: if there are more than 8 screenshots, also make a walkthrough video and commit it alongside. Link it rather than embedding it.

```bash
cd test-evidence/{N}
for f in $(ls TC*.png | sort); do echo "file '$PWD/$f'"; echo "duration 3"; done > list.txt
echo "file '$PWD/$(ls TC*.png | sort | tail -1)'" >> list.txt
ffmpeg -y -f concat -safe 0 -i list.txt -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -pix_fmt yuv420p -r 1 walkthrough.mp4
```

## 6. Report on the issue

Post as a comment on issue `#N` (and a one-line pointer on the PR if there is one).

~~~markdown
## Testing complete{ — issues found}

**Issue:** #{N} — {title}
**Branch:** `{branch}` @ `{shortSha}` · **Build:** `{vNNN}`
**Date:** {YYYY-MM-DD} · **Environment:** local `http.server`, Chromium {version}, viewports {list}

| Total | Passed | Failed | Untested |
|---|---|---|---|
| n | n | n | n |

### Bugs found
<!-- delete this section if none -->
| # | Severity | Description | Steps to reproduce |
|---|---|---|---|
| 1 | High | {what} | {Given / When / Then} |

### Results

#### [A] Acceptance
| TC | Test | Result | Notes |
|---|---|---|---|
| 01 | It should … | ✅ PASS | … |

#### [B] Text rendering
| TC | Test | Result | Notes |
|---|---|---|---|

{…one table per category tested…}

<details><summary>Screenshots ({count})</summary>

**TC01 — It should …** ✅
![TC01](https://raw.githubusercontent.com/zboon/SacredTexts/test-evidence/issues/{N}/{run}/TC01_….png)

</details>

{Walkthrough video: [walkthrough.mp4]({rawUrl}) — if made}

### Observations
- {non-bug notes, suggestions}

<details><summary>Playwright happy-path script (for <code>/regression-pack {N}</code>)</summary>

```ts
{script from step 7}
```

</details>
{footer}
~~~

Severity follows the bug template:
- **Critical:** the app won't load, or content or data is lost.
- **High:** a core flow is broken with no workaround.
- **Medium:** broken, but a workaround exists.
- **Low:** cosmetic.

For each Critical or High bug, offer to open a separate bug issue in the
`bug_report.md` format. Open it only if the requester agrees, or if the
automation config says to.

Re-test template: same layout, headed `## Re-test results`. Add a
**Reason for re-test** line and a **Changes since last run** list.

Then add the `claude:tested` label to the issue.

## 7. Happy-path Playwright script

Automate the passing Category A scenarios only. This is the input to
`regression-pack`, so follow its conventions now:

```ts
import { test, expect } from '@playwright/test';

// Issue #{N}: {title}
test.describe('{Area} @issue-{N}', () => {
  test('ISSUE{N}_01 - {scenario name from the Gherkin}', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: /{tile or link text}/i }).click();   // prefer role/label/text
    await expect(page.getByText('{expected visible text}')).toBeVisible();
  });
});
```

Selector priority:
1. `getByRole` / `getByLabel` (the app has `aria-label`s such as "Home", "Back", "Favorites", "Day or night", "Larger Arabic", "Smaller Arabic").
2. `getByText` with stable title text.
3. Scoped CSS as a last resort, with a comment saying why.

Don't use `waitForTimeout` except to let fonts settle (≤1000ms, with a comment
saying so). No `page.pause()`. Don't hardcode `http://localhost`, because
`baseURL` comes from the config.

Don't commit the script here. It goes in the comment. `regression-pack` commits it.

---

## Forbidden

- Editing app files or pushing to the app branch during a test run.
- Marking an issue closed or removing labels other than your own.
- Reporting a third-party network failure as an app FAIL.
- Skipping screenshots, or posting results without the evidence links.
- Testing against the live site unless asked. If asked, it's a smoke check only, and the report says so.
