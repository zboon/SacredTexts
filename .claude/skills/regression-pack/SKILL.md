---
name: regression-pack
description: Turn a tested Sacred Texts issue into permanent Playwright regression coverage. Take the scenarios and happy-path script from the test-issue results comment, write them into tests/e2e using the repo's page objects, prove them green twice, record the issue↔test mapping in tests/REGRESSION.md, and open a PR that links back to the issue. Bootstraps the test suite on first use. Use when asked to "add to regression", "automate the tests for" issue #N, or to confirm a bug with a failing test.
argument-hint: "<issue number> [base branch] [scenarios to exclude]"
---

# Playbook: Issue tests → regression pack

Takes what `test-issue` verified by hand and makes it permanent, so every
future PR can be checked against it.

**Read first:** `.claude/skills/CONVENTIONS.md`.

The bug template's rule: *a bug is not confirmed until its reproduction scenario
exists as a failing automated test*. That makes this playbook the
**bug-confirmation step** too (see "Bug mode" below).

---

## Critical (MUST)

- **1:1 mapping.** One Gherkin scenario = one Playwright `test()`, and the test title starts with `ISSUE{N}_{NN} - `. Never bundle several scenarios into one test.
- Every test lives in `tests/e2e/`, uses the shared fixtures and page objects, and has **no raw selectors in the spec** (selectors live in page objects).
- Tag every describe block `@issue-{N}` and `@regression`.
- A test is only added as `automated` after it has passed **twice in a row** locally, with `retries: 0`. Never `.skip`, weaken an assertion, or add a bare `waitForTimeout` to get green.
- Keep `tests/REGRESSION.md` in step with the specs. Every test title appears there character for character.
- PR title and commits are prefixed `#{N}: `, and the PR body references the issue (`Refs #{N}`, not `Closes`, because the feature PR closes the issue).
- Don't change app files (`index.html`, `sw.js`, `manifest.json`) in this PR. Test-only.

---

## Inputs

| Input | Required | Default |
|---|---|---|
| Issue number `N` | yes | — |
| Source scenarios | yes | The issue's Gherkin + the latest `test-issue` results comment and its Playwright script |
| Base branch | no | `main` |
| Exclusions | no | — |

If there is no `test-issue` comment and no Gherkin on the issue, stop and ask.
Don't invent scenarios.

---

## Layout (created on first run)

```
package.json                 # devDependencies only: @playwright/test; scripts below
playwright.config.ts
tests/
  REGRESSION.md              # issue ↔ spec ↔ test coverage index
  e2e/
    fixtures.ts              # extends test with page objects + error guard
    pages/
      app-page.ts            # shared: goto, home, back, theme, search, Arabic size, offline helpers
      {area}-page.ts         # one per area: burdah, dalail, ilahi, silsila, sohbets, …
    {area}.spec.ts           # kebab-case, one per area (not one per issue)
```

`package.json` scripts:

```json
{
  "private": true,
  "scripts": {
    "test:e2e": "playwright test",
    "test:regression": "playwright test --grep @regression",
    "test:issue": "playwright test --grep"
  },
  "devDependencies": { "@playwright/test": "{pin to the installed Playwright version}" }
}
```

`playwright.config.ts` essentials:

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,          // a test that only passes on retry is not stable
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:8765', trace: 'retain-on-failure' },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'python3 -m http.server 8765', url: 'http://localhost:8765/index.html', reuseExistingServer: true,
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } }],
});
```

`fixtures.ts` must fail any test that raises a `pageerror`, and must ignore
console network errors from third-party hosts (CONVENTIONS §7.3).

Add `node_modules/`, `test-results/`, `playwright-report/` and `test-evidence/` to `.gitignore`.

**Bootstrap rule:** if this scaffold doesn't exist, build it as the first
commit of the PR (`#{N}: Add Playwright regression scaffold`) with one smoke
test, `SMOKE_01 - App loads with every home section tile`. Mention it
prominently in the PR body.

> The repo is served from `main` by GitHub Pages, so `tests/` and
> `package.json` become publicly reachable URLs. That's harmless. The service
> worker never caches them and the app never loads them.

---

## Procedure

1. **Gather.** Read the issue, its Gherkin, every comment, and the newest `test-issue` results (tables + script). If a `regression-pack` marker comment exists, this is a re-run. Update rather than duplicate.
2. **Scenario table.** Number the scenarios `ISSUE{N}_01…`. For each, record the manual result and whether it can be automated. Exclude, and record why:
   - third-party playback (YouTube / audio streams)
   - Live Session needing a real Supabase project
   - visual-only judgements (font beauty, spacing taste)
   - screen-reader announcements

   Offline **is** automatable (`context.setOffline(true)` after the service worker is ready). So are persistence across reload and version bumps.
3. **Branch.** `git fetch origin main && git checkout -b claude/{N}-regression origin/main` (or the assigned branch). Install dependencies **without** downloading browsers: `npm install` (cloud sessions already set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; Chromium is in `/opt/pw-browsers`).
4. **Study before writing.** Read `fixtures.ts`, `pages/app-page.ts`, and the spec for the same area if one exists. Reuse an existing page object. Add a new one only when no area fits.
5. **Write.**
   - Page object methods named for intent (`openBurdahChapter(3)`, `toggleTheme()`, `searchFor(q)`, `goOffline()`), plus one `expectX()` per assertion.
   - Spec: add to `tests/e2e/{area}.spec.ts` inside `test.describe('{Area} @issue-{N} @regression', …)`. Put a header comment with the issue URL. Precede each test with `// Scenario: {Gherkin scenario name}`.
   - Use the values that passed during manual testing. For any stored data, start from a fresh context. Never depend on another test's state.
6. **Prove it.**
   ```bash
   npx playwright test --grep @issue-{N} --retries=0   # run 1
   npx playwright test --grep @issue-{N} --retries=0   # run 2
   npx playwright test --grep @regression              # whole pack, nothing else broke
   npx tsc --noEmit -p . 2>/dev/null || npx playwright test --list >/dev/null   # type/collect check
   ```
   Fix flakiness at its cause: wait on `expect(...).toBeVisible()`, wait for `navigator.serviceWorker.ready`, isolate storage. If a test exposes a **real app defect**, stop. Report it on the issue (and offer a bug report). Don't bend the test.
7. **Update `tests/REGRESSION.md`.**

   ```markdown
   ## #{N} — {issue title}
   Spec: `tests/e2e/{area}.spec.ts` · Tag: `@issue-{N}` · Added: {YYYY-MM-DD} in #{prNumber}

   | ID | Scenario (Gherkin) | Test title | Status | Run 1 | Run 2 |
   |---|---|---|---|---|---|
   | ISSUE{N}_01 | {scenario} | `ISSUE{N}_01 - {…}` | automated | ✅ | ✅ |
   | ISSUE{N}_02 | {scenario} | — | manual: {reason} | — | — |
   ```

   Then check the titles match exactly: `npx playwright test --grep @issue-{N} --list` vs the table.
8. **Commit, push, PR.** Commits are `#{N}: …`. The PR goes into `main`, titled `#{N}: Regression tests for {short title}`. Body:

   ```markdown
   Refs #{N}

   ## Coverage
   | ID | Test | Run 1 | Run 2 |
   |---|---|---|---|

   ## Not automated
   | Scenario | Reason |
   |---|---|

   **Run locally:** `npm install && npm run test:issue -- @issue-{N}`
   **Pack:** `npm run test:regression`
   {Scaffold added in this PR — first regression suite for the repo, if bootstrapping}
   {footer}
   ```
9. **Close the loop on the issue.** Add the `claude:regression` label and post:

   ```markdown
   ## Regression pack updated
   **PR:** #{prNumber} · **Tag:** `@issue-{N}` · **Spec:** `tests/e2e/{area}.spec.ts`

   | ID | Test | Run 1 | Run 2 |
   |---|---|---|---|

   **Not automated:** {list with reasons, or "none"}
   {footer}
   ```
10. **Verify the handover** by re-reading from GitHub, not from memory: the PR exists and references the issue, the comment and label are on the issue, and `REGRESSION.md` in the PR head matches `--list` output.

---

## Bug mode (confirming a bug)

When the issue is a `bug` that hasn't been fixed yet:

1. Write the "Fixed when" Gherkin as tests, exactly as above.
2. Run them on `main`. They **must fail** for the reason in the bug report. A test that passes on `main` doesn't reproduce the bug, so revisit the steps.
3. Mark them `test.fail()` with a comment linking the issue. The pack stays green, and the test flips to an "unexpected pass" the moment the fix lands. The fix PR (`dev-issue`) then removes `test.fail()`.
4. In `REGRESSION.md`, set the status to `confirmed-bug (expected fail)`.
5. On the issue, post "Bug confirmed by failing test `ISSUE{N}_01` (PR #…)."

---

## Forbidden

- Marking a test `automated` in `REGRESSION.md` without two green local runs in this session.
- `.skip`, deleting assertions, or loosening them to pass. Editing tests unrelated to this issue.
- Changing app files in this PR, or changing `playwright.config.ts` just to make a test pass.
- Committing `node_modules/`, `test-results/`, `playwright-report/`, screenshots, or video.
- Raw selectors or `http://localhost` inside spec files.
- Creating a second describe block or `REGRESSION.md` entry for an issue that already has one. Extend it instead.

---

## Future: CI

Once the scaffold exists, a GitHub Actions workflow can run
`npm run test:regression` on every PR, using the Playwright container, and post
results. That workflow is a separate change. Propose it, don't add it from
this playbook.
